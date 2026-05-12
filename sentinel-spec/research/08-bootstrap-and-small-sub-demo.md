# Bootstrap Mechanics + Small-Sub Demo Realism (Wave C)

## Summary

Two concrete bootstrap patterns from real Devvit apps are usable by Sentinel: (1) a bounded hot-list fetch at install (Spam Source Spotter: top-1000 posts, reactive accumulation thereafter) and (2) zero-fetch reactive-only start (Hive Protect: purely event-driven from install, 100-item lookback cap). A third pattern—forward-only daily scheduled accumulation (sub-stats-bot)—covers the "no historical data" cold start with honest framing. The 14-day backfill is not how any real Devvit mod app works; none attempt it. For the demo: a private test sub with <200 members is **not statistically operational for Sentinel's z-score engines**—Raid Radar's influx z-score has no warm baseline, Memory's ≥10-comment requirement makes it non-functional without pre-population, and Health Score baselines are undefined on a thread with <10 comments. The demo is necessarily a **scripted simulation on a calibrated test sub**: spec file `09-demo-video-script.md` already describes exactly this (pre-staged alts, pre-persisted Memory matches, optional synthesized Health Score data). This is normal hackathon demo practice and not a flaw, but the framing must be honest: "calibrated test sub with pre-staged scenarios" — not "live organic detection."

---

## Part A: Bootstrap patterns from real apps

### Pattern 1: Bounded hot-list fetch at install — Spam Source Spotter

**App:** [fsvreddit/spam-src-spotter](https://github.com/fsvreddit/spam-src-spotter) — a Devvit app that alerts mods when posts come from domains rarely or never seen before on the sub.

**Mechanism:** One-shot fetch at install. On first install, the app reads the top 1,000 subreddit posts sorted by "hot" and indexes the domain frequency of each. This establishes a prior: domains already seen in that snapshot are treated as known; new domains on subsequent posts trigger alerts. After the one-shot scan, the app is entirely reactive — it accumulates domain statistics as new posts are created or approved out of modqueue. No background scheduler. No ongoing backfill. No historical window beyond the initial hot-1000 snapshot.

**Concrete numerical constraints:**
- Batch size: 1,000 posts total (bounded; not growing over time)
- Paging: Reddit typically returns 25–100 posts per listing page → 10–40 API calls
- Rate limit: 60 req/min OAuth ceiling → 10–40 calls completes in under 1 minute
- Install timeout risk: essentially none at this call volume
- Storage: domain → frequency map; scales with unique domain count, not post count

**Time to "fully operational":** Less than 2 minutes on a medium-activity sub. The domain baseline is thin at first — any domain absent from the hot-1000 is treated as new — but improves organically as posts accumulate. No "warming period" is surfaced to the user.

**Honest framing:** The README does not claim instant perfection. False positives can occur when a known domain happened to be absent from the hot-1000 snapshot. The app accepts this without flagging a "calibration period" to users — it simply gets more accurate over time silently.

**Applicability to Sentinel:** Scanning top-1000 hot posts at install would capture 48–72 hours of activity on a moderately active sub (more on small subs). This seeds `SubBaseline` and individual `UserFingerprint` records — not 14 days, but enough to make Signal 1 (influx z-score) non-trivially warm before live events begin. Critically, it stays well within the ~60 req/min rate limit, finishes in under 2 minutes, and carries no scheduler-timeout risk.

---

### Pattern 2: Zero-fetch, purely reactive — Hive Protect

**App:** [fsvreddit/hive-protect](https://github.com/fsvreddit/hive-protect) — a Devvit mod tool that detects users posting from subreddits that are known sources of coordinated harassment.

**Mechanism:** No install-time data fetch whatsoever. The app begins watching incoming events (PostSubmit, CommentSubmit) immediately on install. On each new user event, it fetches that user's recent history on demand and checks for overlap with configured target subreddits. Results are cached per user for 24 hours to avoid flooding the API. For users who exceed action thresholds, the cache shortens to 1 hour.

**Concrete numerical constraints:**
- Per-user lookback: hard cap at 100 posts/comments — stated explicitly in README: *"Hive Protector only looks back at a user's most recent 100 posts/comments, so detection will not be possible on older content."*
- Per-user check frequency: once per 24 hours (cached); 1 hour if over action threshold
- Install-time API calls: zero
- Modmail digest: daily batch summary (one scheduled job)

**Time to "fully operational":** Immediate on install. Any user who comments after install is checked. Users who last posted before install are unindexed until their next event. The 100-item lookback means ban-evasion on old accounts is simply out of scope and documented as such.

**Honest framing:** The 100-item limit is stated plainly. Mods understand the constraint up front. The app makes no "working from day one on all history" claim — only "starts checking new users immediately."

**Applicability to Sentinel:** Hive Protect's pattern is the correct model for Sentinel's engine operation before bootstrap completes. Engines can start evaluating signals on new users from the first event, even with an empty baseline — each comment seeds a `UserFingerprint` record; each thread creates a `ThreadState`. The 7-day calibration ramp (confidence ×0.85, higher critical threshold) already in spec mirrors Hive Protect's implicit "builds accuracy over time" contract. No spec change is required — only clarification that "engines active from minute one" means "reactive detection only, no backfill."

---

### Pattern 3: Forward-only scheduled accumulation — sub-stats-bot

**App:** [fsvreddit/sub-stats-bot](https://github.com/fsvreddit/sub-stats-bot) — a Devvit app that publishes subreddit statistics (post/comment counts, top users, growth trends) to wiki pages on a daily schedule.

**Mechanism:** No historical backfill. The bot begins accumulating statistics from install day forward using a daily scheduled job (01:00 UTC). Statistics are explicitly forward-only: the install month is tracked separately as partial-period data to avoid skewing monthly aggregates. No attempt to reconstruct history. Triggered exclusively by the scheduler — not by individual events.

**Concrete numerical constraints:**
- Scheduler frequency: once per day
- First meaningful output: after first scheduled run (up to 24 hours after install)
- Data window: grows from 0 days on install to N days as time passes

**Time to "fully operational":** One day for first stats output; weeks for meaningful trends. The app is honest about this by showing "install month" data separately.

**Honest framing:** No promise of historical insights. Stats accumulate over days and weeks. Install month is explicitly flagged as partial data. Mods understand from the daily-update model that this is a forward-accumulating tool.

**Applicability to Sentinel:** The scheduled-accumulation model covers the 3–14 day baseline gap that bounded fetch can't fill. After the hot-1000 scan seeds a thin initial baseline (Pattern 1), a daily or hourly scheduler job can progressively backfill — fetching e.g., "posts from the last 7 days not yet in storage" in small, rate-limit-safe batches. The spec's calibration ramp banner already provides the correct user contract for this accumulation period.

---

### Pattern comparison

| Dimension | Spam Source Spotter (P1) | Hive Protect (P2) | sub-stats-bot (P3) |
|---|---|---|---|
| Install-time fetch | One-shot top-1000 hot posts | None | None |
| Operational on first event? | Yes (post install scan) | Yes | No (waits for scheduler) |
| Time to first useful output | <2 minutes | Immediate | Up to 24 hours |
| Historical coverage | ~48–72h (hot posts) | None | None |
| Progressive backfill? | No | No | Yes (daily) |
| Timeout risk at install | None at 1000-post cap | None | None |
| Rate-limit risk | Minimal (10–40 calls) | Per-user demand | Minimal (once/day) |
| "Still learning" honesty | Implicit (silent) | Documented (100-item cap) | Implicit (install month flagged) |

All three patterns share one constraint: **none cross 100 API calls at install time**. The 14-day backfill for a 10K-member sub requires 10,000+ calls; the real-app pattern ceiling is roughly 1,000. Sentinel's spec should target the same ceiling.

---

### Recommended for Sentinel

No real Devvit mod app attempts a 14-day backfill. The three-pattern hybrid is the viable approach: **(a) bounded one-shot fetch at install** (top-1000 hot posts, <2 minutes, no timeout risk — Pattern 1), **(b) immediate reactive accumulation from all incoming events** (engines run from minute one on live traffic — Pattern 2), **(c) progressive scheduled backfill** (hourly job fills remaining 3–14 day gap during calibration ramp — Pattern 3). The spec's existing 7-day calibration ramp already provides the correct user contract. The welcome modal copy ("scanning your sub's last 14 days of activity, takes about 2 minutes") misstates what is feasible on large subs and should be adjusted to reflect this hybrid reality. The three-pattern approach means Sentinel is genuinely operational from minute one, improves over 7 days, and never blocks install on a multi-hour fetch. Cite: spam-src-spotter install pattern [1], Hive Protect reactive model [2], sub-stats-bot scheduled accumulation [3], Wave A backfill infeasibility analysis [4].

---

## Part B: Small-sub statistical viability

### Baseline math at 50–200 members

A private sub with 50–200 members and no public promotion generates roughly 0–10 comments per hour across all threads, with most 5-minute windows containing 0–1 new comments. Analytics tooling (subredditstats.com, subreddittraffic.live [11]) shows subs below 500 members typically see 5–30 comments per day total. For a 200-member private hackathon test sub with moderate engagement: ~10 comments/day.

**Derived baseline parameters:**
- Comments per day: ~10
- Comments per hour (μ_hour): ~10 / 24 = **0.42 comments/hour**
- New commenters per 5-min window (μ_5min): ~10 / (24×12) = **0.035 events/bucket**
- Standard deviation (σ): for a Poisson-like arrival process at λ=0.035, σ ≈ √0.035 ≈ **0.19** — but in practice, nearly every 5-min bucket has exactly 0 events, so the observed σ from Welford's will approach **near-zero** after early accumulation

**Concrete z-score arithmetic with the `|| 1` stddev fallback:**

The spec uses `stddev || 1` to prevent division-by-zero (confirmed in research/03). On a cold or very-low-activity sub, this fallback converts the z-score into a de facto absolute-count trigger:

| Scenario | μ | σ (effective) | Observed | z-score | Fires (4σ threshold)? |
|---|---|---|---|---|---|
| Completely cold sub | 0 | 0 → fallback 1 | 3 new commenters | (3-0)/1 = **3.0** | No |
| Completely cold sub | 0 | 0 → fallback 1 | 5 new commenters | (5-0)/1 = **5.0** | **Yes** |
| Thin baseline (active 2 days) | 0.05 | 0 → fallback 1 | 2 new commenters | (2-0.05)/1 = **1.95** | No |
| Thin baseline (active 2 days) | 0.05 | 0 → fallback 1 | 5 new commenters | (5-0.05)/1 = **4.95** | **Yes** |
| Warm baseline (7 days+) | 0.5 | 0.3 | 2 new commenters | (2-0.5)/0.3 = **5.0** | **Yes** |
| Warm baseline (7 days+) | 0.5 | 0.3 | 1 new commenter | (1-0.5)/0.3 = **1.67** | No |

**Key finding:** On a cold sub, the 4σ threshold effectively becomes an absolute-count trigger: "5 or more new accounts in 5 minutes fires an alert." This is not a statistical anomaly detection — it is a hard count rule wearing a z-score formula. Once a warm baseline develops (7+ days), it becomes genuinely sensitive: 2 simultaneous new commenters on a historically quiet sub fires Signal 1 immediately.

**How long to accumulate 30 observations (CLT stability requirement):**

For a 200-member sub generating ~0.035 events per 5-minute bucket, each 5-minute slot is independently Bernoulli(p=0.035). Expected non-zero buckets per day: 24×12×0.035 ≈ **10 non-zero buckets per day**. To accumulate 30 non-zero observations for the CLT to apply: **3 days minimum**. For 100 observations (stable estimates): **10 days minimum**. This aligns almost exactly with the 7-day calibration ramp — the spec's ramp is not just about fingerprinting; it is the minimum window to make z-score Signal 1 statistically valid on a small sub. For production subs at 10K members (50+ comments/hour), 30 observations per bucket accumulate in **< 3 hours**, confirming the Q15-scale design is sound.

**False positive rate with multi-signal requirement:**

Sentinel requires ≥2 signals firing for a Raid Radar alert. This is protective. On a small sub:
- Signal 1 (influx z-score): fires on any 5+ commenter burst on cold sub (see table above)
- Signal 2 (account age, entropy): requires new arrivals to be genuinely young accounts with homogeneous ages — high entropy on a small private sub where members are typically trusted invitees, so Signal 2 rarely fires organically (false-positive rate: low)
- Signal 3 (sub overlap >70%): 4 of 5 new commenters sharing an external sub = 80% — can fire from coincidence on tiny samples (e.g., 3 friends who all use the same hobby sub)
- Signal 4 (sync timing, sync_score >0.85): fires easily on pre-staged alts posting simultaneously; unlikely from organic posting

On a <200 member sub, the false-positive scenario most likely to produce a spurious 2-signal alert: a batch of invited new members (same referral source → same external sub, similar age) joining and posting in the same hour. Sub overlap + influx z-score would both fire. Multi-signal guard helps but does not eliminate this on a tiny sub.

---

### Engine-by-engine viability

**Raid Radar at <200 members:**
Signal 1 (influx z-score >4σ) is not statistically grounded without ≥30 observations in the 5-min new-commenter bucket — which at 0.035 events/bucket requires nearly 1,000 days to accumulate naturally (clearly infeasible). In practice, Welford's algorithm on this metric will remain in `|| 1` fallback mode for weeks, making Signal 1 behave as an absolute threshold of ~5 new accounts in 5 minutes. For a staged demo with 8 alts, this fires correctly and reproducibly. Signals 2 and 4 (account age clustering, sync timing) are properties of the arriving accounts — they work at any sub scale. Signal 3 (sub overlap) degrades statistically with N<10 new arrivals (4/5 = 80% overlap is not meaningful at this sample size) but directionally fires if alts are pre-seeded from the same external sub. **Overall verdict: Raid Radar fires correctly in a staged demo; the statistical validity claim holds only for warm-baseline production subs.**

**Memory at <200 members:**
The ≥10-comment sample-size requirement is the hard blocker. At ~10 comments/day across ~50 active users on the test sub, any individual user averages ~0.2 comments/day — reaching 10 comments takes 50 days. Even the most prolific users on a small private test sub are unlikely to accumulate 10 comments before the hackathon deadline. Memory is **functionally inoperative on a fresh test sub** without explicit pre-seeding. The demo script (09, line 143) mandates: "The Memory match should already be detected and persisted before you start filming" — this is the correct and only viable approach. Pre-seeding the banned-user fingerprint and the new-account fingerprint before demo recording is not a workaround; it is the required demo-prep step. In production on large subs (Q15 scale: 10K–500K members), Memory is fully viable: high-frequency commenters accumulate 10 samples in hours.

**Health Score at <200 members:**
Thread velocity baseline per `ThreadState` requires enough comment-per-minute data to establish a reliable mean and stddev. On a thread with 0–2 comments/hour normally, the baseline stabilizes around μ_velocity ≈ 0.02 comments/min, σ ≈ 0.05 — which again hits `|| 1` fallback. The velocity z-score then fires on any absolute burst of ≥4 comments in 5 minutes (a very low bar). The forecast model (1h, 2h projections) requires a risk trajectory slope, computed from multiple risk-score datapoints over time. On a thread with <10 total comments, the trajectory is undefined or unreliable — a single comment can flip the slope dramatically. The max-50 watched-threads cap is not binding on a small sub (good). **Overall verdict: Health Score produces visually plausible numbers on the demo but the underlying statistics are not valid; the timelapse must use synthesized or manually-injected data.**

**Summary table — engine viability at <200 members:**

| Engine | Structural blocker on test sub? | Works in demo? | How? | Prod (10K+) valid? |
|---|---|---|---|---|
| Raid Radar Signal 1 (influx z) | No hard blocker; degrades to absolute count via `\|\| 1` | Yes | 8 pre-staged alts trigger absolute threshold | Yes, after 3–7 day warm baseline |
| Raid Radar Signal 2 (age cluster) | None — property of arriving accounts | Yes | Pre-staged new-account alts satisfy criterion | Yes |
| Raid Radar Signal 3 (sub overlap) | Statistically noisy at N<5 arrivals | Yes (directionally) | Pre-staged alts from same source sub | Yes at N>10 |
| Raid Radar Signal 4 (sync timing) | None — property of timing | Yes | Simultaneous paste firing triggers sync_score | Yes |
| Memory | Hard blocker: ≥10 comments/user | Only with pre-seeding | Persist fingerprints before recording | Yes, hours on active subs |
| Health Score velocity | Near-zero baseline; `\|\| 1` fires on any burst | Yes (synthesized) | Debug data injection or controlled real events | Yes, after days of thread history |
| Health Score forecast | Requires stable trajectory slope | Only with synthesized data | Injected time series with rising risk curve | Yes, after 1h+ of thread activity |

---

### Demo strategy patterns from other apps

**Pattern A: Pre-staged state + scripted trigger (already in Sentinel's spec)**
The most common hackathon mod-tool demo approach is to pre-load the exact system state required for the showcase, then record the trigger event live. Sentinel's `09-demo-video-script.md` already describes this approach explicitly:
- "Have 8 alts pre-staged with comments ready in another tab" (line 137)
- "Record the dashboard before the brigade. Trigger the brigade (paste comments rapidly across alts). Record 90-second window of the alert firing." (lines 138–140)
- "The Memory match should already be detected and persisted before you start filming. Shot is just: click the user → panel appears → cut." (lines 143–145)
- "Optional: synthesize the data via debug commands if real-time recording is too time-consuming." (line 150)

This is standard practice for hackathon demo videos. The Reddit Mod Tools Hackathon judging criteria (Devpost, [10]) focuses on community impact, polish, and reliable UX — not on whether the demo scenario was organic. Judges watching a 60-second demo video are not expecting to see a real brigade; they are evaluating whether the detection-and-response workflow is coherent and compelling.

**Pattern B: Per-environment threshold tuning**
Several Devvit mod tools (Hive Protect, Spam Source Spotter) expose sensitivity or threshold configuration. For demo environments, lowering thresholds ensures signals fire on the staged scenario without requiring unrealistically large brigades. Sentinel's existing sensitivity slider (Low/Medium/High in settings) already supports this: setting the test sub to "High" sensitivity reduces the minimum signal count, ensuring the 8-alt staged brigade fires even before baselines are warm. This is not misrepresentation — it demonstrates the signal at a sensitivity the app genuinely supports. In the video, showing the sensitivity setting before the demo establishes this context.

**Pattern C: Debug seeding endpoint for demo preparation**
The spec references "debug commands" for synthesizing Health Score data (09, line 150). Implementing a mod-only debug menu item (visible only to the sub's moderators, not end users) that injects pre-scripted state into Redis enables consistent, repeatable demo recording without coordinating real-time multi-account posting sessions. Concrete seeding operations:
- Inject a `SubBaseline` with warm stats (μ_comments, σ_comments set to plausible production values)
- Inject a `UserFingerprint` for the banned user + the new suspect account (enabling Memory pre-seeding)
- Inject a `ThreadState` with a rising velocity trajectory (enabling Health Score timelapse without 30-minute real recording)

This pattern is invisible to end users and does not affect production code paths. It is the production-equivalent of a unit test fixture.

---

### Honest framing options

**Option 1: "Calibrated test sub" framing (recommended)**
> *"Demo recorded on a private test subreddit with pre-staged test scenarios to demonstrate the full detection and response workflow. In production, Sentinel learns each sub's baseline over 3–7 days and detects organic brigades without pre-staging."*

Sets correct expectations. Explains why a private small sub was used. Does not claim organic detection where there was none. Positions the calibration ramp as a feature, not a limitation.

**Option 2: Implicit framing (no explicit disclaimer, no false claims)**
Show the demo without claiming "this is a live organic detection." Simply demonstrate the product working. Do not add language like "detected a real brigade live" or "this is what your mods will see on day one." Judges sophisticated in hackathon demos understand that 60-second videos use scripted scenarios. Lowest friction; carries residual risk if judges ask pointed questions about cold-start behavior.

**Cross-domain reference: how other detection tools handle this gap**

Security operations center (SOC) tools (e.g., Splunk SIEM, New Relic anomaly detection [documented at docs.newrelic.com]) universally acknowledge that anomaly detection requires a "burn-in" or "learning" period ranging from 72 hours to 2 weeks before statistical thresholds stabilize. None of these tools claim to be "working" in a statistically meaningful sense on day one — they operate in a "baseline learning" mode and surface results with lower confidence weighting. Sentinel's 7-day calibration ramp is consistent with industry practice. The `confidence × 0.85` multiplier during calibration is a correct and honest implementation of this pattern. The only gap is that the spec's current UI copy ("scanning your sub's last 14 days") implies the learning phase is instantaneous at install rather than an ongoing 7-day accumulation.

---

**Option 3: "Threshold-demonstration" framing**
> *"For this demonstration, Sentinel is running in High Sensitivity mode on a test sub to ensure signals fire at demo scale. Medium Sensitivity (the default) requires larger sample sizes appropriate for production communities of 10K–500K members."*

Technically accurate. Frames the small-sub limitation as a sensitivity feature, not a failure. Requires on-screen display of the sensitivity setting before the alert fires.

---

## Recommendations

- **The small-sub statistical gap is not a design flaw — it is a scale mismatch.** Sentinel is designed for Q15-scale subs (10K–500K members). The demo sub (Q2, <200 members) is a regulatory and hackathon requirement, not a target deployment environment. The gap between Q2 demo scale and Q15 production scale is real, documented here, and mitigated by: (a) scripted demo with pre-staged state, (b) threshold tuning to "High" sensitivity for the test environment, and (c) "calibrated test sub" framing in the video description.

- **Adopt the three-pattern bootstrap hybrid.** At install: bounded hot-list fetch (top-1000 hot posts, <2 minutes, no timeout risk). From install onwards: reactive accumulation on all events. In the background during calibration ramp: optional progressive scheduled fill of the 3–14 day gap. No single pattern from the real-app survey covers everything; the three patterns together replace the infeasible 14-day backfill without sacrificing the "working from minute one" claim. Cite: spam-src-spotter [1], hive-protect [2], sub-stats-bot [3].

- **Update the welcome modal copy.** "Scanning your sub's last 14 days of activity to learn what 'normal' looks like. This takes about 2 minutes" is infeasible on large subs. The correct copy is: "Scanning your sub's recent activity to seed your baseline. Detection is active immediately; accuracy improves over the next 7 days." No spec edit proposed — this is a recommendation for the implementer.

- **Pre-seeding Memory is not optional for the demo — make it a formal demo-prep checklist item.** The ≥10-comment requirement means Memory cannot function organically on a <200-member test sub within the hackathon timeline. The demo script already mandates pre-seeding (09, line 143); this should be elevated to a documented prerequisite in the demo-prep checklist, not treated as a recording tip.

- **Implement the debug seeding endpoint before recording begins.** A mod-only Redis injection endpoint (Pattern C) makes the 8-alt brigade demo reproducible, avoids depending on real-time alt coordination, and covers Health Score timelapse synthesis. This is the most practical path to a clean 60-second recording. Low implementation cost; high demo reliability dividend.

- **The 7-day calibration ramp already in spec is statistically correct and should be highlighted, not hidden.** The ramp is not a "sorry, it needs time" apology — it is the correct behavior for any z-score-based detection system. Industry tools (SIEM platforms, APM anomaly detection) uniformly require 3–14 day burn-in periods. Sentinel's 7 days is within the expected range. The calibration banner ("Accuracy improves over the next N days") should be positioned as a feature of a statistically rigorous system, not a startup weakness. Use it as a differentiator in the Devpost submission narrative.

- **Use "calibrated test sub" framing in the video description and Devpost submission.** The hackathon judges (Reddit mod team + community evaluators) are technically sophisticated. Transparent framing signals maturity. The demo is compelling on its own merits — it does not need to claim organic detection where it didn't occur. Option 1 framing above is recommended for the YouTube description and Devpost project notes.

- **Memory's pre-seeding requirement reveals an important production insight worth surfacing in the spec.** Memory's value proposition (detecting ban evaders) depends entirely on the banned-user fingerprint index being populated — which requires prior mod actions on the sub. A completely new mod installation on a sub that has never banned anyone will have an empty fingerprint index. The demo pre-seeding is not just a test convenience; it mirrors the real production requirement: Memory only functions after the sub has accumulated bans. The spec's onboarding could acknowledge this ("Memory improves as your ban history grows") to set honest mod expectations at install time.

---

---

## Bootstrap pattern decision matrix

For implementers choosing among the three patterns at each phase of Sentinel's operation:

| Phase | Event | Action | Pattern |
|---|---|---|---|
| Install (t=0) | AppInstall trigger fires | Fetch top-1000 hot posts; seed SubBaseline + UserFingerprints | P1 |
| Install (t=0) | Same trigger | Initialize RollingStat, TimeSeries with thin data; mark `bootstrapPhase = "seeding"` | P1 |
| t=0 to t=7d | Any live event (CommentSubmit, PostSubmit) | Run all engines on the event; update fingerprints and baselines in real time | P2 |
| t=0 to t=7d | Scheduled hourly job | Backfill remaining posts from last 7 days (paginated, rate-limit safe, 60 req/min cap) | P3 |
| t=7d | Calibration ramp expires | Mark `bootstrapPhase = "calibrated"`; remove confidence multiplier; enable auto-actions if opted in | — |

---

## Sources cited

1. [fsvreddit/spam-src-spotter](https://github.com/fsvreddit/spam-src-spotter) — One-shot bounded hot-list fetch at install (top-1000 posts) + reactive domain accumulation thereafter; primary model for Sentinel's install-time bootstrap
2. [fsvreddit/hive-protect](https://github.com/fsvreddit/hive-protect) — Zero-backfill purely reactive pattern; 100-item per-user lookback cap; 24-hour cache to avoid API flooding; daily modmail digest
3. [fsvreddit/sub-stats-bot](https://github.com/fsvreddit/sub-stats-bot) — Daily scheduled forward-accumulation from install day; install-month partial data handling; no historical backfill
4. [fsvreddit/toolboxnotesxfer](https://github.com/fsvreddit/toolboxnotesxfer) — User-triggered background batch transfer; "minutes to hours" depending on volume; v1.1.1 adds "more reliable pacing" (rate-limit management)
5. [Sentinel research 04-devvit-best-practices.md](04-devvit-best-practices.md) — 14-day backfill declared infeasible (39-hour estimate vs. 5–30min scheduler timeout); Option A (lazy/24h) and Option B (partial 2–3 day) as alternatives
6. [Sentinel research 05-devvit-verification.md](05-devvit-verification.md) — Hive Protect 100-item lookback cap confirmed; scheduler timeout still-unknown; cross-sub user history fundamentally limited
7. [MCP Analytics — Z-Score Anomaly Detection Practical Guide](https://mcpanalytics.ai/articles/z-score-anomaly-detection-practical-guide-for-data-driven-decisions) — Minimum 30 observations for CLT stability; 100+ for reliable estimates; IQR or domain rules recommended below 30 observations
8. [Analytics Vidhya — Modified Z-Score](https://medium.com/analytics-vidhya/anomaly-detection-by-modified-z-score-f8ad6be62bac) — MAD-based robust z-score; more stable than standard z-score when extreme values inflate sigma; recommended for small samples
9. [DEV Community — Anomaly Detection in Seasonal Data: Z-Score Wins](https://dev.to/qvfagundes/anomaly-detection-in-seasonal-data-why-z-score-still-wins-but-you-need-to-use-it-right-4ec1) — 34.21% false-positive rate with naive z-score on seasonal/low-sample data; group-aware or time-aware segmentation required
10. [Reddit Mod Tools and Migrated Apps Hackathon — Devpost rules](https://mod-tools-migration.devpost.com/rules) — Judging criteria: community impact, polish, reliable UX; demo subreddit required; private subs must grant judges access
11. [Subreddit Stats tools](https://subredditstats.com/) — Activity benchmarks for small subreddits; subs <500 members typically see 5–30 comments/day total
12. [Sentinel spec 09-demo-video-script.md](../09-demo-video-script.md) — Pre-staged alt accounts; pre-persisted Memory matches; optional synthesized Health Score timelapse; 8-alt brigade orchestration already specified
13. [Sentinel spec 07-onboarding-and-install.md](../07-onboarding-and-install.md) — Bootstrap job spec; "2–10 minutes depending on sub activity" claim; non-blocking bootstrap design; welcome modal copy
14. [Sentinel research 03-stats-methods-sanity.md](03-stats-methods-sanity.md) — `stddev || 1` fallback confirmed; rolling-window vs. Welford's mismatch documented; trigram extraction performance risk
15. [Sentinel spec 00-architectural-summary.md](../00-architectural-summary.md) — Critical thresholds table: Raid Radar >4σ influx, Memory ≥10 comments, Health Score velocity >3σ; 7-day calibration ramp; 14-day bootstrap window
