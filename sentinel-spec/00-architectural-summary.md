# 00 · Architectural Summary

## Mission

Sentinel is a unified threat-intelligence platform for subreddit moderators that combines three detection engines (Raid Radar, Memory, Health Score) on shared behavioral infrastructure. It shifts moderation from reactive cleanup to predictive intervention: detecting brigades within ~90 seconds, identifying ban evaders via stylometry + behavior, and predicting thread escalation 1–2 hours ahead. For mods of 10K–500K member communities, it transforms 8–12 hours of weekly triage into focused, reversible actions.

## Three Engines

### Raid Radar
- **Inputs:** Comment timestamps, account creation dates, user sub overlap, comment inter-arrival times per thread
- **Signals:** New-user influx z-score (>4σ), account-age clustering (median <30d, entropy <0.5), sub-overlap concentration (>70%), synchronized timing (sync_score >0.85). Requires ≥2 signals firing.
- **Scoring:** Confidence = weighted average of signal strengths; 4 signals × full strength = 1.0
- **Output:** Alert (severity: critical if conf >0.9, else high) + thread-detail panel with cluster graph + signal breakdown

### Memory
- **Inputs:** Per-user posting times, comment lengths, sub overlap, stylometry (sentence length, punctuation, n-grams, emoji, vocabulary), banned-user fingerprint index
- **Signals:** Behavioral similarity (0–1, threshold >0.65) + Stylometry similarity (0–1, threshold >0.75). Combined score = 0.4×behav + 0.6×style; requires both >threshold AND combined >0.78.
- **Scoring:** Requires suspect <12mo old AND ≥10 comment samples to evaluate; dual-signal guard prevents single-signal false positives
- **Output:** User Spotlight panel with confidence range, reason breakdown, side-by-side fingerprint comparison (smoking-gun view)

### Health Score
- **Inputs:** Comments/minute per thread, sentiment per 5-min bucket, new-account commenter ratio, reports/minute, risk trajectory over last hour
- **Signals:** Velocity z-score (baseline-relative; strong >3σ), sentiment swing (0–1, strong >0.6), new-account ratio (0–1, strong >0.30), report-rate z-score (strong >5σ)
- **Scoring:** Base = 0.30×sig(vel-3) + 0.25×clamp(senti/1.5,0,1) + 0.20×clamp(accts/0.5,0,1) + 0.25×sig(rpts-4); amplified by trajectory (1 + min(slope,0.3) if rising)
- **Output:** Risk score (0–100) + triage queue + signal bars + forecast (1h, 2h, with-mitigation) + risk gauge

## Shared Infrastructure

- **Event ingestion module:** Single point of entry for all Devvit triggers (PostSubmit, CommentSubmit, ModAction, Report); feeds into behavioral graph; debounced engine re-evaluation (5s per thread)
- **Bootstrap process:** Fetch last 14 days on install; backfill baselines, fingerprints, thread states; mark completion after 7-day calibration ramp
- **Storage primitives:** `RollingStat` (Welford's O(1) mean/stddev), `TimeSeries` (288 5-min buckets, ring buffer), `Histogram` (bucketed distributions)
- **Alert dispatcher:** Atomic persistence to KV + dashboard update (debounced) + modmail (if critical) + audit-log entry
- **Mod actions:** `performModAction()` wrapper (thread lock, slow mode, filter new accts, remove post, ban user) + `revertModAction()` within 24h revert window
- **Audit log:** Append-only list (capped 1000 entries, 30-day retention); every action reversible, reason recorded, mod-attribution
- **Calibration loop:** Per-sub dismissal tracking; 3 dismissals same signal type → +10% threshold; 10 total → suggest sensitivity downgrade

## Storage Schema

| Key | Content |
|---|---|
| `sentinel:baseline` | SubBaseline: rolling stats (comments/h, posts/h, unique commenters, new accts, reports, sentiment), account-age histogram, top overlapping subs |
| `sentinel:user:{userId}` | UserFingerprint: behavioral (posting-time histogram, comment-length dist, frequency), stylometry (sentence length, punctuation, capitalization, emoji, n-grams, vocabulary), sub overlap, mod history, last 100 comments |
| `sentinel:thread:{postId}` | ThreadState: live counters (comments, unique commenters, new-acct commenters, reports), 5-min time series (velocity, sentiment, reports), current risk score + history |
| `sentinel:alert:{alertId}` | Alert: engine, severity, signals snapshot, confidence, target, status (open/actioned/dismissed/false_positive), revertible until +24h |
| `sentinel:alerts:open` | Sorted set by time, alertId values |
| `sentinel:alerts:by_target:{targetId}` | Set of alertIds for quick lookup by thread/user/sub |
| `sentinel:settings` | SubSettings: master toggle, per-engine sensitivity, alert channels, advanced (baseline window, quiet hours, exempts, custom thresholds) |
| `sentinel:audit_log` | List: audit entries (mod, action, target, timestamp, revert metadata) |
| `sentinel:calibration` | CalibrationData: dismissal counts per signal type per sub; accuracy estimates |
| `sentinel:memory:banned_index` | Map: userId → summary UserFingerprint for fast comparison on new account |

## Critical Thresholds

| Threshold | Value | Context |
|---|---|---|
| **Raid Radar Signal 1 (influx z-score)** | >4σ | New commenters last 5min vs baseline |
| **Raid Radar Signal 2 (age clustering)** | median <30d AND entropy <0.5 | New arrivals homogeneous in age |
| **Raid Radar Signal 3 (sub overlap)** | >70% | New arrivals share external sub |
| **Raid Radar Signal 4 (sync timing)** | sync_score >0.85 | Inter-arrival timing correlation |
| **Raid Radar confidence (Low/Med/High)** | 0.85 / 0.75 / 0.65 | Alert threshold, per sensitivity |
| **Raid Radar auto-action threshold** | 0.85 / 0.80 (if High sens) | Fires slow mode / filter if opted in |
| **Memory behavioral match** | >0.65 | Behavioral similarity floor |
| **Memory stylometry match** | >0.75 | Style similarity floor |
| **Memory combined match** | >0.78 AND both >floor | Dual-signal requirement |
| **Memory age cutoff** | <12 months | Suspect must be young account |
| **Memory sample size** | ≥10 comments | Sufficient text for fingerprint |
| **Health Score velocity** | z >3σ | Above-baseline comment rate |
| **Health Score sentiment swing** | >0.6 | Negative shift magnitude |
| **Health Score new-acct ratio** | >0.30 | Fraction of commenters <30d old |
| **Health Score report rate** | z >5σ | Above-baseline reporting |
| **Bootstrap window** | 14 days | Historical backfill on install |
| **Retention (inactive)** | 90 days | Age-out user fingerprints (unless banned) |
| **Retention (banned)** | permanent | Never age out banned-user profiles |
| **Revert window** | 24 hours | Undo period for mod actions |
| **Debounce interval** | 5 seconds per thread | Engine re-evaluation frequency |
| **Calibration ramp** | 7 days | "Still learning" banner; conserve confidence 0.85×, critical floor 0.92 |
| **Watched threads (max)** | 50 per sub | Most-recent if overflow |
| **Forecast horizon** | 1h, 2h | Forward projection of risk |

## Hard Constraints / Non-Features

- ❌ **No machine learning.** Deliberately statistical (baseline + z-scores + anomaly). No training data, no inference cost, fully explainable.
- ❌ **No external databases.** Devvit Redis only. Bounded storage, no ops overhead, "well-behaved citizen" pattern.
- ❌ **No auto-banning, no auto-removal.** Only reversible thread-level soft actions (slow mode, new-account filter). Bans and removals are mod-only, never auto.
- ❌ **No maker-checker workflows.** First-mod-wins + audit log + 24h revert. No approval queues (brigades don't wait).
- ❌ **No pre-tuned sub archetypes.** Each sub learns its own baseline. No support burden of template maintenance.
- ❌ **No Discord/Slack webhooks.** Avoids external dependency. Devvit modmail covers critical escalation.
- ❌ **No public-facing analytics.** No monthly transparency reports or public dashboards. Calibration health visible to mods only.
- ❌ **No real-time websocket updates.** Polling every 30s on dashboard open is sufficient.

## Build Order (8 Milestones)

1. **Foundation (1–3d):** Event ingestion, behavioral graph, KV schema, statistical primitives, bootstrap job, settings storage, welcome modal
2. **Dashboard skeleton (1–2d):** Pinned post creation, tabs (Threats/Users/Threads/Activity/Settings), KPI tiles, settings UI
3. **Alert dispatcher + audit log (1d):** `dispatchAlert()`, audit-log structure, `performModAction()` / `revertModAction()`, Activity Log tab
4. **Raid Radar (3–5d):** Four signal computations, confidence calc, debounced evaluation, cluster visualization, action buttons, false-positive loop — **core demo video footage**
5. **Health Score (3–5d):** Four signal computations, sentiment lexicon, risk + forecast, triage queue, watched-thread management, calibration stats
6. **Memory engine (4–6d):** Behavioral + stylometry fingerprinting, banned-user index, dual-signal matching, User Spotlight, side-by-side view, mod menu items
7. **Polish + edge cases (2–3d):** Performance budgets, test scenarios, settings round-trip, error handling, mobile layout, calibration banner, visual alignment
8. **Demo prep (1–2d):** Test sub, demo video per spec, app listing, Devpost submission, screenshots

## Demo Flow

- **[0–10s] Setup:** Problem framing (mods notice brigades 2h too late) + Sentinel logo + capability intro
- **[10–35s] Raid Radar core:** Brigade hits, dashboard pulses red, cluster graph populates, 89% confidence, 38 accounts from r/external in 90s detected. Mod clicks defender → side-panel shows Memory match (94% style). Mod clicks Slow Mode + Filter → cluster fades red→amber, thread velocity drops, risk 89%→65%.
- **[35–50s] Health Score supporting:** Different thread, risk climbing 22%→31%→58%→78% over timelapse. Forecast: "projected 95% in 90min; with slow mode → peak 51%." Mod intervenes early, score descends.
- **[50–60s] Close:** Full dashboard three-engine section visible. "One platform. Three engines." Install CTA (developers.reddit.com/apps/sentinel).

## Open Questions

1. **UI mockup externality:** Files `tier_s_mockups.html` and `sentinel_demos.html` are referenced in 06 as reference implementations but never provided. Are these deliverables or external design docs?
2. **Sentiment lexicon specificity:** Section 05 references "AFINN-style word lists" but doesn't specify which exact list (English AFINN vs variant) or how to handle domain-specific sentiment (subreddit language varies widely).
3. **Cold-start signal defaults:** Raid Radar notes "pre-tuned cold-start defaults for first 7 days" when baseline incomplete, but specific default z-score thresholds are never enumerated. Is it fixed, or derived from Reddit-wide stats?
4. **Slow-mode velocity assumption:** Health Score forecast assumes "slow mode drops velocity by 70%," but this isn't validated against actual Devvit slow-mode behavior. What if real impact differs?
5. **Account-age entropy cutoff validation:** Signal 2 (age clustering) fires at entropy <0.5 for age distribution — is this value tuned against real brigades or conservative guess? How sensitive is detection to this threshold?
