# 05 · Health Score Engine

> Predicts which threads will need mod intervention 1–2 hours ahead. Continuously scores every active thread.

---

## What it predicts

For each active thread (post with comments), Health Score outputs:
- A **risk score** (0–100) — current likelihood that this thread will need intervention
- A **trajectory** — is the risk climbing, stable, or falling?
- A **forecast** — projected state in 1 hour and 2 hours
- A **reasoning breakdown** — which signals are firing and how strongly

This is the engine that lets mods triage their queue intelligently. Instead of "newest first," they sort by "most likely to explode soon."

---

## What "needs intervention" means

The model is calibrated against threads where mods historically did one of these:
- Locked the thread
- Enabled slow mode
- Removed the original post
- Banned multiple users participating
- Had to manually moderate ≥5 comments

When ≥1 of these happened, that thread's last-state-before-action becomes a positive label retrospectively. Over time, this builds the calibration data.

For new installs without history, use cold-start defaults (signal weights pre-tuned from Reddit-wide patterns where reasonable).

---

## The four signals

### Signal 1: Velocity z-score

Comments per minute, compared to the sub's normal velocity.

```typescript
function velocityZScore(thread: ThreadState, sub: SubBaseline): number {
  const recent_velocity = thread.velocity.over_last_30min();  // comments/min
  const sub_typical = sub.commentsPerHour.mean / 60;
  return (recent_velocity - sub_typical) / sub.commentsPerHour.stddev;
}
```

Strong signal when velocity is >3σ above sub baseline.

### Signal 2: Sentiment swing

How much has sentiment shifted vs where it started?

```typescript
function sentimentSwing(thread: ThreadState): number {
  const initial = thread.sentiment.first_30min_avg();
  const recent = thread.sentiment.last_30min_avg();
  const swing = initial - recent;       // positive value = sentiment dropping
  return Math.max(0, swing);            // we only care about negative shifts
}
```

Strong signal when swing > 0.6 (e.g. started at +0.4, now at -0.2).

**Sentiment computation**: lightweight lexicon-based sentiment scoring — no need for ML or external APIs. A simple word-list scorer (positive words +1, negative words -1, normalized) is enough at this fidelity. Use AFINN-style word lists.

### Signal 3: New-account participation ratio

What fraction of commenters are new to this sub (could indicate brigade leakage or external attention)?

```typescript
function newAccountRatio(thread: ThreadState): number {
  const totalCommenters = thread.uniqueCommenters.size;
  const newCommenters = thread.newAccountCommenters;
  return newCommenters / max(1, totalCommenters);
}
```

Strong signal when ratio > 0.30.

### Signal 4: Report rate trajectory

How fast are user reports coming in?

```typescript
function reportRateZScore(thread: ThreadState, sub: SubBaseline): number {
  const recent_rate = thread.reportRate.over_last_15min() * 4;  // scale to per hour
  return (recent_rate - sub.reportRatePerHour.mean) / sub.reportRatePerHour.stddev;
}
```

Strong signal when reports are >5σ above sub baseline.

---

## Risk score computation

```typescript
function calculateThreadRisk(thread: ThreadState, sub: SubBaseline): {
  score: number;
  signals: { name: string; strength: number; details: string }[];
} {
  const v = velocityZScore(thread, sub);
  const s = sentimentSwing(thread);
  const n = newAccountRatio(thread);
  const r = reportRateZScore(thread, sub);

  // Normalize each to 0–1
  const sigVelocity = sigmoid(v - 3);          // centered at z=3
  const sigSentiment = clamp(s / 1.5, 0, 1);   // 1.5 swing = 100%
  const sigNewAcct = clamp(n / 0.5, 0, 1);     // 50% new = 100%
  const sigReports = sigmoid(r - 4);

  // Weighted combination
  const baseScore = (
    sigVelocity * 0.30 +
    sigSentiment * 0.25 +
    sigNewAcct * 0.20 +
    sigReports * 0.25
  );

  // Apply trajectory amplifier
  const trajectory = thread.riskHistory.slope_over_last_hour();
  const amplifier = trajectory > 0 ? 1 + min(trajectory, 0.3) : 1;

  const score = clamp(baseScore * amplifier * 100, 0, 100);

  return {
    score,
    signals: [
      { name: 'velocity', strength: sigVelocity, details: `${v.toFixed(1)}σ above baseline` },
      { name: 'sentiment', strength: sigSentiment, details: `swing of ${s.toFixed(2)}` },
      { name: 'new_accounts', strength: sigNewAcct, details: `${(n*100).toFixed(0)}% new` },
      { name: 'reports', strength: sigReports, details: `${r.toFixed(1)}σ above baseline` }
    ]
  };
}
```

**The trajectory amplifier is the key innovation.** A thread sitting at 50% risk that's stable is less concerning than a thread at 50% risk climbing fast. The amplifier captures this.

---

## Risk levels and dashboard color coding

| Score | Color | Label | Action |
|---|---|---|---|
| 0–30 | 🟢 green | Healthy | None — periodic re-check only |
| 31–60 | 🟡 amber | Elevated | Watch closely — refresh every 5min |
| 61–80 | 🟠 orange | High | Recommended action — surface in dashboard |
| 81–100 | 🔴 red | Critical | Alert — and modmail if opt-in |

---

## Forecast generation

Beyond current risk, Health Score projects forward.

```typescript
function forecast(thread: ThreadState, currentRisk: number): {
  in1Hour: { risk: number; commentsExpected: number };
  in2Hours: { risk: number; commentsExpected: number };
  ifMitigated: { risk1h: number; risk2h: number };
} {
  const trajectory = thread.riskHistory.slope_over_last_hour();
  const velocity = thread.velocity.over_last_30min();

  // Linear extrapolation of risk + velocity
  const projected1h = clamp(currentRisk + trajectory * 60, 0, 100);
  const projected2h = clamp(currentRisk + trajectory * 120, 0, 100);

  // If slow mode were enabled (velocity drops 70%)
  const mitigatedTrajectory = trajectory * 0.3;
  const mitigated1h = clamp(currentRisk + mitigatedTrajectory * 60, 0, 100);
  const mitigated2h = clamp(currentRisk + mitigatedTrajectory * 120, 0, 100);

  return {
    in1Hour: { risk: projected1h, commentsExpected: velocity * 60 },
    in2Hours: { risk: projected2h, commentsExpected: velocity * 120 },
    ifMitigated: { risk1h: mitigated1h, risk2h: mitigated2h }
  };
}
```

This produces the "Without intervention vs With slow mode" panel in the dashboard.

---

## Watching scope

Not every thread is worth scoring. Select watched threads as:
- All threads with comments in the last 6 hours
- Plus any thread mods have explicitly pinned to the watch list
- Maximum 50 threads per sub at any time (most-recent if overflow)

Older threads are dropped from the active watch set but their final scores are preserved in the audit log.

---

## When the engine runs

- **Every CommentSubmit on a watched thread** (debounced to once per 5 sec per thread)
- **Every PostReport / CommentReport** in a watched thread
- **Every 5 minutes** as a scheduled scan of all watched threads
- **On demand** when the dashboard is opened

---

## Dashboard panel for Health Score

The pinned mod-only post has a Health Score section that shows:

### Section A: Triage queue
List of all watched threads, sorted by current risk score, color-coded:

```
🔴 89%  Why does this policy keep getting passed...    487 cmts · 3h
🟠 78%  AITA for kicking my brother out...             203 cmts · 2h
🟡 42%  Daily discussion thread - Tuesday              156 cmts · 8h
🟢 12%  Sunset photo from my balcony                    89 cmts · 5h
```

### Section B: Selected thread detail
When mod clicks a thread:

- Big risk gauge (matches mockup design)
- Risk trajectory chart (last 3 hours)
- Signal breakdown (which 4 are firing, how strongly)
- Forecast box (with vs without intervention)
- Action buttons (Lock, Slow Mode, Filter New Accts, Dismiss)

### Section C: Calibration
- Model accuracy this month (calculated against actual mod actions)
- False positive rate
- Average early warning

These are real numbers, refreshed daily. Critical for trust.

---

## False positive handling

When mods click "False positive" on Health Score alerts:
- Logged to calibration data
- This thread's signals get weighted down for similar future threads in this sub
- After 10 dismissals, threshold raised (less sensitive)

But also: **mods can mark "actually was a problem" on threads Health Score did NOT alert on.** This is the negative-feedback loop — it tells the engine its sensitivity is too low.

---

## Edge cases

- **Megathread (intentionally high-velocity)**: mod adds it to the exempt list in advanced settings. Health Score skips it. ✅
- **AMA in progress**: same as megathread — mod adds to exempt list. Or use post flair filter (advanced setting). ✅
- **Slow-burn drama** (taking 8 hours to escalate): Health Score handles this naturally — trajectory amplifier keeps boosting score over time. ✅
- **Thread crosses risk threshold and then drops** (e.g. mods successfully slow it down): risk decline is logged. Calibration data records "intervention worked." Future similar threads benefit. ✅
- **Thread alerts at 89% but mods don't act**: not a bug. The dashboard surfaces it for awareness; not every high-risk thread requires action. The metric to optimize is "mods see it before it's a disaster," not "every alert produces an action." ✅

---

## Performance budget

- Per-thread evaluation: <50ms
- Storage per watched thread: <10KB
- 50 threads × 10KB = 500KB max per sub at any time. Well within Devvit limits.

---

## Demo scenario for Health Score

In your test sub:

1. Create a controversial-looking post via alt account (e.g. "Why does X always Y?").
2. Have 4-5 alts post comments at staggered intervals over 30 minutes — increasingly confrontational, with increasing report rates.
3. Show the dashboard time-lapse: risk climbing 22% → 31% → 58% → 78% → 89% over the 30-minute span.
4. Show the forecast: "Without intervention, predicted to hit 95% in 90 min. With slow mode, predicted to peak at 51% then decline."
5. Mod clicks "Enable slow mode."
6. Show the score start descending over the next 10 minutes of demo.

Total demo time: ~15 seconds (with timelapse). Demonstrates prediction working AND intervention working.
