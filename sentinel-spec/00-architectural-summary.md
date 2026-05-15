# 00 · Architectural Summary

## Changelog

v2 refresh — 2026-05-13. Reflects all Phase 2 Wave 2.1–2.3 spec revisions driven by `00-plan-review.md` v4. Primary changes: bootstrap replaced with P1/P2/P3 three-pattern hybrid (14-day fetch was infeasible); rolling stats pinned to Welford-with-decay for volatile signals (M_MAX_HOURLY=336, M_MAX_5MIN=4032) and full-history Welford for slow-changing signals — "rolling 14d" framing dropped; storage schema updated — no standard Sets in Devvit Redis (sorted-set-as-set for `alerts:open`, hash-as-set for `alerts:by_target`); banned_index restructured to per-user keys (`banned:{userId}`) + sorted-set enumeration (`banned_ids`) for 5 MB per-request cap compliance; `dispatchAlert` revised to WATCH/MULTI/EXEC transaction (TxClientLike confirmed) + 7-step idempotent replay; debounce documented as KV compare-and-set (5s soft floor); vocabulary type changed to `Map<string,number>` (top-2000 cap); histogram bucket schemas pinned with histogram-intersection overlap formula; Health Score lexicon pinned to AFINN-2015-en + 30-entry emoji extension table; slow-mode velocity impact made configurable (default 0.70, pending E-SlowMode empirical validation); cross-sub history cap (100 items) documented for Signal 3 and Memory subOverlap; demo framing changed to calibrated-test-sub with formal pre-seeding checklist; build plan Phase 0 empirical spike added; `baselineWindowDays` removed from advanced settings.

## Mission

Sentinel is a unified threat-intelligence platform for subreddit moderators that combines three detection engines (Raid Radar, Memory, Health Score) on shared behavioral infrastructure. It shifts moderation from reactive cleanup to predictive intervention: detecting brigades within ~90 seconds, identifying ban evaders via stylometry + behavior, and predicting thread escalation 1–2 hours ahead. For mods of 10K–500K member communities, it transforms 8–12 hours of weekly triage into focused, reversible actions.

## Three Engines

### Raid Radar
- **Inputs:** Comment timestamps, account creation dates, user sub overlap (last 100 cross-sub comments per user — hard cap by Devvit API design), comment inter-arrival times per thread
- **Signals:** New-user influx z-score (>4σ), account-age clustering (median <30d, entropy <0.5), sub-overlap concentration (>70% across new arrivals' last 100 cross-sub items), synchronized timing (sync_score >0.85). Requires ≥2 signals firing.
- **Scoring:** Confidence = weighted average of signal strengths; 4 signals × full strength = 1.0
- **Output:** Alert (severity: critical if conf >0.9, else high) + thread-detail panel with cluster graph (lazy-loaded, ≤20 nodes, 320px fixed height) + signal breakdown

### Memory
- **Inputs:** Per-user posting times, comment lengths, sub overlap (last 100 cross-sub comments; older activity invisible by data-source design), stylometry (sentence length, punctuation, character trigrams, emoji, vocabulary as `Map<string,number>` capped at top-2000), banned-user fingerprint index
- **Signals:** Behavioral similarity (0–1, threshold >0.65; posting-time + comment-length histograms via histogram intersection + sub Jaccard + frequency) + Stylometry similarity (0–1, threshold >0.75; cosine on L2-normalized numeric vector + Jaccard on preprocessed trigrams + emoji histogram intersection). Combined = 0.4×behav + 0.6×style; both must exceed floor AND combined >0.78.
- **Scoring:** Requires suspect <12mo AND ≥10 comments to evaluate. Cold-start: reports "No ban history yet" until first ban action. Optional Mod Notes integration (v1, opt-in): seed banned-index from `getModNotes({filter:'BAN'})` at install; write summary via `addModNote` on each new ban. API is fully public in `@devvit/public-api`.
- **Output:** User Spotlight panel with confidence range, reason breakdown, side-by-side fingerprint comparison (smoking-gun view)

### Health Score
- **Inputs:** Comments/minute per thread, sentiment per 5-min bucket (AFINN-2015-en + 30-entry emoji extension table; neutral fallback (0) for unknown tokens; non-English subs receive degraded accuracy), new-account commenter ratio, reports/minute, risk trajectory over last hour
- **Signals:** Velocity z-score (strong >3σ), sentiment swing (strong >0.6), new-account ratio (strong >0.30), report-rate z-score (strong >5σ)
- **Scoring:** Base = 0.30×sig(vel-3) + 0.25×clamp(senti/1.5,0,1) + 0.20×clamp(accts/0.5,0,1) + 0.25×sig(rpts-4); amplified by trajectory (1 + min(slope,0.3) if rising). Slow-mode velocity impact: configurable `slowModeVelocityImpact` (default 0.70, pending E-SlowMode empirical validation).
- **Output:** Risk score (0–100) + triage queue + signal bars + forecast (1h, 2h, with-mitigation) + risk gauge

## Shared Infrastructure

- **Event ingestion module:** Single point of entry for all Devvit triggers (PostSubmit, CommentSubmit, ModAction, Report); feeds behavioral graph; debounces engine re-evaluation via KV compare-and-set (`get lastEval; if now-last < 5000 skip; else set now` — soft floor, concurrent handlers may race)
- **Bootstrap process:** Three-pattern hybrid — (P1) top-1000 hot posts at install, indexed into SubBaseline + UserFingerprint records (<50 API calls, <2 min, non-blocking); (P2) all engines run reactively on every incoming event from t=0; (P3) hourly scheduled backfill during 7-day calibration ramp (≤50 API calls per job, within 60 runJob/min ceiling). bootstrapComplete flips after ramp.
- **Storage primitives:** `RollingStat` in two modes — Welford-with-decay (volatile signals: M_MAX_HOURLY=336, M_MAX_5MIN=4032; EWMA-equivalent at saturation) and full-history Welford (slow-changing signals: account-age dist, new-account ratio). `TimeSeries` (288 5-min buckets, ring buffer). `Histogram` (pinned schemas: posting-time 24 buckets, account-age 10 buckets, comment-length 5 buckets; overlap formula: histogram intersection over normalized buckets).
- **Alert dispatcher:** WATCH/MULTI/EXEC transaction for steps 1–3 (persist alert + zAdd to `alerts:open` + hSet to `alerts:by_target`). Steps 4–7 (audit-log append, dashboard update, modmail if critical, dispatchState=complete) are idempotent and keyed by alertId, safe for crash-recovery replay. Every-5-min scheduler scan replays alerts where dispatchState === 'pending'.
- **Mod actions:** `performModAction()` wrapper + `revertModAction()` within 24h revert window. Auto-actions (slow mode, new-account filter) opt-in only. Bans and removals are mod-initiated only; never auto.
- **Audit log:** Append-only list (capped 1000 entries, 30-day retention); every action attributable, reason recorded, revert metadata preserved.
- **Calibration loop:** Per-sub dismissal tracking; 3 dismissals same signal type → +10% threshold; 10 total → suggest sensitivity downgrade.

## Storage Schema

| Key | Type | Content |
|---|---|---|
| `sentinel:baseline` | JSON | SubBaseline: online stats (Welford-with-decay for volatile; full-history for slow-changing), account-age histogram, top overlapping subs |
| `sentinel:user:{userId}` | JSON | UserFingerprint: behavioral profile, stylometry (vocab Map<string,number> top-2000, trigrams, emoji), sub overlap last-100, mod history, last 100 comments |
| `sentinel:thread:{postId}` | JSON | ThreadState: live counters, 5-min time series (velocity, sentiment, reports), current risk score + history |
| `sentinel:alert:{alertId}` | JSON | Alert: engine, severity, signals snapshot, confidence, target, status (open/actioned/dismissed/false_positive), revertibleUntil +24h |
| `sentinel:alerts:open` | SortedSet | alertIds; score = createdAtMs. sorted-set-as-set via zAdd/zRange. |
| `sentinel:alerts:by_target:{targetId}` | Hash | alertId → '1'. hash-as-set via hSet/hGet/hGetAll. |
| `sentinel:settings` | JSON | SubSettings: master toggle, per-engine sensitivity, alert channels, advanced (slowModeVelocityImpact, quiet hours, exempts, custom thresholds) |
| `sentinel:audit_log` | List | AuditEntries (capped 1000, 30-day retention) |
| `sentinel:calibration` | JSON | Dismissal counts per signal type; accuracy estimates |
| `sentinel:memory:banned:{userId}` | JSON | Per-user BannedFingerprint summary (~400–750 bytes). Per-user key for 5 MB cap compliance. |
| `sentinel:memory:banned_ids` | SortedSet | userId members; score = bannedAt. Enumeration index for banned-user iteration. |

> Devvit Redis does not support standard Sets (SADD/SMEMBERS), key enumeration (KEYS/SCAN), pipelining, or Lua scripts. Use sorted-set-as-set (score = timestamp) or hash-as-set (value = '1'). 5 MB max per request — all keys are entity-bounded; banned_index restructured to per-user keys to prevent oversize writes at scale.

## Critical Thresholds

| Threshold | Value | Context |
|---|---|---|
| **Raid Radar Signal 1 (influx z-score)** | >4σ | New commenters last 5min vs baseline |
| **Raid Radar Signal 2 (age clustering)** | median <30d AND entropy <0.5 | New arrivals homogeneous in age |
| **Raid Radar Signal 3 (sub overlap)** | >70% | Fraction sharing one external sub; from last 100 cross-sub items per user |
| **Raid Radar Signal 4 (sync timing)** | sync_score >0.85 | Inter-arrival timing correlation |
| **Raid Radar confidence (Low/Med/High)** | 0.85 / 0.75 / 0.65 | Alert threshold, per sensitivity |
| **Raid Radar auto-action threshold** | 0.85 / 0.80 (High sens) | Fires slow mode / filter if opted in |
| **Memory behavioral match** | >0.65 | Behavioral similarity floor |
| **Memory stylometry match** | >0.75 | Style similarity floor |
| **Memory combined match** | >0.78 AND both >floor | Dual-signal requirement |
| **Memory age cutoff** | <12 months | Suspect must be young account |
| **Memory sample size** | ≥10 comments | Sufficient text for stable fingerprint |
| **Memory vocabulary cap** | top-2000 words (Map<string,number>) | Drop lowest-freq 500 when map exceeds 2500 entries |
| **Cross-sub history cap** | 100 items per user | Hard cap via getCommentsAndPostsByUser; affects Signal 3 and subOverlap |
| **Health Score velocity** | z >3σ | Above-baseline comment rate |
| **Health Score sentiment swing** | >0.6 | Negative shift magnitude (AFINN-2015-en + emoji extension table) |
| **Health Score new-acct ratio** | >0.30 | Fraction of commenters <30d old |
| **Health Score report rate** | z >5σ | Above-baseline reporting |
| **Slow-mode velocity impact** | 0.70 default, configurable | Forecast reduction factor; pending E-SlowMode empirical validation |
| **RollingStat M_MAX (hourly)** | 336 (14d × 24h) | Welford-with-decay cap for volatile hourly signals |
| **RollingStat M_MAX (5-min)** | 4032 (14d × 288) | Welford-with-decay cap for volatile 5-min signals |
| **Bootstrap** | P1 top-1000 hot + P2 reactive + P3 7d progressive backfill | Replaces 14-day fetch; live from install, accuracy improves over 7-day ramp |
| **Retention (inactive users)** | 90 days | Age-out fingerprints with no mod actions |
| **Retention (banned users)** | Permanent | Never age out banned-user profiles |
| **Revert window** | 24 hours | Undo period for mod actions |
| **Debounce interval** | 5 seconds, soft floor (KV CAS) | Engine re-evaluation frequency per thread |
| **Calibration ramp** | 7 days | Conservative confidence 0.85×, critical floor 0.92; auto-actions suppressed |
| **Watched threads (max)** | 50 per sub | Most-recent if overflow |
| **Forecast horizon** | 1h, 2h | Forward projection of risk |

## Hard Constraints / Non-Features

- No machine learning. Deliberately statistical (baseline + z-scores + anomaly detection). No training data, no inference cost, fully explainable.
- No external databases. Devvit Redis only. Bounded per-entity storage, no ops overhead.
- No auto-banning, no auto-removal. Only reversible thread-level soft actions (slow mode, new-account filter). Bans and removals are mod-only, never auto.
- No maker-checker workflows. First-mod-wins + audit log + 24h revert. No approval queues (brigades don't wait).
- No pre-tuned sub archetypes. Each sub learns its own baseline via Welford accumulation from install.
- No Discord/Slack webhooks. Avoids external dependency. Devvit modmail covers critical escalation.
- No public-facing analytics. No monthly transparency reports or public dashboards. Calibration health visible to mods only.
- No real-time websocket updates. Dashboard polls every 30s on open.

## Build Order (Phase 0 + 8 Milestones)

0. **Phase 0 — Empirical spike (1d):** Retire remaining runtime unknowns before Milestone 1 begins: E-SchedulerTimeout (per-job time + memory limit; pass/fail ≥5 min), E-RedisThrottle (40K cmds/sec overrun behavior), E-SlowMode (velocity reduction measurement; pass/fail within ±20% of 0.70 default). Block Milestone 1 parameter lock on results. Record in `research/09-runtime-probes.md`.
1. **Foundation (1–3d):** Event ingestion, behavioral graph, KV schema, statistical primitives (RollingStat with M_MAX constants, TimeSeries, Histogram with pinned bucket schemas), three-pattern bootstrap job, settings storage, welcome modal
2. **Dashboard skeleton (1–2d):** Pinned post creation, tabs (Threats/Users/Threads/Activity/Settings), KPI tiles, settings UI
3. **Alert dispatcher + audit log (1d):** `dispatchAlert()` with WATCH/MULTI/EXEC transaction + 7-step idempotent replay, `performModAction()` / `revertModAction()`, Activity Log tab
4. **Raid Radar (3–5d):** Four signals, confidence calc, debounced evaluation (KV CAS), cluster visualization (lazy-load, ≤20 nodes, 320px), action buttons, false-positive loop — core demo footage
5. **Health Score (3–5d):** Four signals, AFINN-2015-en + emoji lexicon, risk + forecast (configurable slowModeVelocityImpact), triage queue, watched-thread management, calibration stats
6. **Memory engine (4–6d):** Behavioral + stylometry fingerprinting (L2-norm cosine, vocabulary Map cap, histogram intersection), banned-user index (per-user keys + banned_ids sorted set), Mod Notes integration (opt-in), User Spotlight, side-by-side view, mod menu items
7. **Polish + edge cases (2–3d):** Performance budgets, test scenarios, settings round-trip, error handling, mobile layout, calibration banner, visual alignment
8. **Demo prep (1–2d):** Test sub setup, pre-seeding checklist execution, demo video per spec, app listing, screenshots, Devpost submission

Scope governance (PRI-3, lead decides before Milestone 4): (a) default — all three engines per spec; (b) defer Memory to v1.1; (c) cut Health Score forecast only. Buffer of ~10–14 working days under 2026-06-27 deadline.

## Demo Flow

- **[0–10s] Setup:** Problem framing (mods notice brigades 2h too late) + Sentinel logo + capability intro
- **[10–35s] Raid Radar core:** Brigade hits on calibrated test sub (pre-staged alts), dashboard pulses red, cluster graph populates, 89% confidence, 38 accounts from r/external in 90s. Mod clicks account in cluster — Memory side-panel shows 94% style match (against pre-seeded banned-index entry). Mod enables Slow Mode + Filter — cluster fades red to amber, risk 89% to 65%.
- **[35–50s] Health Score supporting:** Different thread; pre-injected velocity trajectory; risk climbing 22% to 31% to 58% to 78% (timelapse). Forecast: "projected 95% in 90min; with slow mode peak 51%." Mod intervenes early, score descends.
- **[50–60s] Close:** Full dashboard with all three engine sections visible. "One platform. Three engines." Install CTA.

Demo recorded on a calibrated test sub with pre-staged scenarios. In production, Sentinel learns each sub's baseline over 3–7 days and detects organic brigades without pre-staging.

## Open Questions

1. **E-SchedulerTimeout (Phase 0 spike):** Per-job execution time limit is undocumented; directly affects P3 progressive-backfill chunk size. Pass/fail: ≥5 min per job run. If shorter, hourly backfill jobs must chunk further.
2. **E-RedisThrottle (Phase 0 spike):** Behavior on 40K cmds/sec overrun (error type, recovery time) is undocumented; affects debounce TTL and dispatchAlert retry backoff. Pass/fail: ≥10 keys/sec sustained with p99 < 500 ms.
3. **E-SlowMode (Phase 0 spike):** Default 70% velocity reduction is a provisional assumption; if measured impact differs >±20%, update `slowModeVelocityImpact` default and re-derive forecast constants.
4. **Cluster graph DOM budget:** ≤20-node cap mitigates the Lighthouse 1,500-node concern; cumulative dashboard DOM under peak load (50 watched threads + open alert cards) needs measurement during Milestone 7 performance testing.
