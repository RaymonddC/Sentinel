# 03 · Raid Radar Engine

## Changelog

- **R-Sub-Overlap-Cap** (plan-review v4 § R-Sub-Overlap-Cap): Documented 100-item cross-sub history hard cap for Signal 3; rewrote signal description and fire-condition to reflect data-source ceiling; added edge-case note on cap-bounded infiltration visibility.
- **R-Cluster-Graph** (plan-review v4 § R-Cluster-Graph): Cluster visualization updated to lazy-load on alert detail open, cap rendering at ≤20 nodes with "+N more" badge, fixed-height container (320 px), and ≤2 MB cluster-state cache writes.

> Detects coordinated brigades and external raids in real-time. Fires within ~90 seconds of attack onset.

---

## What it detects

A "brigade" or "raid" is when a group of users from another community arrives at a target thread together to overwhelm normal discussion — usually via downvoting, hostile comments, or coordinated reporting. Examples:

- 30 accounts arriving in 90 seconds, 90% from the same external sub
- Cluster of new accounts (under 30 days old) suddenly active in the same thread
- Synchronized voting patterns from accounts that never visit this sub

What Raid Radar is **not** detecting:
- A naturally viral thread (high traffic from diverse, regular users)
- Spam (single-account, non-coordinated) — that's AutoMod's job
- Abuse from individual users — that's Memory's territory

---

## Detection signals (4 statistical signals stacked)

Raid Radar evaluates these continuously per thread:

### Signal 1: New-user influx z-score

How many users new to this sub have arrived in the last 5 minutes vs baseline?

```
incoming = count(commenters_last_5min where firstSeenInSub > now - 5min)
zscore = baseline.uniqueCommentersPerHour.zScore(incoming * 12)  // scale to per-hour
```

Fires when `zscore > 4` (4 standard deviations above normal).

### Signal 2: Account-age clustering

Are the new arrivals suspiciously homogeneous in age?

```
new_arrivals = commenters from last 5min who never commented here before
ages = new_arrivals.map(u => now - u.accountCreatedAt)
median_age = median(ages)
age_entropy = histogram(ages).entropy()
```

Fires when `median_age < 30 days` AND `age_entropy < 0.5` (low diversity = likely throwaway cluster).

### Signal 3: Sub-overlap concentration

Across new arrivals' last 100 cross-sub comments, what fraction share a single external sub? Cross-sub history is fetched via `context.reddit.getCommentsAndPostsByUser({limit: 100, pageSize: 100, sort: "new"})` — hard-capped at 100 items per user by Devvit data-source design (research/06 § Cross-Sub User History).

```
top_shared_sub, share_pct = mostCommonOtherSub(new_arrivals)
```

Fires when `share_pct > 70%`.

### Signal 4: Synchronized timing

Are the comments arriving in suspiciously synchronous bursts?

```
inter_arrival_gaps = diff(comment_times)
gap_stddev = stddev(inter_arrival_gaps)
gap_mean = mean(inter_arrival_gaps)
sync_score = 1 - (gap_stddev / gap_mean)  // closer to 1 = more synchronous
```

Fires when `sync_score > 0.85`.

---

## Confidence calculation

Each signal contributes to a confidence score based on how many fire and how strongly.

```typescript
function calculateBrigadeConfidence(thread: ThreadState, sub: SubBaseline): number {
  const signals = [
    influxZScore(thread, sub),
    accountAgeClusterScore(thread),
    subOverlapScore(thread),
    syncTimingScore(thread)
  ];

  // Each signal returns 0–1
  const firedSignals = signals.filter(s => s > 0.5);
  const avgStrength = mean(signals);

  if (firedSignals.length < 2) return 0;        // need at least 2 signals
  if (firedSignals.length === 2) return avgStrength * 0.7;
  if (firedSignals.length === 3) return avgStrength * 0.85;
  return avgStrength;                           // all 4 firing = full confidence
}
```

**Why "at least 2 signals":** Single-signal detection is too noisy. A sudden popular thread can spike new-user influx (Signal 1) without being a brigade. But a brigade exhibits at least 2 signals simultaneously — that's the definition.

---

## Alert thresholds (tunable per sub)

| Sensitivity | Confidence threshold | Auto-action threshold |
|---|---|---|
| Low | 0.85 (high-precision) | n/a |
| Medium | 0.75 | 0.85 (if opt-in) |
| High | 0.65 (high-recall) | 0.80 (if opt-in) |

Default = Medium. Adjustable via tiered settings.

---

## Engine logic

Pseudocode for the main evaluation loop:

```typescript
async function evaluateThreadForBrigade(threadId: string): Promise<void> {
  const thread = await loadThread(threadId);
  const baseline = await loadSubBaseline();

  // Skip if baseline isn't ready yet
  if (!baseline.bootstrapComplete && ageOfBaseline() < 1.day) return;

  const confidence = calculateBrigadeConfidence(thread, baseline);
  const settings = await loadSettings();
  const threshold = settings.engines.raidRadar.thresholds[settings.engines.raidRadar.sensitivity];

  if (confidence < threshold) return;

  // Build alert
  const alert: Alert = {
    alertId: generateId(),
    subId: thread.subId,
    engineName: 'raid_radar',
    severity: confidence > 0.9 ? 'critical' : 'high',
    triggeredAt: Date.now(),
    signals: snapshotAllSignals(thread, baseline),
    confidence,
    targetType: 'thread',
    targetId: threadId,
    status: 'open',
    revertibleUntil: 0
  };

  await dispatchAlert(alert);

  // Auto-action if configured AND confidence high enough
  if (settings.engines.raidRadar.autoActions.enableSlowMode &&
      confidence > settings.engines.raidRadar.autoActionThreshold) {
    await performModAction({
      alertId: alert.alertId,
      modUsername: 'sentinel-bot',
      action: 'enable_slow_mode',
      target: { type: 'thread', id: threadId },
      parameters: { intervalSeconds: 300 }
    });
  }
}
```

---

## When it runs

- **On every CommentSubmit** in a watched thread (debounced to once per 5 seconds per thread)
- **Every 5 minutes** as a scheduled scan of all active threads
- **On-demand** when a mod opens the dashboard

---

## Dashboard panel for Raid Radar

The pinned mod-only post has a Raid Radar section that shows:

### Top: Threat overview
- "🚨 ACTIVE BRIGADE DETECTED" header (red) when alert active
- "✅ All clear" header (green) when no active alerts
- Confidence score for active alert

### Middle: Cluster visualization
A simplified node graph (rendered as SVG via Devvit Blocks). Lazy-loaded — renders only after the user explicitly opens an alert's detail view. Capped at ≤20 nodes; remaining accounts collapsed into a "+N more accounts" badge. Fixed-height container (320 px) to prevent layout shift. Rendered structure cached in app memory keyed by alertId; cluster-state cache writes chunked to ≤2 MB.
- Center node: the target thread
- Surrounding nodes: suspicious accounts (≤20 displayed)
- Edge connections: shared external sub
- Color-coding: red = >0.9 confidence cluster, orange = 0.7–0.9, yellow = monitoring

### Bottom: Signal breakdown
Show which of the 4 signals fired and how strongly:

```
✓ New-user influx       +717%   z=6.2
✓ Account-age cluster   ←lowdiv  median 6d
✓ Sub overlap           94%     r/external
✓ Sync timing           σ=0.91
```

### Action buttons
- 🔒 Lock thread
- ⏱️ Enable slow mode (5min)
- 🔍 Filter new accounts
- 📨 Notify mod team
- ✓ False positive

---

## False positive handling

When mods click "False positive" on a Raid Radar alert:

1. Log dismissal to `sentinel:calibration` for this signal type
2. Increment per-signal dismissal counter
3. After 3 dismissals on the same signal in 7 days, raise that signal's threshold by 10% for THIS sub
4. After 10 dismissals total, dashboard suggests raising sensitivity preset to Low

This is the "learn from mods without ML" loop.

---

## Edge cases the engine must handle

- **Sub goes legitimately viral** (front page) → high traffic, but diverse accounts. Signals 2 and 3 should NOT fire (entropy is high, no shared sub). If only Signal 1 fires, no alert. ✅
- **Coordinated by ONE existing user with sock puppets** → Memory engine catches this, not Raid Radar. ✅
- **Slow infiltration** (1 attacker per hour for 30 hours) → Raid Radar misses. This is by design — it's not a "brigade" in the cinematic sense. Health Score may catch the resulting thread escalation. ✅
- **Cross-sub history limited to 100 items** → Slow infiltration spanning more than ~100 cross-sub comments per attacker is invisible to Signal 3; Memory's stylometry layer is the secondary catch. ✅
- **Fresh install, no baseline yet** → Engine uses pre-tuned cold-start defaults for first 7 days, with banner "Detection active, accuracy improving." ✅
- **Watched thread is locked/archived** → Stop evaluating. Mark thread as not-watched. ✅

---

## Performance budget

- Each evaluation: <100ms wall clock
- Memory per thread: <5KB
- Storage growth per sub per day: <1MB

If any of these are exceeded, the bottleneck is almost certainly redundant fingerprint loading. Cache user fingerprints in-process during a single evaluation pass.

---

## Test scenarios for the demo sub

You'll want these scripted using your alt accounts:

1. **The hero brigade**: 8 alts arrive in 60 seconds, all from a fake "external" sub. Should fire critical alert within 90 seconds.
2. **The slow burn**: 1 alt every few minutes for 30 minutes. Should NOT fire (this is the negative test).
3. **Viral but legit**: 8 different real-style accounts comment naturally. Should NOT fire (low overlap, high age diversity).
4. **The half-brigade**: 5 new accounts but no sub overlap. Should fire MEDIUM, not CRITICAL.

Build all four into your test sub. They become the foundation of the demo video.
