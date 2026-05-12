# 00 · Plan Review Report

> Synthesis of five research outputs against the Sentinel spec. Drives Phase 2 spec revisions. All claims cite a research file. Recommendations are proposals; lead applies them. No spec file modified by this report.

---

## Summary

**Verdict: REVISE.** Sentinel's architecture, three-engine thesis, and statistical approach all survive the evidence base. The competitive landscape is favorable — no existing Devvit app combines brigade detection, ban-evader stylometry, and thread-escalation forecasting on a shared behavioral graph (research/02). Statistical methods (Welford's online algorithm, z-scores, sigmoid normalization, cosine, Jaccard) are computationally sound and viable on the Devvit runtime (research/03). However, three findings require material spec changes before build: (a) the 14-day bootstrap fetch on install is infeasible under Reddit API rate limits + assumed Devvit scheduler timeouts (research/04, research/05); (b) Welford's "rolling 14-day" baseline conflates full-history and sliding-window semantics — Welford does not natively window (research/03); (c) Raid Radar's sub-overlap signal depends on cross-sub user history that is capped at the ~100 most-recent items per user (research/05, evidenced by Hive Protect's documented behavior). Each is correctable within the existing architecture. Eleven additional findings are clarification-level fixes (AFINN variant, multi-key atomicity, debounce pattern, L2 normalization, trigram preprocessing, vocabulary aging, histogram formulas, cluster-graph DOM budget, Mod Notes API fallback, performModAction surface, storage-ceiling eviction). One Q-decision (Q12 Onboarding) is surfaced as a Plan Review Item because its mechanism, not its principle, requires revision; the lead decides whether to amend. Three runtime unknowns (Q4/Q6/Q7 from research/05) remain officially undocumented and are deferred to a Phase 0 empirical spike rather than designed around. With these revisions, Sentinel is buildable within the hackathon window; without them, build risk concentrates in the first three days of foundation work.

**Schedule-risk overlay.** Today is 2026-05-11; the hackathon deadline is 2026-05-27 (~16 calendar days). `08-build-plan.md` estimates 16–27 working days. The blocker revisions (R1–R3) cost about one combined day of spec edits and are net-positive on build velocity because they pre-empt foundation rework. The Phase 0 empirical spike (R11) is the only schedule-additive proposal in this report; it costs one day before Milestone 1 begins and retires three unknown runtime parameters (E1–E3) that otherwise force conservative over-engineering throughout the build. Net effect of accepting all revisions: a ~1-day spike up front, no Milestone 1–8 slip. If a cut becomes necessary, `08-build-plan.md` already prescribes the order; this review does not introduce a new cut path.

---

## Validated assumptions

1. **Devvit triggers exist and are usable** for the four event types Sentinel relies on: `PostSubmit`, `CommentSubmit`, `ModAction`, and `PostReport`/`CommentReport`. Verified from code examples in `reddit/devvit-examples`, `evasion-guard`, `hive-protect`, `automodmail` (research/01 caps #3–#6).

2. **Account age is accessible** for arbitrary users via Devvit's user-object surface. Confirmed indirectly: `modmail-userinfo` ships "Account age" as a feature; Reddit API's `created_utc` field is the underlying primitive (research/01 cap #1, research/05 Q2). Exact Devvit SDK field name (`createdAt` vs `created_utc`) is unconfirmed but the capability exists.

3. **Mod actions Sentinel needs are programmatically available**: slow mode, post lock, post remove/approve, user ban/unban. Verified from `evasion-guard`, `hive-protect`, `auto-post-lock` (research/01 caps #11, #13, #14, #15).

4. **Modmail is sendable from a Devvit app**. Verified from `automodmail`, `modmail-userinfo`, `Modmail-To-Discord/Slack` (research/01 cap #10). Supports Sentinel's critical-alert dispatch path (Q8 decision).

5. **Devvit scheduler exists and accepts cron-style schedules** (research/01 cap #16). Supports Sentinel's daily/hourly/5-minute/6-hour jobs as enumerated in `02-architecture.md` § Scheduler jobs.

6. **Custom posts via Devvit Blocks support the dashboard structure**: tabs, KPI tiles, signal bars, modals are all standard patterns and well-supported (research/04 § Custom Post Complexity, research/01 cap #9).

7. **No competing Devvit app combines all three engines** on a shared behavioral graph. Existing apps cover narrow slices: Hive Protect (sub-participation only, ~100 item cap), Evasion Guard (passive relay of Reddit's signal), Spam-Source-Spotter, Trending-Tattler (research/02). Sentinel's platform thesis is competitively defensible.

8. **Statistical primitives are computationally cheap**: Welford's runs in O(1) per update, z-scores O(1) given baseline, sigmoid O(1), cosine O(8) for the stylometry vector, Jaccard O(50) on top-50 trigrams (research/03). All comfortably within a sub-100ms eval budget.

9. **Sigmoid anchoring of risk to 0–1** is the correct shape for anomaly detection. Saturation at ±6σ is intentional and prevents extreme z-scores from dominating (research/03 Item 7). Health Score and Raid Radar formulations both survive.

10. **Bounded storage is achievable** at stated scale. 50 watched threads × 10KB + ~10K user fingerprints + baselines fits comfortably under the assumed 500MB budget per sub (research/03 Item 5, research/04 § Rate Limits and Quotas).

11. **Welford's online algorithm itself is the right primitive** — O(1) per update, ~24 bytes per stat (count + mean + m2 as 64-bit floats), numerically stable in the value range Reddit comment rates produce (research/03 § Welford's algorithm). Only the windowing framing in `02-architecture.md` is broken; the algorithm choice is correct.

12. **The dual-signal Memory guard is mathematically defensible.** Requiring both behavioral and stylometric similarity to independently exceed their floors (0.65, 0.75) AND combined to exceed 0.78 is conservative — single-signal stylometry false-positive risk is the canonical concern and the dual-signal rule directly addresses it (research/03 implicit; spec `04-engine-memory.md` § Combined match logic). Stylometric n-grams as idiolect markers are supported by the academic literature (research/03 source #5, Tweedie et al. 1996).

---

## Broken assumptions

### A. 14-day bootstrap fetch on install

- **What the spec says:** `07-onboarding-and-install.md` Step 3 ("Background bootstrap," lines 53–68) instructs the install flow to fetch the sub's last 14 days of posts and each post's top 100 comments, then run them through the standard ingestion module. `02-architecture.md` § Bootstrap (lines 264–272) repeats this. `08-build-plan.md` Milestone 1 (line 24) lists "Bootstrap job — scan last 14 days on install" as a deliverable. `00-architectural-summary.md` line 71 ("Bootstrap window: 14 days") canonicalizes the value.
- **What's actually true:** A mid-sized sub (10K–100K members, ~200 posts/day, ~50 comments/post) needs roughly 140K API calls to backfill 14 days. At an estimated Reddit OAuth limit of 60 req/min that is ~39 hours of fetching, which exceeds the assumed Devvit scheduler timeout of 5–30 minutes (research/04 § Bootstrap Feasibility; research/05 Q3 confirms no documented batch backfill API exists).
- **Scale math (from research/04 § Bootstrap Feasibility):**
  - 14 days × 200 posts/day = 2,800 posts
  - 2,800 posts × 50 comments/post = 140,000 comment fetches
  - 140,000 fetches / 60 req/min = 2,333 minutes ≈ 39 hours
  - Devvit scheduler timeout (assumed 5–30 min, gated by E2): hard ceiling at 30 minutes
  - 30 min × 60 req/min = 1,800 fetches achievable per scheduled invocation
  - 24-hour window scaled: ~200 × 50 = 10,000 fetches → ~167 minutes at 60 req/min, still over the 30-min ceiling but chunkable into multiple scheduled invocations or accepted as a longer cold-start when the sub is highly active.
- **Materiality:** Blocker.
- **What should change:** Replace the 14-day bootstrap with a 24-hour initial fetch + 7-day passive baseline accumulation (the calibration ramp window). For very-active subs, fetch the last ~6 hours instead and accept that baselines warm up entirely passively. The "still learning" banner becomes the official cold-start UX, not a transparency gloss on a completed bootstrap. See Revision R1.

### B. Welford's algorithm on a "rolling 14-day window"

- **What the spec says:** `02-architecture.md` line 46 annotates `SubBaseline` as "Rolling window stats (last 14 days)"; the `RollingStat` class (lines 220–232) implements Welford's online algorithm. Settings advanced section (line 349) exposes `baselineWindowDays` defaulting to 14.
- **What's actually true:** Welford's algorithm computes full-history mean and variance; it does not support sliding-window aging without a circular buffer of values (research/03 Item 4). Either interpretation has costs: full-history Welford diverges from the stated window semantics; true 14-day windowing requires O(window_size) memory and a more complex update.
- **Two valid interpretations and why one wins:**
  - *(a) Full-history Welford*: matches the existing code skeleton in `02-architecture.md` lines 220–232 exactly. O(1) update, ~24 bytes per stat. Older data implicitly weighted equally with recent data; this is acceptable because user-fingerprint aging (90-day retention) bounds the underlying data anyway.
  - *(b) Sliding-window Welford*: requires storing all values in a circular buffer for the window length, plus an update routine that subtracts the expiring value and adds the new one. O(window_size) memory; more complex update; numerical drift accumulates.
  - Option (a) is simpler, matches the existing code, and produces equivalent statistical behavior for the use cases in this spec. Option (b) provides no measurable benefit at Sentinel's scale and adds implementation complexity.
- **Materiality:** Blocker (the ambiguity will produce divergent implementations across engine code).
- **What should change:** Pin full-history Welford as the canonical semantics; 14 days becomes the bootstrap seed, not a hard cap. Aging is handled by the existing 90-day user-fingerprint retention policy, not by per-baseline windowing. See Revision R2.

### C. Cross-sub user history for sub-overlap

- **What the spec says:** `03-engine-raid-radar.md` Signal 3 (lines 51–58) computes "the most common other sub" across new arrivals and fires when `share_pct > 70%`. `02-architecture.md` `UserFingerprint.otherSubs` (line 90) is `Map<string, number>` (sub → comment count) with no documented cap. `04-engine-memory.md` § Behavioral Signal A relies on `subOverlap` between fingerprints (line 53).
- **What's actually true:** Cross-sub user data accessed via `context.reddit.user.getComments()` is capped at the ~100 most-recent items per user, as documented by Hive Protect's published behavior ("only looks back at a user's most recent 100 posts/comments, so detection will not be possible on older content"). This is the only verified figure for cross-sub user data limits on Devvit (research/05 Critical Finding 1).
- **Materiality:** Blocker for "sub-overlap on long horizon"; the signal still works on a 100-item window, but the spec presents it as unbounded.
- **What should change:** Document the 100-item cap explicitly in the Raid Radar Signal 3 spec and in Memory's behavioral profile. The signal remains useful for short-horizon detection (current brigades arriving from a single external sub) but cannot catch dormant cross-sub patterns older than ~100 comments back. See Revision R3.

### D. AFINN-style sentiment lexicon

- **What the spec says:** `05-engine-health-score.md` Signal 2 (line 65) notes "Use AFINN-style word lists." `00-architectural-summary.md` Open Question 2 already flags variant ambiguity.
- **What's actually true:** AFINN exists in multiple variants (AFINN-111, AFINN-2015, plus extensions). All are English-only. Standard AFINN omits emoji. There is no built-in handling for negation, intensifiers, or Reddit-specific slang (research/03 Item 2). Concretely: a comment like "this is not bad lol 😅" scores positive under naive AFINN (because "lol" + "😅" are absent from AFINN, "bad" scores negative, and "not" is a stopword that's ignored — net result depends entirely on how negation is handled, which the spec does not specify).
- **Materiality:** Risky (silent accuracy loss on non-English and emoji-heavy subs; sentiment swing is one of four Health Score signals weighted at 25%).
- **What should change:** Pin AFINN-2015-en as the canonical variant; add a small emoji-→-sentiment extension table; document neutral fallback (return 0) for tokens not in the lexicon. Document explicitly that negation handling is out of scope for v1 and that mods of non-English subs should expect Health Score sentiment signal to under-weight in their context. See Revision R4.

### E. "Atomic" alert persistence across four KV keys

- **What the spec says:** `00-architectural-summary.md` line 32 describes alert dispatch as "Atomic persistence to KV + dashboard update (debounced) + modmail (if critical) + audit-log entry." `02-architecture.md` § Alert dispatcher (lines 281–287) enumerates five steps: persist alert, update `sentinel:alerts:open`, update dashboard, modmail, audit log entry.
- **What's actually true:** Devvit Redis is single-key atomic. A 4–5 key write sequence can leave the system inconsistent if the handler crashes mid-way: an alert may be persisted but not indexed, or actioned but not audited (research/04 § Spec Patterns That May Conflict).
- **Materiality:** Risky (rare but real durability bug; audit log credibility is core to Q11/Q14).
- **What should change:** Adopt a versioned-alert-ID + idempotent retry pattern: each step is replayable, each step is keyed by the alert ID, and a startup recovery pass scans `sentinel:alerts:open` for entries lacking audit/dashboard markers and replays the missing steps. See Revision R5.

### F. 5-second debounce on engine re-evaluation

- **What the spec says:** `02-architecture.md` line 208 ("debounce engine evaluations to once per 5 seconds per thread") and `00-architectural-summary.md` line 75.
- **What's actually true:** Devvit event triggers do not provide built-in debounce. A handler can fire twice within 5 seconds for the same thread under brigade conditions. Application-level debounce via in-memory timer is unreliable across handler invocations; KV compare-and-set (CAS) on a `lastEvaluatedAt` key is required (research/04 § Spec Patterns That May Conflict).
- **Materiality:** Risky.
- **What should change:** Document the debounce pattern in the architecture spec: `getAsync('sentinel:thread:{postId}:lastEval')` → if `> now - 5000ms`, skip; else `putAsync` and proceed. Mark debounce as "approximate." See Revision R6.

### F2. L2 normalization, vocabulary aging, and trigram preprocessing in Memory

- **What the spec says:** `04-engine-memory.md` § Stylometry Signal B (lines 96–116) constructs a numeric vector and computes cosine similarity without specifying L2 normalization. Top-50 trigrams are extracted from raw comment text with no documented preprocessing. Vocabulary is `Set<string>` with no cap or aging policy.
- **What's actually true:** Un-normalized cosine biases toward features with the largest magnitude — vocabulary diversity dominates avg-sentence-length by orders of magnitude (research/03 Item 3). Per-user vocabulary grows unbounded — a high-volume user could accumulate 10K+ unique tokens, ballooning storage 10× (research/03 Vocabulary Set unbounded growth). Trigram set membership is exact-string; case and whitespace differences ("the" vs "The" vs "the ") produce different trigrams and reduce match sensitivity (research/03 Item 6).
- **Materiality:** Risky.
- **What should change:** Specify L2 normalization on the stylometry numeric vector before cosine; cap vocabulary to top-N most-frequent words (recommend N=2000) with FIFO aging; require trigram preprocessing to case-fold and collapse whitespace before extraction. See Revision R7.

### G. Histogram bucket counts and overlap formula

- **What the spec says:** `02-architecture.md` defines `Histogram` (lines 252–261) with `add`, `percentile`, `entropy` but no bucket count or boundary policy. `04-engine-memory.md` references `histogramOverlap()` (lines 51, 112) without defining the formula or the per-histogram bucket choices.
- **What's actually true:** Histogram overlap is not a single function — Bhattacharyya distance, intersection, chi-squared, and Hellinger distance are all candidates with different sensitivities. Bucket counts dramatically affect comparability (research/03 Item 8).
- **Materiality:** Risky (engine implementations will diverge).
- **What should change:** Pin bucket counts: posting-time histogram → 24 buckets (one per UTC hour, matches `number[24]` in `02-architecture.md` line 77); account-age → 10 buckets (0–7d, 7–30d, 30–90d, 90–180d, 180d–1y, 1–2y, 2–5y, 5–10y, 10y+, unknown); comment-length → 5 buckets (0–50, 50–200, 200–500, 500–1500, 1500+ chars). Pin overlap formula as histogram intersection (simpler to implement, well-understood). See Revision R8.

### H. Cluster graph rendering complexity on Devvit Blocks

- **What the spec says:** `03-engine-raid-radar.md` § Dashboard panel (lines 184–188) describes "A simplified node graph (rendered as SVG via Devvit Blocks): Center node: the target thread; Surrounding nodes: suspicious accounts; Edge connections: shared external sub." `06-dashboard-and-ui.md` includes this in the Threats tab.
- **What's actually true:** 30–50 nodes + edges in SVG = 200+ DOM elements per cluster. Devvit Blocks GitHub comments note "Blocks are very much limited" with rendering risk on mobile (research/04 § Custom Post Complexity). Lighthouse flags >1,500 DOM nodes as excessive; cluster graph alone is far below that ceiling, but cumulative dashboard DOM (5 tabs + KPI + cluster + modal + signal bars) approaches concern territory (research/05 Q9).
- **Materiality:** Risky (mobile UX degradation; non-blocking but visible).
- **What should change:** Cluster graph is lazy-loaded — render only when the user opens the Threats tab and selects the alert. Cap visualization to ≤20 nodes; collapse remaining accounts into a "+N more" badge. Render in a fixed-height container to prevent layout shift. See Revision R9.

### I. Mod Notes API for cross-app banned-user persistence

- **What the spec says:** `04-engine-memory.md` § Banned-user index (lines 175–188) describes preserving full fingerprints on `ModAction.banuser` and tagging with the ban reason. Implicit assumption: persistence survives across app instances or upgrades.
- **What's actually true:** Devvit Redis is per-app-installation. If Sentinel is uninstalled and reinstalled, the banned index is lost (this is acknowledged in `07-onboarding-and-install.md` line 184). Reddit's Mod Notes system provides cross-app persistence, and `toolboxnotesxfer` proves the read/write capability exists, but exact API method names are undocumented (research/01 cap #19, research/05 Q5).
- **Materiality:** Risky (acceptable for v1 — uninstall-reinstall is rare — but worth documenting).
- **What should change:** Explicitly mark Mod Notes integration as v2; document that v1 Memory's banned index is Redis-only and resets on uninstall. Reference `toolboxnotesxfer` as the reverse-engineering target if mods request persistence. See Revision R10.

---

## Competitive risks

### Risk 1 — Reddit's native filter stack (Ban Evasion Filter + Harassment Filter + Mod Insights)

- **What they cover:** Reddit's Ban Evasion Filter auto-flags suspected evaders using platform-scale signals (opaque, no mod visibility into reasoning). Harassment Filter is LLM-powered, auto-collapses harassment with 72% adoption in large subs. Mod Insights provides aggregate growth and team-health analytics (research/02 Reddit-Internal Features table).
- **Where Sentinel differentiates:** Speed (90-second statistical brigade detection vs Reddit's batched filtering), explainability (every Sentinel alert shows which signals fired and how strongly; Reddit's filters are black-box), reversibility (24h revert window per Q11; Reddit's auto-filter actions are platform-level), and unified platform (three engines on one graph, one pinned dashboard, one audit log).
- **Recommendation:** **Differentiate.** The hardest question a judge will ask is "why use this when Reddit's native tools already exist?" The answer rests on these four pillars. Treat them as the demo's emotional spine.

### Risk 2 — Hive Protect

- **What it covers:** Monitors a user's participation in external subs (free-karma, NSFW, OnlyFans) and triggers ban/remove/report. Operates on the same ~100-item cross-sub history cap that constrains Sentinel (research/02; research/05 Critical Finding 1).
- **Where Sentinel differentiates:** Memory's dual-signal match (behavior × stylometry) is the differentiator; Hive only checks sub participation. Sentinel surfaces the side-by-side fingerprint comparison ("smoking gun" view per `04-engine-memory.md` § Side-by-side view) that Hive does not.
- **Recommendation:** **Differentiate.** Lean on stylometry in the Memory demo and app listing copy. Hive's brand recognition is moderate; Sentinel's Memory is a strict superset for ban-evader detection.

### Risk 3 — Evasion Guard

- **What it covers:** Bans/removes posts from users flagged by Reddit's native ban-evasion signal. Passive relay; no independent detection (research/02).
- **Where Sentinel differentiates:** Sentinel's Memory engine produces its own evidence (behavior + stylometry + side-by-side), never auto-bans (Q9), and shows confidence ranges + reasoning. Evasion Guard is fire-and-forget; Sentinel is suggest-and-explain.
- **Recommendation:** **Differentiate.** Demo emphasizes "suggest, don't act" (Q9 cross-cutting principle). Evasion Guard's auto-ban posture is exactly the failure mode Q9 was designed against.

### Differentiation thesis (single paragraph for demo / app listing)

Sentinel's moat is the shared behavioral graph: three engines reading the same fingerprint, the same baseline, the same audit log. Hive Protect, Evasion Guard, and Sub-Stats-Bot solve narrow slices; Reddit's native filters operate opaquely at platform scale. Sentinel uniquely offers (a) 90-second statistical brigade detection with mod-visible signal breakdowns, (b) dual-signal ban-evader scoring (behavior × stylometry) with a side-by-side evidence view, and (c) 1–2 hour thread-escalation forecasts with mitigation projections. The demo lands on one screenshot: cluster graph + Memory side-by-side + Health Score gauge in a single pinned post. No competing tool can produce that screenshot.

### Demo positioning guidance derived from competitive analysis

- **Open with brigade detection, not Memory.** Q3 already mandates this, and research/02 confirms: Reddit's native ban-evasion filter is the most-discussed competitor of Memory, and judges may pattern-match Memory to "fancier mod notes." Raid Radar has no native analog.
- **Surface the 24h revert button in the demo's middle act.** Research/02 frames reversibility as the credibility moat vs Hive Protect / Evasion Guard. A 1-second clip of the audit log + "Undo" being visible is worth more than any explanatory voiceover.
- **Health Score's forecast diff ("without intervention vs with slow mode") is the third-act payoff.** Research/02 confirms no competing tool offers forward-looking mitigation projections; this is what makes Sentinel feel predictive rather than reactive.
- **Avoid framing Sentinel as a Harassment Filter competitor.** Reddit's Harassment Filter is LLM-powered and has 72% adoption in large subs (research/02). Sentinel does not contest content-level toxicity; it contests thread-velocity escalation. Conflating the two invites unfavorable comparison.

---

## Devvit-specific issues

### Blockers

- **14-day bootstrap is infeasible on install** under documented Reddit API rate limits + assumed Devvit scheduler timeouts (research/04 § Bootstrap Feasibility; research/05 Q3). Captured in Broken Assumption A; remediation in Revision R1.

### Rate-limit risks

- **Reddit OAuth ~60 req/min** throttles bootstrap and Memory's periodic banned-index scans (research/04 § Rate Limits and Quotas). Lazy bootstrap (R1) and ≥6h scan cadence (already in `04-engine-memory.md` line 171) keep usage bounded. Memory's "every 6h scan against banned-index" needs to fit within the rate budget: if a banned index has 100 users and each user's fingerprint requires ~10 API calls to refresh, that is 1,000 calls per scan window; at 60/min this takes ~17 minutes — well within E2's expected scheduler ceiling.
- **Cross-sub user history capped at ~100 items** (research/05 Critical Finding 1). Affects Raid Radar Signal 3 and Memory's behavioral sub-overlap. Remediation in R3. Secondary effect: Memory's `subOverlap` Jaccard (`04-engine-memory.md` line 53) is computed against a bounded ~100-item sample for both compared users — Jaccard remains valid but the result is "overlap within recent 100 cross-sub comments," not "overlap across full history."
- **Modmail send rate undocumented**; research/04 assumes 10–20/min/sub conservatively. Sentinel's critical-alert volume (~1–5/day per spec) is far below this floor; low risk but listed as empirical-test item E4. If E4 reveals a tighter cap, the alert dispatcher needs to coalesce critical alerts within a 30-second window into a single modmail (this is consistent with the existing dashboard-debounce pattern in `02-architecture.md` § Alert dispatcher).
- **KV write throughput undocumented** (research/05 Q7). 5-second debounce per thread is the primary mitigation; remediation in R6 + empirical-test item E3. Worst-case write pressure: a brigade producing 50 comments in 10 seconds, with 5-second debounce, generates ~2 thread-state writes + ~50 user-fingerprint updates + ~5 baseline updates = ~57 writes for 10 seconds = ~6 writes/sec. Far below any plausible Devvit throughput floor; the debounce serves to bound burst behavior, not steady-state load.

### Convention conflicts

- **Multi-key "atomic" persistence** — Devvit Redis is single-key atomic; remediation in R5.
- **5-second debounce** requires manual KV CAS implementation; remediation in R6.
- **Cluster graph DOM budget** is borderline on mobile; remediation in R9.
- **onInstall lifecycle hook** must not block on data backfill (research/04 § Install Hook). Bootstrap must be non-blocking; the 24h fetch in R1 fits this constraint where the 14-day fetch does not.
- **Supplementary Devvit docs URL (`https://developers.reddit.com/docs/introduction/intro-mod-tools`) was not retrievable** via WebFetch from this environment; deepwiki and the GitHub docs index also produced no additional quota/limit numbers. The three still-unknown items (Q4/Q6/Q7 from research/05) therefore remain empirical-test items rather than design constraints.

---

## Plan Review Items (challenges to `01-product-decisions.md`)

### PRI-1 — Q12 Onboarding mechanism

- **Decision being challenged:** Q12 ("Working from minute one. History bootstrap on install. Transparent 'still learning' banner for first 7 days") and its sub-step "Background: fetch last 14 days of activity, compute initial baselines."
- **Why research challenges it:** The 14-day fetch is computationally infeasible within the assumed Devvit scheduler timeout under Reddit's OAuth rate limit (research/04 § Bootstrap Feasibility; research/05 Q3). Research/04 frames this as "Blocker. Cannot meet '14-day bootstrap' requirement as written." The Q12 principle ("working from minute one, accuracy improves over 7 days") survives intact; only the mechanism (14-day fetch) fails.
- **Alternative the lead might consider:** 24-hour initial fetch on install + 7-day passive baseline accumulation via the existing calibration ramp window. Welcome modal copy adjusted from "scanning your sub's last 14 days" to "starting your baseline; accuracy improves over the next 7 days." Calibration ramp banner extends naturally to cover the warm-up period.
- **Severity:** Blocker for the decision's mechanism; cosmetic for the decision's principle.
- **Cascading changes if amended:** (1) `07-onboarding-and-install.md` Step 3 + Step 4 modmail copy + Step 5 banner (Revision R1); (2) `02-architecture.md` `bootstrapBaseline()` signature + `bootstrapComplete` flag semantics (the flag becomes "initial fetch complete," not "baseline ready"); (3) `08-build-plan.md` Milestone 1 deliverable wording; (4) `00-architectural-summary.md` "Bootstrap window: 14 days" critical-threshold row.
- **Action:** Surfacing only — not proposing reversal. Lead decides whether to amend Q12's "Behavior on install" sub-section in Phase 2. If lead approves: cascade R1 + R12 into the spec. If lead rejects: an extended bootstrap window with mandatory upfront wait conflicts with the "live from minute one" promise, and Q12 must be revisited from scratch.

(No other Q-decisions are challenged by research. Q1–Q11, Q13–Q15 and the cross-cutting principles survive the evidence base.)

---

## Recommended plan revisions

Ordered by materiality (blockers → risky → cosmetic). Each revision uses the structured block format.

### File: sentinel-spec/07-onboarding-and-install.md
**Section:** Step 3 — Background bootstrap (lines 53–68); Step 4 modmail copy (lines 73–101); Step 5 calibration ramp (lines 103–113)
**Current:** Bootstrap fetches the sub's last 14 days of posts (paginated, max 1000 posts) and each post's top 100 comments. Welcome modal copy says "scanning your sub's last 14 days of activity to learn what 'normal' looks like. This takes about 2 minutes and runs in the background."
**Proposed:** Replace the 14-day fetch with a 24-hour initial fetch (paginated, ≤500 posts), then rely on the existing 7-day calibration ramp for passive baseline accumulation. Update welcome modal copy to "Starting your baseline now — accuracy improves over the next 7 days as Sentinel learns your sub." Step 4 modmail copy: replace bootstrap completion stats with "Sentinel is now active. Detection runs immediately; accuracy improves over the next 7 days as your baseline warms up." Step 5 banner remains essentially as-written but is now the canonical cold-start UX, not transparency cover for a completed bootstrap.
**Reason:** 14-day fetch is infeasible at ~140K API calls (research/04 § Bootstrap Feasibility); 24h fetch fits within assumed 5–30min scheduler timeout. The calibration ramp window (Q12) already exists and absorbs the warm-up cost without changing the user-facing promise.
**Materiality:** blocker
**Implementation cost:** small

### File: sentinel-spec/02-architecture.md
**Section:** Statistical primitives § RollingStat (lines 216–232); SubBaseline § Rolling window stats annotation (line 46); Settings advanced § baselineWindowDays (line 349)
**Current:** `SubBaseline` is annotated as "Rolling window stats (last 14 days)" and uses `RollingStat` (Welford's). `baselineWindowDays` defaults to 14.
**Proposed:** Pin full-history Welford semantics; remove "rolling window" framing. Annotate `SubBaseline` as "Online (full-history) stats, seeded by 24h bootstrap, accumulated continuously." Remove `baselineWindowDays` from advanced settings (the setting has no semantic meaning under full-history Welford). Aging of underlying data is handled by the existing 90-day user-fingerprint retention; sub baselines themselves do not age out.
**Reason:** Welford's algorithm does not natively support sliding windows; the "rolling 14d" framing is ambiguous and will produce divergent implementations (research/03 Item 4). Full-history Welford is simpler and matches the existing code skeleton in `02-architecture.md` lines 220–232.
**Materiality:** blocker
**Implementation cost:** trivial (text + remove one settings field)

### File: sentinel-spec/03-engine-raid-radar.md
**Section:** Signal 3 — Sub-overlap concentration (lines 51–58); Edge cases (lines 222–229)
**Current:** "Do the new arrivals share another sub in common? Fires when share_pct > 70% AND top_shared_sub != currentSub." No documented data-availability constraint.
**Proposed:** Document explicitly that `subOverlap` is computed against the ~100 most-recent comments per user (the Devvit cross-sub data cap per research/05 Critical Finding 1 / Hive Protect's published behavior). Reword to: "Across new arrivals' last ~100 cross-sub comments, what fraction share a single external sub? Fires when `share_pct > 70%`." Add edge case: "Slow infiltration spanning more than ~100 cross-sub comments per attacker is invisible to Signal 3 by data-source design; Memory's behavioral profile is the secondary catch."
**Reason:** Cross-sub user history is capped at ~100 items (research/05 Critical Finding 1). Silent omission produces incorrect implementer assumptions. The signal still fires correctly for active brigades, which is the primary use case.
**Materiality:** blocker (correctness-of-spec, not correctness-of-detection)
**Implementation cost:** trivial

### File: sentinel-spec/05-engine-health-score.md
**Section:** Signal 2 — Sentiment swing (line 65)
**Current:** "lightweight lexicon-based sentiment scoring — no need for ML or external APIs. A simple word-list scorer (positive words +1, negative words -1, normalized) is enough at this fidelity. Use AFINN-style word lists."
**Proposed:** Pin the lexicon as AFINN-2015-en (the most-cited variant for microblog/short-text). Add a small emoji-→-score extension table embedded in the bundle (e.g., 😤=-2, 💀=-1, 🤡=-1, ❤️=+2, 👍=+1; ~30 emoji total). Specify token handling: case-fold, strip punctuation, look up each token in the AFINN+emoji combined map, sum, divide by token count, clamp to [-1, +1]. Non-ASCII tokens absent from the lexicon return 0 (neutral fallback). Document that non-English subs will receive degraded sentiment accuracy.
**Reason:** AFINN variant unspecified; English-only; emoji uncovered; negation/intensifier handling omitted (research/03 Item 2). Pinning a variant + emoji extension + neutral fallback closes the gap without expanding scope.
**Materiality:** risky
**Implementation cost:** small (ship lexicon JSON + emoji table; ~50KB bundle add)

### File: sentinel-spec/02-architecture.md
**Section:** Alert dispatcher § dispatchAlert (lines 276–298); Alert record (lines 128–153)
**Current:** `dispatchAlert(alert)` performs five steps (persist, update open set, update dashboard, send modmail, append audit) framed as "Atomic persistence to KV" (per `00-architectural-summary.md` line 32).
**Proposed:** Replace "atomic" framing with idempotent retry semantics. Each step is keyed by `alertId`. Step order is: (1) persist `sentinel:alert:{alertId}` with `dispatchState: 'pending'`; (2) add to `sentinel:alerts:open` sorted set; (3) append audit log; (4) update dashboard pinned post (debounced); (5) send modmail if critical; (6) set `dispatchState: 'complete'` on alert record. Crash recovery: on startup (or on each tick of `sentinel.every_5m.refresh_thread_health`), scan recent alerts where `dispatchState == 'pending'` and replay steps 2–5. All steps are idempotent (set membership; audit log entries keyed by alertId; dashboard refresh is read-and-render; modmail dedup-keyed by alertId).
**Reason:** Devvit Redis is single-key atomic; multi-key "atomic" persistence is not a primitive (research/04 § Spec Patterns That May Conflict). Idempotent retry is the standard pattern for the same constraint.
**Materiality:** risky
**Implementation cost:** small

### File: sentinel-spec/02-architecture.md
**Section:** Event ingestion § Debouncing (lines 207–208); ingestComment signature (lines 196–201)
**Current:** "Debouncing matters: A brigade fires 50 comments in 10 seconds. Don't re-evaluate Raid Radar on every single comment — debounce engine evaluations to once per 5 seconds per thread." No implementation mechanism specified.
**Proposed:** Document the debounce pattern explicitly. Add a `sentinel:thread:{postId}:lastEval` key (TTL ~60s). Before invoking any engine evaluation: `last = await redis.get('sentinel:thread:{postId}:lastEval')`; if `last && now - last < 5000`, skip; else `redis.set('sentinel:thread:{postId}:lastEval', now)` and evaluate. Annotate as "approximate debounce — concurrent handlers may race; the 5s budget is a soft floor." Apply identically across all engines for consistency.
**Reason:** Devvit triggers do not provide built-in debounce; manual KV CAS is the only reliable pattern (research/04 § Spec Patterns That May Conflict).
**Materiality:** risky
**Implementation cost:** trivial

### File: sentinel-spec/04-engine-memory.md
**Section:** Stylometry similarity (lines 96–116); UserFingerprint § stylometry (lines 80–93); StylometryProfile § topNgrams + vocabulary (lines 88–93)
**Current:** Cosine similarity over numeric stylometry vector with no normalization. Top-50 trigrams extracted with no preprocessing spec. Vocabulary is `Set<string>` with no cap or aging.
**Proposed:** (a) Specify that the numeric stylometry vector is L2-normalized before cosine: `vec_normalized = vec / sqrt(sum(vec[i]^2))`. (b) Pin trigram preprocessing as: lowercase the entire comment, collapse all whitespace runs to a single space, strip leading/trailing whitespace, then extract overlapping 3-character windows; this must be identical across fingerprint comparisons. (c) Cap the vocabulary at top-N most-frequent words, N=2000 by default. Maintain via a Map<word, count>; when the map exceeds 2500 entries, drop the lowest-frequency 500. Document in the spec that vocabulary is a frequency-bounded structure, not a raw Set.
**Reason:** Un-normalized cosine biases toward magnitude-dominant features (research/03 Item 3). Trigram extraction without case-folding/whitespace produces inconsistent matches (research/03 Item 6). Vocabulary Set grows unbounded — 10K+ tokens per high-volume user is plausible (research/03 § Vocabulary Set unbounded growth). All three are silent correctness/scale risks.
**Materiality:** risky
**Implementation cost:** small

### File: sentinel-spec/02-architecture.md, sentinel-spec/04-engine-memory.md
**Section:** `02-architecture.md` Histogram class (lines 252–261); `04-engine-memory.md` Signal A behavioral similarity (line 51) and Signal B stylometry similarity (line 112)
**Current:** `Histogram` exposes `add`, `percentile`, `entropy` but no bucket specification. `histogramOverlap(...)` is called but the function is undefined.
**Proposed:** Pin bucket schemas per histogram type: posting-time → 24 buckets (one per UTC hour, matches the `number[24]` already in `02-architecture.md` line 77); account-age → 10 buckets (0–7d, 7–30d, 30–90d, 90–180d, 180d–1y, 1–2y, 2–5y, 5–10y, 10y+, unknown); comment-length → 5 buckets (0–50, 50–200, 200–500, 500–1500, 1500+ chars); emoji-usage → top-10-by-frequency (already implicit). Pin the overlap formula as histogram intersection: `overlap(a, b) = sum_i min(a[i]/sum(a), b[i]/sum(b))`. Document boundary handling: upper-exclusive on all buckets except the final open-ended bucket.
**Reason:** Bucket count and overlap formula are undefined (research/03 Item 8). Multiple valid formulas exist (Bhattacharyya, intersection, chi-squared, Hellinger) with different behavior. Pinning intersection is simplest to implement and well-understood in moderation tooling.
**Materiality:** risky
**Implementation cost:** trivial

### File: sentinel-spec/06-dashboard-and-ui.md, sentinel-spec/03-engine-raid-radar.md
**Section:** `06-dashboard-and-ui.md` § Tab: Threats (lines 60–77); `03-engine-raid-radar.md` § Dashboard panel § Middle: Cluster visualization (lines 184–188)
**Current:** Cluster graph (SVG, ~30–50 nodes + edges) renders inline on the Threats tab; no lazy-load or node-count cap mentioned.
**Proposed:** (a) Lazy-load the cluster graph — render only after the user explicitly opens a specific alert's detail view, not on tab open. (b) Cap visualization to ≤20 nodes; collapse the remainder into a "+N more accounts" badge. (c) Render in a fixed-height container (e.g., 320px) to prevent layout shift. (d) Re-render only on cluster change, not on every dashboard tick (cache the rendered structure in app memory keyed by alertId). Add to `06-dashboard-and-ui.md` § Mobile considerations: "Cluster graph is the heaviest widget; lazy-load and cap to 20 nodes."
**Reason:** Devvit Blocks rendering complexity is borderline on mobile; 200+ DOM elements per cluster is plausible at 30–50 nodes; Lighthouse flags >1500 total DOM nodes (research/04 § Custom Post Complexity; research/05 Q9). Mitigations preserve the demo screenshot at low risk.
**Materiality:** risky (cosmetic-to-risky boundary; non-blocking)
**Implementation cost:** small

### File: sentinel-spec/04-engine-memory.md
**Section:** Banned-user index (lines 175–188)
**Current:** "Memory keeps a fast index of banned-user fingerprints for comparison. When a `ModAction` event with action=`banuser` fires: The full fingerprint is preserved (overrides 90-day aging policy); Added to the banned index; Tagged with the ban reason and timestamp." No mention of cross-app persistence or uninstall-survival.
**Proposed:** Add an explicit note: "The banned index lives in Devvit Redis and is per-app-installation. Uninstall/reinstall wipes the index — this is acceptable for v1 (mods would not expect cross-install memory). Future v2 may persist banned-user fingerprints to Reddit Mod Notes for cross-app survival; the read/write capability is demonstrated by the `toolboxnotesxfer` Devvit app but the API signatures are not officially documented (research/01 cap #19; research/05 Q5). v1 does not attempt this integration."
**Reason:** Implicit assumption of cross-install persistence is unsupported; the documented Devvit storage model is per-installation (research/01 cap #19, research/05 Q5). Surface the limitation explicitly and defer Mod Notes work to v2.
**Materiality:** risky (uninstall-reinstall is rare; documentation gap is the real risk)
**Implementation cost:** trivial

### File: sentinel-spec/08-build-plan.md
**Section:** Milestone 1 (lines 15–28); Risk register (lines 189–222)
**Current:** Milestone 1 includes "Devvit project skeleton, KV schema, statistical primitives, event ingestion, bootstrap job, settings storage, welcome modal." Risk register mentions a "1-day spike at the start of Milestone 1" for verifying Devvit API surface but does not call out runtime quotas.
**Proposed:** Add an explicit "Milestone 0 — Phase 0 Empirical Spike (1 day, before Milestone 1)" that tests on a private sub: (1) Redis storage write of a 1MB payload to a single key (validates per-key bounds, surfaces quota errors); (2) Redis write throughput stress test (write 100 keys/sec for 60 seconds, measure errors); (3) Scheduler one-off job duration test (run a job that loops for 5/10/30 minutes, log when it terminates); (4) Modmail send rate test (send 30 modmails in 60 seconds, measure errors); (5) `accountCreatedAt` vs `created_utc` field probe on a known user object. Record results in a new file `sentinel-spec/research/06-runtime-probes.md`. Use results to lock final values for `baselineBootstrapMaxDuration`, `kvDebounceTTL`, and `modmailBurstCap`.
**Reason:** Three runtime unknowns remain officially undocumented (research/05 Q4/Q6/Q7) and modmail rate is similarly undocumented. Designing around assumed values is the dominant risk to Milestone 1; a 1-day spike retires that risk before code is built (research/05 § Critical Findings 2).
**Materiality:** risky → leverage (one day spent now retires multi-day rework later)
**Implementation cost:** small (1 day, dedicated probes)

### File: sentinel-spec/07-onboarding-and-install.md
**Section:** § What happens during the 7-day calibration (lines 117–126); § Calibration ramp banner (lines 103–113)
**Current:** During calibration ramp: "Confidence scores are slightly conservative (multiply by 0.85); Critical-severity alerts require higher confidence (0.92 instead of 0.85); Auto-actions are NOT taken even if mods opted in — they activate only after day 7; 'Calibrating' badge shows on every alert during this period."
**Proposed:** Keep the existing 7-day mechanics. Extend the rationale paragraph: "Under the 24-hour initial bootstrap (revised from 14 days; see R1), the calibration ramp is doing double duty: it absorbs the warm-up cost in addition to its original transparency role. Sub baselines stabilize meaningfully around day 3–4 once full-history Welford has accumulated enough samples; the 7-day window is a conservative buffer." Banner copy adjustment: "Sentinel is calibrating to your sub. Detection is active — accuracy improves as your baseline accumulates over the next 7 days. Current accuracy estimate: 72% (improving)."
**Reason:** Bootstrap revision (R1) shifts baseline warm-up from "completed in 2–10 minutes" to "accumulates over 7 days." The calibration ramp UX needs to absorb the shift without breaking the Q12 promise of "live from minute one."
**Materiality:** cosmetic (text + rationale; mechanism unchanged)
**Implementation cost:** trivial

### File: sentinel-spec/02-architecture.md
**Section:** Mod action API § performModAction (lines 305–318); cross-referenced reminder (line 329)
**Current:** `performModAction` accepts `action: 'lock_thread' | 'enable_slow_mode' | 'filter_new_accts' | 'remove_post' | 'ban_user'` and a `parameters` field. A prose reminder below the function notes that `remove_post` and `ban_user` "are NEVER triggered automatically. They're available for mods to invoke from the dashboard, but only by direct mod click — never by Sentinel auto-action."
**Proposed:** Strengthen the API surface to enforce Q9 at the type level. Split into two functions: `performAutoModAction` (action types restricted to `'lock_thread' | 'enable_slow_mode' | 'filter_new_accts'`) and `performManualModAction` (full action set, requires `modUsername` of a real mod, not `'sentinel-bot'`). The dashboard's "Ban" and "Remove" buttons call the latter; engines call only the former. Add a runtime guard: `performAutoModAction` rejects with an error if invoked with a manual-only action. Update the cross-reference in the prose to match.
**Reason:** Q9 is the cross-cutting principle most likely to be violated by a tired implementer at 2am: a single line of code adding `'ban_user'` to an auto-action branch would silently break the Reversible-by-default principle. Encoding the constraint at the type level prevents this without changing the spec's intent.
**Materiality:** risky (defense-in-depth for the single most important behavioral commitment in the spec)
**Implementation cost:** trivial

### File: sentinel-spec/02-architecture.md
**Section:** Devvit Redis schema § Storage budget (line 173); cross-reference: `03-engine-raid-radar.md` Performance budget (line 237), `05-engine-health-score.md` Performance budget (line 264–266)
**Current:** "Storage budget per sub: roughly 500MB upper bound for ~10K active commenters. Aging policy keeps it bounded indefinitely." The 500MB figure is repeated implicitly in the per-engine performance budgets but no eviction policy is defined for when the ceiling is approached.
**Proposed:** Mark the 500MB figure as "assumed; confirm via E1." Add an explicit eviction policy section: when total `sentinel:*` keys exceed 80% of measured ceiling, the daily purge job (`sentinel.daily.purge_inactive_users`) drops its inactivity threshold from 90 days to 60 days; at 95% the threshold drops to 30 days (banned users still retained). Audit log entries beyond 30 days are pruned at 90% utilization; the cap drops from 1000 to 500 entries at 95%. Threshold values are placeholders until E1 establishes the real ceiling.
**Reason:** The 500MB figure is an assumption (research/04 § Rate Limits and Quotas; research/05 Q4 still-unknown). No graceful-degradation policy exists for the case where the assumption is wrong; without one, a high-volume sub could trigger unrecoverable storage rejection.
**Materiality:** risky
**Implementation cost:** small (one daily job edit; placeholder thresholds until E1 lands)

### File: sentinel-spec/05-engine-health-score.md
**Section:** Forecast generation § velocity reduction assumption (lines 169–175)
**Current:** "If slow mode were enabled (velocity drops 70%) const mitigatedTrajectory = trajectory * 0.3;" The 70% reduction is a hardcoded constant in the forecast formula.
**Proposed:** Add a comment noting that the 70% figure is an assumption pending E5 validation. Introduce a configurable `slowModeVelocityImpact` parameter (default 0.7) in `SubSettings.advanced` so the forecast can be re-tuned per sub once empirical data exists. Document in the spec: "If E5 measures a substantially different impact, update the default; mods may also tune per-sub if their community responds atypically."
**Reason:** The 70% drop is a spec open question (`00-architectural-summary.md` Open Question 4) and is fed directly into the demo's "without intervention vs with slow mode" forecast panel — the engine's third-act payoff. If real impact diverges, the forecast loses credibility (research/03 implicit, research/04 implicit).
**Materiality:** cosmetic (forecast accuracy concern, not blocking)
**Implementation cost:** trivial

### Revision summary table

| ID | File | Materiality | Cost | Primary research source |
|---|---|---|---|---|
| R1 | 07-onboarding-and-install.md | blocker | small | research/04 § Bootstrap Feasibility |
| R2 | 02-architecture.md (RollingStat / SubBaseline) | blocker | trivial | research/03 Item 4 |
| R3 | 03-engine-raid-radar.md (Signal 3) | blocker | trivial | research/05 Critical Finding 1 |
| R4 | 05-engine-health-score.md (Signal 2) | risky | small | research/03 Item 2 |
| R5 | 02-architecture.md (dispatchAlert) | risky | small | research/04 § Spec Patterns That May Conflict |
| R6 | 02-architecture.md (Event ingestion debounce) | risky | trivial | research/04 § Spec Patterns That May Conflict |
| R7 | 04-engine-memory.md (Stylometry) | risky | small | research/03 Items 3 + 6 + Vocabulary growth |
| R8 | 02-architecture.md + 04-engine-memory.md (Histogram) | risky | trivial | research/03 Item 8 |
| R9 | 06-dashboard-and-ui.md + 03-engine-raid-radar.md (cluster graph) | risky | small | research/04 § Custom Post Complexity |
| R10 | 04-engine-memory.md (Banned-user index) | risky | trivial | research/01 cap #19; research/05 Q5 |
| R11 | 08-build-plan.md (Phase 0 spike) | risky-leverage | small | research/05 Critical Finding 2 |
| R12 | 07-onboarding-and-install.md (Calibration banner) | cosmetic | trivial | derived from R1 |
| R13 | 02-architecture.md (performModAction) | risky | trivial | Q9 cross-cutting principle defense |
| R14 | 02-architecture.md (Storage eviction) | risky | small | research/04 § Rate Limits and Quotas; research/05 Q4 |
| R15 | 05-engine-health-score.md (slowModeVelocityImpact) | cosmetic | trivial | spec open question 4 |

**Application order suggestion:** R1 → R2 → R3 (blockers, applied first; they touch the most spec files and unlock the rest). Then R5 → R6 → R13 → R14 (architecture-layer risky items; same file). Then R4 → R7 → R8 → R10 (engine-layer risky items). Then R9 (UI risky). Then R11 (spike — kicks off before Milestone 1). Then R12 → R15 (cosmetic copy/parameter tweaks). All revisions are independent in mechanism; ordering is pragmatic, not hard-required.

---

## Things to leave alone

- **Q1 Project scope (build all three engines)** — competitive landscape validates the platform thesis (research/02). Cutting an engine cuts the differentiator.
- **Q2 Demo environment (private test sub + scripted alts)** — required by hackathon rules; no research signal against it.
- **Q3 Demo narrative lead (Raid Radar)** — cluster-graph visual impact is the most cinematic, and revision R9 preserves it.
- **Q4 Statistical brain (baseline + z-scores + signal stacking)** — research/03 validates the approach: O(1) updates, explainable, debuggable, no training data needed. The most important decision in the spec stands intact.
- **Q5 Dual-signal Memory (behavior + stylometry combined)** — research/02 confirms no Devvit app does dual-signal; combination corrects single-signal false positives.
- **Q6 Health Score (baseline + trajectory)** — research/03 validates sigmoid normalization and trajectory amplifier shape.
- **Q7 Tiered settings** — research/04 § Conventions to Adopt supports `context.settings` pattern; Q7 already maps to it.
- **Q8 Alert delivery (dashboard + modmail by severity)** — research/02 Mod Insights gap shows dashboard need; modmail-as-pager pattern is standard.
- **Q9 Suggest, don't auto-ban** — research/02 frames this as the explicit differentiator vs Evasion Guard/Hive Protect's auto-ban posture. Trust posture is core to the listing.
- **Q10 Sliding-window memory (100 comments/user, 90d retention, permanent banned)** — research/03 Item 5 confirms scale fits under the assumed 500MB budget.
- **Q11 First-mod-wins + audit log + 24h revert** — research/02 calls reversibility a competitive advantage; Q11 is the mechanism.
- **Q13 Demo video structure** — out of research scope; survives.
- **Q14 False-positive feedback loop** — research/03 supports threshold adjustment as a learning mechanism without ML. Mechanism stands.
- **Q15 App listing strategy** — competitive thesis (research/02 differentiation paragraph) reinforces the brigade-screenshot lead.
- **Three-engine architecture and shared behavioral graph** — research/02 names this as the moat.
- **Storage schema overall structure** (`02-architecture.md` § Devvit Redis schema) — namespacing pattern is correct; only the dispatchAlert atomicity framing changes (R5).
- **Sigmoid normalization (`sig(x – k)`)** — research/03 Item 7 validates the shape and saturation behavior.
- **Statistical primitives (RollingStat / TimeSeries / Histogram)** — survive with the Welford clarification (R2) and bucket pinning (R8).
- **Audit log retention (capped 1000 entries, 30-day retention)** — bounded and consistent with Q11; no research challenge.
- **Severity routing table** (`02-architecture.md` § Severity routing) — research/02 supports two-channel pattern.
- **Watching scope (50 threads max per sub, last-6-hour active window)** — `05-engine-health-score.md` § Watching scope. The 50-thread cap × ~10KB per thread = 500KB max per sub fits comfortably; research/03 Item 5 validates the math at this scale.
- **Trigger set** (`PostSubmit`, `CommentSubmit`, `ModAction`, `PostReport`/`CommentReport`, `AppInstall`, `AppUpgrade`) per `02-architecture.md` § Triggers used — research/01 caps #3–#7 validate availability and payload usability.
- **Mod menu items on posts/users/comments** (`06-dashboard-and-ui.md` § Mod menu items) — Devvit supports menu item registration; this is standard ergonomics.
- **Daily/hourly/5min/6h scheduler cadence** (`02-architecture.md` § Scheduler jobs) — research/01 cap #16 confirms scheduler exists. Specific timeouts gated by E2.
- **Welcome modal copy structure** (`07-onboarding-and-install.md` Step 2) — only the bootstrap-time language is affected by R1; the form structure, default selections, and "tiered settings on first screen" pattern (Q7) all survive.

### Cross-cutting observations

- **The "shared infrastructure" thesis is the architectural keystone.** Every revision in this report respects the pattern that engines do not call each other directly — they all read the same graph (`02-architecture.md` line 30). None of the proposed changes break that invariant.
- **The "production-ready over impressive-looking" principle (Q4 cross-cutting)** is reinforced by accepting these revisions. The 14-day bootstrap and the "atomic" multi-key dispatch look impressive in the spec; the 24h fetch and the idempotent retry are what survive contact with the Devvit runtime.
- **The "honest > impressive" principle** carries through: the "still learning" banner becomes load-bearing under R1 + R12, not decorative. Mods get honest cold-start framing instead of a false promise of "ready in 2 minutes."

---

## Empirical-test items (deferred to build phase)

The 3 still-unknown items from research/05 plus five additional items requiring runtime testing. Designed to be retired by a 1-day Phase 0 spike (R11). Do NOT design solutions; record observed values and update spec parameters in Phase 2 follow-up.

- **E1 — Redis quotas (Q4 from research/05).** Approach: write a payload of 1MB to a single key, then 10MB, then 100MB; observe whether writes succeed silently, return an error, or trigger eviction. Then write 100 keys × 1KB, 1000 keys × 1KB, 10000 keys × 1KB; observe at what point writes fail or slow. Record per-app and (if separable) per-sub ceiling. Pass/fail criterion: ceiling ≥ 100MB per sub for v1. If ceiling is lower, R14's eviction policy thresholds drop accordingly. Block on this before expanding R14's defaults.
- **E2 — Scheduler max job duration (Q6 from research/05).** Approach: schedule a one-off job that performs a tight CPU loop with a counter logged every 30 seconds; let it run for 60min target. Record the duration at which Devvit terminates the job (and whether it emits a timeout error or kills silently). Repeat with an I/O-bound job (Redis writes in a loop) to detect any difference in behavior between CPU-bound and I/O-bound timeouts. Pass/fail criterion: timeout ≥ 5 minutes for the lazy bootstrap. If shorter, R1's 24h fetch must be chunked across multiple scheduled jobs.
- **E3 — KV write throughput (Q7 from research/05).** Approach: write 100 keys/sec, 1000 keys/sec, 10000 keys/sec for 60s each; measure success rate and p50/p95/p99 write latency. Record any rate-limit errors and the recovery time. Pass/fail criterion: ≥10 keys/sec sustained throughput per app; observed latency p99 < 500ms. If lower, the 5-second debounce in R6 needs to widen to 10s or more.
- **E4 — Modmail send rate.** Approach: send 30 modmails in 60 seconds from one app, then 60 in 60s, then 100 in 60s. Record the rate at which sends start failing or get queued. Pass/fail criterion: ≥10 modmails/min sustained; this is well above Sentinel's expected burst (~1–5/day per spec). If lower, batch critical alerts within a 30s window into one summary modmail.
- **E5 — Slow-mode velocity impact** (open question from `00-architectural-summary.md`). Approach: enable slow mode on an active thread in the test sub during scripted brigade simulation; measure comments/min for the 30 minutes before vs the 30 minutes after. Account for natural decay (control thread comparison if available). Pass/fail criterion: observed reduction is within ±20% of the spec's 70% assumption. If outside, adjust R15's `slowModeVelocityImpact` default and re-derive forecast formula constants.
- **E6 — Trigram extraction + vocabulary maintenance latency** (research/03 Item 1). Approach: run the trigram extractor on 100 sample comments of length 50 / 200 / 500 / 1000 / 2000 chars; record per-comment p50/p95/p99 latency. Include the L2-normalized cosine + Jaccard similarity computation in the measured pipeline (from R7). Pass/fail criterion: <20ms p95 across all sizes. If >20ms, switch trigram + vocabulary maintenance to a batched hourly job and fall back to lazy fingerprint refinement.
- **E7 — `accountCreatedAt` field name probe** (research/05 Q2). Approach: in a minimal Devvit app, fetch a known user object via the SDK and log `Object.keys(user)`. Confirm whether the field is exposed as `createdAt`, `created_utc`, both, or neither. Pass/fail criterion: at least one of the two field names is present. If neither, Raid Radar Signal 2 (account-age clustering) needs replacement — `08-build-plan.md` Risk Register already names this contingency; act on it then.
- **E8 — Custom-post DOM node count at peak** (research/04 § Custom Post Complexity; research/05 Q9). Approach: open the full dashboard with cluster graph rendered (20 nodes per R9), all 5 tabs interacted with, KPI tiles populated, and an alert detail modal expanded; use a DOM-count helper to measure total nodes and time-to-interactive on a mid-range mobile device (e.g., iPhone SE / Pixel 4a / Reddit native app on slow 4G). Pass/fail criterion: <1000 DOM nodes total, <2s TTI. If exceeded, apply additional lazy-loading per the R9 mitigation.

Empirical results from this spike should land in `sentinel-spec/research/06-runtime-probes.md` (new file) and feed back into spec parameter values during a Phase 2 follow-up pass. Each item above lists pass/fail criteria so the spike is decision-driving rather than data-collecting; if any item fails, the corresponding revision's defaults adjust before Milestone 1 begins.

---

## Phase 2 application notes

**For the lead applying this report:**

1. **Decide PRI-1 first.** Q12's mechanism revision is the gating item. If PRI-1 is approved as proposed (24h fetch + 7-day passive accumulation), R1, R2, and R12 can apply mechanically. If PRI-1 is rejected, the entire bootstrap stack needs redesign and this report's recommendations downstream of R1 require re-examination.

2. **Apply blockers in one editing session.** R1, R2, and R3 all touch foundational documents (`02-architecture.md`, `03-engine-raid-radar.md`, `07-onboarding-and-install.md`). They are independent in mechanism but coherent in framing — the lead should apply all three together so the spec reads consistently.

3. **R5 + R6 + R13 + R14 form a cluster.** All four touch `02-architecture.md` and concern the alert dispatcher / ingestion / mod-action surface. Apply together; renumber if it improves readability.

4. **R11 (Phase 0 spike) is the only schedule-additive item.** Schedule it for the calendar day before Milestone 1 begins. Block on its results before locking parameter values for `kvDebounceTTL`, `baselineBootstrapMaxDuration`, and `slowModeVelocityImpact`. If the spike reveals values that contradict assumptions in this report, this report's recommendations adjust accordingly — surface that as a Phase 2.5 follow-up if it occurs.

5. **R12 + R15 are copy/parameter tweaks.** Apply at the end; minimal review burden.

6. **Cascading citations.** Where a revision changes a parameter that appears in `00-architectural-summary.md` (e.g., the "Bootstrap window: 14 days" critical-threshold row, or the "Rolling stats" mention in the schema table), update both files in lockstep. The architectural summary is a derived artifact; if it diverges from the engine specs, future readers will trust the wrong source.

**For Phase 3 (ultraplan):**

- Treat R11 (the Phase 0 spike) as the first item in the build plan, before Milestone 1.
- Accept that empirical-test items E1–E8 may invalidate one or more assumptions in this report. Plan a Phase 2.5 mini-revision pass after the spike completes.
- The "Things to leave alone" section is the safest part of the spec; ultraplan can reference those parts without re-validation.

**For Phase 4 (design briefs):**

- Each revision in this report maps to one or more component-implementer tasks. The Revision summary table is the natural seed for design briefs: file + materiality + cost + research source maps directly to ROLE/CONTEXT/TASK/OUTPUT.
- Components touching the alert dispatcher, ingestion module, and stylometry pipeline carry the highest revision density; brief these with extra context.

**For Phase 5 (build):**

- Milestone 1 should not begin until R1, R2, R3 are applied and the Phase 0 spike has produced results.
- The 24h cold-start window means the demo subreddit's pre-population script (`08-build-plan.md` Risk register: "Demo sub doesn't have enough activity for realistic baseline") becomes more important. Schedule pre-population at least 2 weeks before demo recording so the test sub has a real baseline accumulating.

---

## Risks not addressed by this report

In service of "honest > impressive" (`01-product-decisions.md` cross-cutting principles), the limits of this review:

1. **Reddit API surface evolution.** This report is anchored to research conducted in early Phase 1. Reddit's developer platform may publish documentation between now and build start that resolves Q4/Q6/Q7 — re-check the supplementary URL (`https://developers.reddit.com/docs/introduction/intro-mod-tools`) at the start of the Phase 0 spike. Today's WebFetch attempt failed; that may not be the case in 1–3 days.

2. **Hackathon submission rule changes.** Devpost's hackathon page (research/02 source #17) is live but submission detail is not publicly visible to non-participants. If the hackathon adds new mandatory criteria (e.g., publishing source code, demo length changes), this report has no signal on them.

3. **No primary-source Devvit testing.** Every research claim about Devvit's runtime is inferred from third-party apps (Hive Protect, Evasion Guard, automodmail, modmail-userinfo, toolboxnotesxfer, auto-post-lock) or community tutorials. The Phase 0 spike (R11) is the first time Sentinel actually touches the Devvit runtime; all conclusions in this report are provisional until E1–E8 land.

4. **No competitive-app deep-dive.** The competitive landscape research (research/02) identified competitors and overlap; it did not download and run each app on a test sub to compare detection accuracy or UX patterns. If a judge has used Hive Protect or Evasion Guard, they will have specific feature expectations that this report cannot anticipate.

5. **No mod-user research.** The spec assumes the target audience is mods of 10K–500K subs (Q15) but no interviews or surveys validate the workflow assumptions in `06-dashboard-and-ui.md`. The dashboard's tab structure (Threats / Users / Threads / Activity / Settings) is a senior-product hypothesis, not a tested design. If post-build testing reveals that mods navigate differently, the dashboard layout may need a small refactor.

6. **Statistical method choice in adversarial conditions.** Research/03 validates that the math is sound for normal data. It does not address adversarial inputs: an attacker who studies Sentinel's signal definitions (which are public via spec) and engineers a brigade to evade them. The spec's "honest limitation" framing covers this in principle (`04-engine-memory.md` § Edge cases mentions sophisticated evaders), but no formal threat model exists.

7. **Demo-sub realism.** The hackathon requires a <200-member sub (Q2). Sentinel's signals are calibrated for 10K–500K subs (Q15). The demo necessarily simulates rather than observes a brigade. Judges may notice. The mitigation in `08-build-plan.md` Risk register ("pre-populate the demo sub with 2 weeks of scripted alt activity") is the right plan but execution risk is real.

These items are surfaced for the lead's awareness; none of them invalidate the report's recommendations, but the lead should plan downstream work assuming none of them are fully closed.

---

## Research citation index

Quick-reference index of which research file informed which finding. Useful when re-reading the report to verify a claim.

**research/01 — Devvit Capability Matrix**

- Cap #1 (account `created_utc`): assumption B in Validated #2; field-name probe in E7.
- Cap #2 (cross-sub user history): blocker in research/05 Critical Finding 1; underlies R3.
- Caps #3–#7 (triggers): Validated #1, Validated #4, supports trigger set in Things to leave alone.
- Cap #8 (Redis storage quota): blocker → empirical-test E1 (Q4); informs R14.
- Cap #9 (custom posts): Validated #6; informs R9.
- Cap #10 (modmail): Validated #4; informs E4.
- Caps #11, #13, #14, #15 (mod actions): Validated #3.
- Cap #16 (scheduler): Validated #5; gated by E2 (Q6).
- Cap #17 (historical backfill): blocker A; underlies R1.
- Cap #19 (Mod Notes): underlies R10.
- Cap #20 (post pinning): not separately revised; survives review.

**research/02 — Competitive Landscape**

- Differentiation thesis paragraph: source for Section "Competitive risks" + demo-positioning guidance.
- Existing apps table (Evasion Guard, Hive Protect, Spam-Source-Spotter, etc.): Risks 2–3.
- Reddit-internal features table (Ban Evasion Filter, Harassment Filter, Mod Insights, AutoMod): Risk 1.
- Hardest-claim-to-defend paragraph: anchors the differentiation thesis sentences in this report.
- Hackathon overlap absence: surfaced under Things-to-leave-alone (no overlap risk to deprioritize for).

**research/03 — Statistical Methods Sanity**

- Item 1 (trigram extraction <20ms): underlies E6.
- Item 2 (AFINN brittleness): underlies broken assumption D + R4.
- Item 3 (cosine normalization): underlies broken assumption F2 + R7.
- Item 4 (Welford rolling 14d): underlies broken assumption B + R2.
- Item 5 (storage budget at scale): Validated #10.
- Item 6 (Jaccard preprocessing): underlies broken assumption F2 + R7.
- Item 7 (sigmoid normalization): Validated #9.
- Item 8 (histogram overlap): underlies broken assumption G + R8.
- Vocabulary unbounded growth: underlies R7.
- Welford's algorithm itself: Validated #11.
- Tweedie et al. 1996 (n-grams as idiolect): Validated #12.

**research/04 — Devvit Best Practices**

- § Bootstrap Feasibility: blocker A + R1.
- § Spec Patterns That May Conflict (atomic alert): underlies broken assumption E + R5.
- § Spec Patterns That May Conflict (5s debounce): underlies broken assumption F + R6.
- § Custom Post Complexity: underlies broken assumption H + R9 + E8.
- § Rate Limits and Quotas: anchors several assumptions and informs R14 + Devvit-specific rate-limit subsection.
- § Conventions to Adopt: validates Q7 tiered settings + general TypeScript/file structure assumptions.
- § Install Hook: anchors R1's "non-blocking install" requirement.

**research/05 — Devvit Verification (Round 2)**

- Q1 (cross-sub user history): Critical Finding 1 → blocker C → R3.
- Q2 (createdAt): underlies E7.
- Q3 (historical backfill): underlies R1 (with research/04).
- Q4 (Redis quotas): empirical-test E1.
- Q5 (Mod Notes): underlies R10.
- Q6 (scheduler timeout): empirical-test E2.
- Q7 (KV throughput): empirical-test E3.
- Q8 (modmail rate): empirical-test E4.
- Q9 (Blocks rendering ceiling): underlies R9 + E8.
- Critical Finding 2 (officially undocumented runtime limits): drives R11 (Phase 0 spike).
- Critical Finding 5 (createdAt inferred): drives E7.

---

*End of Plan Review Report. 15 revisions across 7 spec files (3 blocker / 10 risky / 2 cosmetic). 1 Plan Review Item (PRI-1, Q12). 8 empirical-test items deferred to Phase 0 spike. Supplementary URL fetch (developers.reddit.com/docs/introduction/intro-mod-tools) failed — no additional findings folded in; Q4/Q6/Q7 remain empirical-test items E1/E3/E2 respectively.*
