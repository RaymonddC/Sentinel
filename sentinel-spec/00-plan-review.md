# 00 · Plan Review Report (v4)

> Fourth synthesis pass on Sentinel's Phase 1 plan-review. Anchored on the 8 research files (research/01–08), the architectural summary, the engine specs, and the prior synthesis attempts. All claims cite a research file. No spec file is modified by this report; recommendations are proposals the lead applies during Phase 2.

---

## Critique of prior synthesis

v1 (opus/high) framed the review as a copy-editor's pass: 15 micro-revisions ordered by materiality with no structural argument about which spec decisions were load-bearing under hackathon constraints. The schedule-crisis overlay (v1 § Summary, lines 11–12) read the original 16-day deadline correctly but never named project scope, demo realism, or Memory cold-start as decisions worth surfacing as Plan Review Items — they were absorbed into Things-to-leave-alone (v1 lines 349, 358) or simply not raised. v1 also missed three Wave C facts entirely (5 MB write cap, no-Sets primitive, public Mod Notes API) because they had not yet been researched. v2 (opus/xhigh) preserved a sharper structural critique — six v1 failures including the under-weighted schedule risk, the Q1 scope misplacement, the R3 misclassification, the unraised demo realism, the R13 gold-plating, and the unanalyzed Memory cold-start — but was paused before the report write because the research base was too shallow to support its conclusions. v3 diverges from both: the deadline postponement to 2026-06-27 deflates v2's PRI-2 (forced scope cut) and v1's schedule-crisis dominance, while the Wave C research (research/06–08) closes most of v1's "still-unknown" empirical items, inverts v1 R10 (Mod Notes is public), adds two architectural blockers v1 missed entirely (5 MB write cap, no standard Sets), and quantifies the small-sub demo statistical mismatch v2 raised but could not yet support. v2's critique items #3, #4, #5, #6 survive intact and are reinforced; item #1 (schedule) deflates; item #2 (Q1 scope) is preserved as governance, not forced cut. Net effect: v3 keeps v2's project-manager framing but rebalances the priority axis under the new deadline and the new research.

v4 (sonnet/high) makes no structural revisions: v3 surfaced the blockers correctly but the three revision blocks addressing Wave C findings (R-Welford, R-NoSets, R-5MB-Chunking) were abstract — "pick full-history Welford," "replace Set primitive," "add chunking pattern." Wave D research (research/09 rolling-stat workaround, research/10 sets-atomicity workaround, research/11 chunking workaround) supplies concrete patterns for all three and contributes one positive discovery: Devvit Redis supports WATCH/MULTI/EXEC optimistic-locking transactions (research/10), confirmed from `redis.mdx` and the `TxClientLike` interface. With concrete patterns in hand, the materiality picture changes: R-NoSets resolves to a canonical pick (sorted-set-as-set or hash-as-set) with no redesign required — downgraded blocker → cosmetic. R-5MB-Chunking is narrowed to a single architectural fix (`banned_index` only; four other writes are safe as specified) — downgraded blocker → risky.

---

## Summary

Sentinel's architecture, three-engine thesis, statistical approach, and shared-graph keystone all survive the evidence base unchanged. The competitive landscape is favorable (research/02 + research/07) — no existing Devvit app combines brigade detection, ban-evader stylometry, and thread-escalation forecasting on a shared behavioral graph, and Reddit's own documentation on the Ban Evasion Filter self-documents the gap Memory fills (research/07). Statistical methods (Welford's, z-scores, sigmoid, cosine, Jaccard, AFINN-style sentiment) are computationally sound at Sentinel's stated scale (research/03). However, three Wave C findings required spec updates before build: (a) **Devvit Redis has a 5 MB per-request write cap** that v1 missed entirely (research/06) — Wave D research (research/11) focused the risk: only `sentinel:memory:banned_index` is a genuine oversize threat; cluster state, audit entries, per-user fingerprints, and per-thread state all top out at 30–150 KB per key and are safe as specified — materiality downgraded blocker → risky; (b) **Devvit Redis has no standard Set primitive and no key enumeration** (research/06) — Wave D research (research/10) resolves this to a pick between two canonical patterns (sorted-set-as-set for `alerts:open`, hash-as-set for `alerts:by_target`) with no redesign needed — materiality downgraded blocker → cosmetic; (c) **the Mod Notes API is fully public and typed in `@devvit/public-api`** (research/06), inverting v1's R10 deferral and unlocking optional cross-install Memory persistence in v1 instead of v2. Two structural framings also need formalization: the small-sub demo statistical mismatch quantified by research/08 (Raid Radar Signal 1 degrades to absolute-count trigger via `stddev||1`; Memory's ≥10-comment gate is functionally inoperative on a fresh <200-member sub; Health Score velocity baselines are undefined on cold threads) and Memory's cold-start condition on any new install (the banned-index requires `ModAction.banuser` history to populate). v2 framed schedule as the dominant project risk under the original 16-day deadline; the postponement to 2026-06-27 (~47 days) deflates that frame — Memory engine is back in default scope. v2's other critiques (#3 R3 misclassification, #4 demo realism, #5 R13 gold-plating, #6 Memory cold-start) survive intact and are reinforced by Wave C research. Wave D research downgraded R-NoSets (blocker → cosmetic) and R-5MB-Chunking (blocker → risky-focused). Devvit Redis transaction support (WATCH/MULTI/EXEC) was confirmed as a positive finding (research/10), enabling atomic multi-key writes for dispatchAlert without compensating-action patterns and reducing the complexity of R-Dispatch-Idempotent. Architecture is in materially better shape than v3 assessment indicated; the remaining work is now mostly applying concrete patterns rather than designing new ones. With the revisions in this report applied, Sentinel is buildable within the new hackathon window with comfortable buffer; the report recommends a Phase 0 empirical spike retargeted to the remaining unknowns (scheduler per-job timeout, 40K cmds/sec throttle behavior, slow-mode velocity impact) because research/06 has already closed Redis quotas, scheduler rate limits, Mod Notes API, and the `user.createdAt` field name. One Q-mechanism (Q12) and three honest-framing items (Q2/Q13 demo realism, Q1 scope governance, Q10 Memory cold-start) are surfaced as Plan Review Items. R13 (split `performModAction`) is dropped as gold-plating per v2's critique #5.

**Verdict: REVISE.** Sound architecture; material spec updates needed to absorb Wave C findings and formalize three honest-framing items.

---

## Validated assumptions

1. **Devvit triggers exist and are usable** for `PostSubmit`, `CommentSubmit`, `ModAction`, `PostReport`, `CommentReport`, `AppInstall`, `AppUpgrade`. Verified from production app code (research/01 caps #3–#6; research/04 § Conventions to Adopt). Survives every research wave.

2. **Account creation date is accessible and the field name is now confirmed.** `user.createdAt` is a `Date` object (not Unix-seconds `created_utc`), set on User-model construction from the protobuf `data.createdUtc`. Source: `packages/public-api/src/apis/reddit/models/User.ts` and confirming usage in `fsvreddit/modmail-userinfo/src/components/accountAge.ts` (research/06 § `account.createdAt` — Field Name and Type). This retires v1's empirical-test item E7.

3. **Mod actions Sentinel needs are programmatically available.** Slow mode, post lock, post remove/approve, user ban/unban verified from `evasion-guard`, `hive-protect`, `auto-post-lock` (research/01 caps #11, #13, #14, #15).

4. **Modmail send is callable from a Devvit app.** Verified by `automodmail`, `modmail-userinfo`, `Modmail-To-Discord/Slack` (research/01 cap #10; research/04 § Conventions to Adopt). Supports Q8's modmail-as-pager pattern.

5. **Devvit scheduler exists with documented rate limits.** Research/06 closes the rate-limit half of v1's Q6: 10 recurring jobs per installation, 60 `runJob` calls/min, 60 deliveries/min, 1-minute minimum cron granularity. Source: `reddit/devvit-docs/docs/capabilities/server/scheduler.mdx`. Sentinel's enumerated jobs (5-minute scan, daily digest, weekly cleanup, every-5-min refresh, hourly backfill if R-Bootstrap accepts it) fit under the 10-job cap.

6. **Mod Notes API is fully public and typed.** `context.reddit.addModNote(opts)` and `context.reddit.getModNotes(opts)` are documented methods in `@devvit/public-api` with full type signatures (`CreateModNoteOptions`, `GetModNotesOptions`, `UserNoteLabel`, `ModNoteType`, `ModNote`). Confirmed in production use by `fsvreddit/toolboxnotesxfer`. Source: research/06 § Mod Notes API — Method Signatures. This inverts v1's R10 deferral.

7. **Custom posts via Devvit Blocks support the dashboard structure.** Tabs, KPI tiles, signal bars, modals are standard patterns (research/04 § Custom Post Complexity; research/01 cap #9). DOM-node budget is borderline only for the cluster graph at scale; rest of the dashboard is comfortably within Lighthouse's 1,500-node threshold (research/05 Q9).

8. **Statistical primitives are computationally cheap at Sentinel's stated scale.** Welford's runs O(1) per update (~24 bytes per stat); z-scores O(1); sigmoid O(1); cosine O(8) for the stylometry vector; Jaccard O(50) on top-50 trigrams. All comfortably within a sub-100ms eval budget (research/03 per-method evaluation).

9. **Sigmoid anchoring of risk to [0, 1] is the correct shape.** Saturation at ±6σ is intentional and prevents extreme z-scores from dominating Health Score or Raid Radar's confidence numbers (research/03 Item 7). Both engine formulations survive.

10. **Bounded storage is achievable at stated scale.** Research/06 closes v1's Q4: **500 MB per installation** confirmed; **~4.2 billion key capacity**; **40,000 commands/sec**; **20 concurrent transactions** with **5-second transaction timeout**. 50 watched threads × ~10 KB + ~10K user fingerprints × ~50 KB + baselines + audit log fit comfortably under 500 MB (research/03 Item 5; research/06 § Q4 — Redis Quotas).

11. **Welford's online algorithm is the right primitive.** Numerically stable in Reddit comment-rate value ranges; ~24 bytes per stat; survives every wave. Only the "rolling 14d" framing is broken — see Broken Assumption A.

12. **The dual-signal Memory guard is mathematically defensible.** Behavioral floor (>0.65) AND stylometric floor (>0.75) AND combined (>0.78) directly addresses single-signal stylometry's known false-positive risk (research/03 implicit; spec `04-engine-memory.md` § Combined match logic; research/07 § Ban Evasion Filter confirming the architectural distinction from Reddit's content-blind native filter).

13. **The three-engine thesis is competitively defensible at the new deadline.** Research/07's review of 6 comparable past Devvit hackathon entries found zero multi-engine threat-detection systems; the closest peer (Bot Bouncer, ~126 commits) is a single-engine utility built iteratively over months. The 47-day post-postponement runway puts Sentinel above the spec's own 14–24 working-day estimate with buffer for polish and demo prep (research/07 § Sentinel Calibration).

14. **Devvit Redis supports `WATCH`/`MULTI`/`EXEC` optimistic-locking transactions.** Confirmed from `redis.mdx` and the `TxClientLike` interface in `packages/public-api/src/types/redis.ts` (research/10). All commands queued inside `multi()`/`exec()` execute as an atomic unit; if a watched key changes before `exec()`, the block aborts and must be retried. This enables atomic multi-key writes for `dispatchAlert` (persist alert + open-set add + by-target index update + audit-log append) without compensating-action patterns. Reduces complexity of R-Dispatch-Idempotent — transactions are the primary mechanism; idempotent retry (pre-transaction `hSetNX` guard) remains a useful backstop for handler-crash reruns.

---

## Broken assumptions

### A. 14-day bootstrap fetch on install

- **What the spec says:** `07-onboarding-and-install.md` Step 3 (lines 53–68) instructs the install flow to fetch the sub's last 14 days of posts and each post's top 100 comments; `02-architecture.md` § Bootstrap repeats this; `08-build-plan.md` Milestone 1 lists "Bootstrap job — scan last 14 days on install"; `00-architectural-summary.md` line 71 canonicalizes "Bootstrap window: 14 days."
- **What's actually true:** No real Devvit mod app attempts a 14-day backfill (research/08 § Part A). The three real patterns observed are (P1) bounded one-shot hot-list fetch (Spam Source Spotter, top-1000 posts), (P2) zero-fetch reactive (Hive Protect, 100-item per-user lookback on demand), (P3) forward-only scheduled accumulation (sub-stats-bot, daily job from install day). Scale math from research/04 § Bootstrap Feasibility: 14 days × 200 posts/day × 50 comments/post ≈ 140K fetches; at ~60 req/min OAuth ceiling that is ~39 hours — well past any plausible scheduler timeout (Q6 partial in research/06 leaves per-job timeout undocumented but the order of magnitude is decisive).
- **Materiality:** Blocker.
- **Recommendation:** Replace the 14-day fetch with a three-pattern hybrid: top-1000 hot at install (P1) + reactive from t=0 (P2) + progressive scheduled backfill during the existing 7-day calibration ramp (P3). The Q12 principle survives intact ("live from minute one, accuracy improves over 7 days"); only the mechanism (14-day fetch) is replaced. See Revision R-Bootstrap.

### B. Welford's algorithm on a "rolling 14-day window"

- **What the spec says:** `02-architecture.md` line 46 annotates `SubBaseline` as "Rolling window stats (last 14 days)"; the `RollingStat` class (lines 220–232) implements Welford. Settings § `baselineWindowDays` defaults to 14.
- **What's actually true:** Welford computes full-history statistics; it does not support sliding windows natively (research/03 Item 4). The ambiguity will produce divergent implementations.
- **Materiality:** Blocker (spec correctness).
- **Recommendation:** Pin full-history Welford; remove "rolling window" framing; drop the `baselineWindowDays` setting. Aging is handled by the existing 90-day user-fingerprint retention. See Revision R-Welford.

### C. Storage schema uses Set primitive that does not exist

- **What the spec says:** `02-architecture.md` § Devvit Redis schema lists `sentinel:alerts:by_target:{targetId}` as "Set of alertIds for quick lookup by thread/user/sub." `00-architectural-summary.md` storage schema table replicates this.
- **What's actually true:** Devvit Redis explicitly does not support standard Redis Sets — only sorted sets via `zAdd`/`zRange`. There is no `SADD`/`SMEMBERS`/`SISMEMBER`. There is also no key enumeration (no `KEYS *`, no `SCAN`), no pipelining, and no Lua scripts. Source: research/06 § Q4 — Redis Quotas, Additional limits.
- **Materiality:** Blocker (storage primitive does not exist).
- **Recommendation:** Re-encode `alerts:by_target:{targetId}` as either (a) a sorted set with `score = timestamp` (use `zRange` for lookup, `zAdd` for membership, allowing time-ordered iteration) or (b) a hash where field = alertId and value = "1" or summary metadata (use `hSet`/`hGet`/`hKeys`). Sorted-set encoding is preferred because it preserves time order and matches the existing `sentinel:alerts:open` encoding. Audit the rest of the schema for any other implicit Set usage. See Revision R-NoSets.

### D. 5 MB per-request write cap is unmet

- **What the spec says:** `02-architecture.md` § Devvit Redis schema lists multi-field structures (UserFingerprint with stylometry profile + last-100-comments + sub-overlap maps; ThreadState with 288-bucket time series × 3 series; banned-index `Map: userId → summary UserFingerprint`) without per-write size constraints. `00-architectural-summary.md` § Shared Infrastructure references "Atomic persistence to KV" without a payload size mention.
- **What's actually true:** Devvit Redis enforces a **5 MB maximum per request** (research/06 § Q4 — Redis Quotas; source: `redis.mdx`). The most operationally critical limit per research/06's verdict. A serialized cluster state for a 30-50-node Raid Radar visualization, a banned-index hot-cache that grew to thousands of users, or a dense audit-log entry with embedded signal snapshots can each plausibly exceed 5 MB.
- **Materiality:** Blocker (silent write rejection at scale).
- **Recommendation:** Add explicit 5 MB write-cap notes to `02-architecture.md` § Devvit Redis schema. Specify a chunking pattern for any structure that can grow unboundedly: (1) UserFingerprint — already per-key (~50 KB target), safe; (2) banned-index — re-encode as one key per banned user (`sentinel:memory:banned:{userId}`) plus a small index sorted set, rather than one large Map; (3) ThreadState — bound by 288-bucket × 3-series fixed size (~7 KB per thread, safe); (4) cluster-state cache — chunk by alert generation, serialize ≤2 MB per write; (5) audit-log entries — ensure single-entry serialization stays under 100 KB by storing signal snapshots as references, not embedded payloads. See Revision R-5MB-Chunking.

### E. Cross-sub user history for sub-overlap (Raid Radar Signal 3 AND Memory)

- **What the spec says:** `03-engine-raid-radar.md` Signal 3 (lines 51–58) computes "the most common other sub" across new arrivals and fires when `share_pct > 70%`. `04-engine-memory.md` § Behavioral Signal A relies on `subOverlap` between fingerprints (line 53). `02-architecture.md` `UserFingerprint.otherSubs: Map<string, number>` is documented with no cap.
- **What's actually true:** Cross-sub user data via `context.reddit.getCommentsAndPostsByUser({limit:100, pageSize:100, sort:"new"})` is hard-capped at 100 items per user (research/05 Critical Finding 1; research/06 § Cross-Sub User History — Cap Verified, with the exact API call from `fsvreddit/hive-protect/src/getProblematicItems.ts`). Each item carries `subredditName` and `subredditId` so the join is mechanically straightforward; the constraint is the per-user lookback ceiling.
- **Materiality:** Blocker (correctness-of-spec, not correctness-of-detection). v1 R3 noted this for Raid Radar Signal 3 only; v2 noted Memory's subOverlap is the bigger impact because Memory's behavioral profile leans more heavily on cross-sub history than Raid Radar does.
- **Recommendation:** Document the 100-item cap explicitly in both Raid Radar Signal 3 and Memory's behavioral profile. Reword Signal 3 to "Across new arrivals' last 100 cross-sub comments, what fraction share a single external sub?" Reword Memory § Behavioral Signal A to "subOverlap Jaccard is computed against each user's last 100 cross-sub comments — older activity is invisible." Add edge case: "Slow infiltration spanning more than ~100 cross-sub comments per attacker is invisible to both engines by data-source design." See Revision R-Sub-Overlap-Cap.

### F. Memory cold-start on a fresh install

- **What the spec says:** `04-engine-memory.md` § Banned-user index (lines 175–188) describes preserving fingerprints on `ModAction.banuser`. `07-onboarding-and-install.md` line 184 notes Devvit Redis is per-app-installation. The spec assumes the banned index will accumulate over normal mod operation.
- **What's actually true:** A fresh install on a sub that has never banned anyone has an **empty banned-index** — there is no fingerprint to compare against (v2 critique #6; research/06 § Cross-Sub User History reinforces the data ceiling; research/08 § Memory at <200 members confirms the operational gap). Memory's ≥10-comment gate compounds this: even if the index has entries, candidates with <10 comments cannot be evaluated. On the demo sub (Q2, <200 members, ~10 comments/day total), an individual user reaches 10 comments after ~50 days. v1 R10 addressed uninstall-reinstall but never functional cold-start on a brand-new install.
- **Materiality:** Risky (Memory engine appears non-functional at install on subs with no ban history, even though the engine is implemented; mod expectations will diverge from observed behavior).
- **Recommendation:** Add explicit cold-start framing to `04-engine-memory.md` (a "Cold-start behavior" subsection: "Memory becomes useful as your sub accumulates bans. Until the banned-index has at least one entry, Memory's User Spotlight surface reports `No ban history yet — Memory will start matching once mods take ban actions.`") and to `07-onboarding-and-install.md` welcome modal (a single sentence: "Memory improves as your ban history grows; it activates the first time you ban a user."). Optionally, surface the Mod Notes API path (Revision R-ModNotes-Now) as a v1 enhancement: if the sub already has mod-note-tagged ban history from prior tools (Toolbox, native Reddit), Sentinel can pre-seed the banned-index from `getModNotes(filter: 'BAN')` at install. See Revision R-Memory-Cold-Start.

### G. Small-sub demo statistical realism

- **What the spec says:** `09-demo-video-script.md` mandates a private test sub (Q2 requires <200 members per hackathon rules) and pre-staged alts for the brigade scenario. Pre-staging is treated as a recording-convenience tip, not a statistical requirement. `00-architectural-summary.md` line 28 cites "89% confidence, 38 accounts from r/external in 90s detected" as the demo opener.
- **What's actually true:** On a <200-member private sub, Raid Radar's Signal 1 (influx z-score >4σ) degrades to an absolute-count trigger via the `stddev || 1` fallback (research/03 confirms the fallback; research/08 § Baseline math quantifies: ~5 new commenters in 5 minutes fires it from cold). Memory's ≥10-comment gate is functionally inoperative on a fresh small sub (~50-day natural accumulation per user). Health Score's velocity baseline is undefined on threads with <10 comments. The demo signals fire correctly because alts are pre-staged, but the statistical claim ("detected at 4σ above baseline") is not what the engines actually do on the test environment. v1 was silent on this; v2 critique #4 flagged it; research/08 § Part B quantifies it.
- **Materiality:** Risky (honest-framing gap, not detection failure).
- **Recommendation:** Add a "Statistical realism note" to `09-demo-video-script.md` explaining that the test sub triggers signals via cold-baseline behavior (absolute-count under `||1`) and that Memory + Health Score are pre-seeded for the demo. Adopt one of research/08's three framing options for the video description and Devpost narrative ("calibrated test sub with pre-staged scenarios" recommended). Elevate the pre-seeding checklist (banned-index population, ThreadState velocity injection, SubBaseline warm values) from a recording tip to a formal demo-prep step. See Revision R-Demo-Honest-Framing.

### H. AFINN-style sentiment lexicon

- **What the spec says:** `05-engine-health-score.md` Signal 2 references "AFINN-style word lists" without specifying variant; `00-architectural-summary.md` Open Question 2 already flags variant ambiguity.
- **What's actually true:** AFINN exists in multiple variants (AFINN-111, AFINN-2015) and is English-only; standard AFINN omits emoji and has no built-in negation/intensifier handling (research/03 Item 2).
- **Materiality:** Risky (silent accuracy loss on non-English and emoji-heavy subs; sentiment is 25% of Health Score weight).
- **Recommendation:** Pin AFINN-2015-en; add a small emoji-→-score extension table (~30 entries); document neutral fallback (return 0) for tokens not in the combined lexicon; document explicitly that non-English subs receive degraded sentiment accuracy. See Revision R-AFINN.

### I. "Atomic" alert persistence across multiple keys

- **What the spec says:** `00-architectural-summary.md` line 32 describes alert dispatch as "Atomic persistence to KV." `02-architecture.md` § Alert dispatcher enumerates five steps that span 4–5 keys.
- **What's actually true:** Devvit Redis is single-key atomic. Sentinel's dispatchAlert spans `sentinel:alert:{alertId}`, `sentinel:alerts:open`, `sentinel:alerts:by_target:{targetId}`, `sentinel:audit_log`, plus the dashboard refresh marker — 5 writes (research/04 § Spec Patterns That May Conflict; research/06 § Q4 confirms single-key atomicity with no Lua and no pipelining as backstops).
- **Materiality:** Risky.
- **Recommendation:** Replace "atomic" framing with idempotent retry semantics — each step keyed by alertId, replayable on crash recovery via a startup scan of `sentinel:alerts:open` for entries lacking audit/dashboard markers. See Revision R-Dispatch-Idempotent.

### J. 5-second debounce on engine re-evaluation

- **What the spec says:** `02-architecture.md` line 208 specifies "debounce engine evaluations to once per 5 seconds per thread."
- **What's actually true:** Devvit triggers do not provide built-in debounce; application-level KV CAS (compare-and-set) is the only reliable pattern (research/04 § Spec Patterns That May Conflict).
- **Materiality:** Risky.
- **Recommendation:** Document the CAS pattern explicitly: `getAsync('sentinel:thread:{postId}:lastEval')` → if `now - last < 5000`, skip; else `setAsync(now)` and proceed. Annotate as "approximate debounce." See Revision R-Debounce-CAS.

### K. Stylometry: missing L2 normalization, unbounded vocabulary, no trigram preprocessing

- **What the spec says:** `04-engine-memory.md` § Stylometry Signal B (lines 96–116) constructs a numeric vector and computes cosine similarity without specifying L2 normalization. Top-50 trigrams from raw text with no preprocessing spec. Vocabulary as `Set<string>` with no cap or aging.
- **What's actually true:** Un-normalized cosine biases toward magnitude-dominant features (research/03 Item 3); per-user vocabulary grows unbounded — a high-volume user can accumulate 10K+ tokens (research/03 § Vocabulary Set unbounded growth); exact-string trigram membership is sensitive to case and whitespace (research/03 Item 6).
- **Materiality:** Risky.
- **Recommendation:** Specify L2 normalization on the stylometry vector; cap vocabulary to top-N most-frequent (recommend N=2000) with FIFO aging; require trigram preprocessing to case-fold and collapse whitespace before extraction. See Revision R-Stylometry-Norm.

### L. Histogram bucket counts and overlap formula undefined

- **What the spec says:** `02-architecture.md` defines `Histogram` (lines 252–261) without bucket count or overlap formula. `04-engine-memory.md` references `histogramOverlap()` without defining it.
- **What's actually true:** Multiple overlap formulas exist with different sensitivities; bucket counts dramatically affect comparability (research/03 Item 8).
- **Materiality:** Risky (engine implementations will diverge).
- **Recommendation:** Pin bucket schemas (posting-time: 24, account-age: 10, comment-length: 5) and overlap formula (histogram intersection). See Revision R-Histogram-Pin.

### M. Cluster graph rendering on Devvit Blocks

- **What the spec says:** `03-engine-raid-radar.md` § Dashboard panel describes "A simplified node graph (rendered as SVG via Devvit Blocks)."
- **What's actually true:** 30–50 nodes + edges in SVG = 200+ DOM elements per cluster; Devvit Blocks are noted as "very much limited"; cumulative dashboard DOM approaches Lighthouse's 1,500-node concern at scale (research/04 § Custom Post Complexity; research/05 Q9). Note: research/06 closes the rest of the Blocks-rendering question only weakly — there is no Devvit-specific DOM cap, only the web standard.
- **Materiality:** Risky.
- **Recommendation:** Lazy-load cluster graph; cap to ≤20 nodes with "+N more" badge; fixed-height container. See Revision R-Cluster-Graph.

---

## Competitive risks

### Risk 1 — Reddit's native filter stack (Ban Evasion Filter + Harassment Filter + Mod Insights)

**What they cover.** Reddit's Ban Evasion Filter auto-flags suspected returning bans using device/IP fingerprinting and connection signals; opt-in per-sub with Moderate/High confidence levels (research/07 § Ban Evasion Filter). Harassment Filter is an LLM trained on moderator actions; tags potential harassment in the mod queue; opt-in per-sub with Low/High sensitivity and a 15-keyword allow list (research/07 § Harassment Filter). Mod Insights is a per-sub analytics dashboard with growth/team-health/reports metrics on 24h/7d/30d/365d windows (research/07 § Mod Insights).

**Where Sentinel differentiates.** Reddit's Ban Evasion Filter help documentation explicitly states it **"doesn't filter based on post or comment context (i.e. this tool doesn't use behavioral or contextual patterns)"** (research/07 § Ban Evasion Filter, verbatim from Reddit help). This is a self-documented architectural boundary, not a marketing positioning — Memory's stylometry + behavioral dual-signal occupies precisely this gap. Harassment Filter is comment-level and post-hoc; it cannot detect a coordinated brigade where individual comments are below the harassment threshold (research/07 § Harassment Filter). Mod Insights is retrospective and aggregate with a 24-hour minimum window; it cannot show that a thread's velocity just crossed 4σ above baseline (research/07 § Mod Insights).

**Note on prior unsourced stat.** The "72% adoption in largest subreddits" figure attributed to the Harassment Filter in v1 § Risk 1 (and originally in research/02) has **no verifiable public source** (research/07 § Adoption Reality). The filter was discovered through APK teardown rather than a formal rollout announcement and no adoption metrics were published. This stat must be dropped from Sentinel's competitive claims in any pitch, demo, or app listing.

**Recommendation:** Differentiate. Lead with the verbatim Ban Evasion Filter quote in `10-app-listing.md` and in any pitch documents. The strongest defensible claim is that Reddit's native filter and Sentinel's Memory are *complementary, not competitive* — Memory catches the VPN-bypassing ban evader who changed devices but not their writing style, which Reddit's filter architecturally cannot.

### Risk 2 — Hive Protect

**What it covers.** Monitors a user's participation in external subs (free-karma, NSFW, OnlyFans) and triggers ban/remove/report. Operates on a 100-item per-user lookback with 24-hour cache (research/02; research/06 § Cross-Sub User History — Cap Verified).

**Where Sentinel differentiates.** Memory's dual-signal match (behavior × stylometry) and the side-by-side fingerprint comparison ("smoking-gun" view per `04-engine-memory.md` § Side-by-side view) are not present in Hive. Sentinel is also a unified platform — three engines on one graph, one pinned dashboard, one audit log — whereas Hive is a single-purpose tool.

**Recommendation:** Differentiate. Memory's stylometry is a strict superset of Hive's sub-participation check for ban-evader detection.

### Risk 3 — Evasion Guard

**What it covers.** Bans/removes posts from users flagged by Reddit's native ban-evasion signal. Passive relay; no independent detection (research/02).

**Where Sentinel differentiates.** Q9 forbids auto-ban; Sentinel surfaces dual-signal evidence + 24-hour revert + confidence ranges. Evasion Guard is fire-and-forget; Sentinel is suggest-and-explain. This is the exact failure mode Q9 was designed against.

**Recommendation:** Differentiate. Reversibility (24-hour revert per Q11) is the credibility moat.

### Differentiation thesis (single paragraph for demo / app listing)

Sentinel's moat is the shared behavioral graph: three engines reading the same fingerprint, the same baseline, the same audit log. Hive Protect, Evasion Guard, Spam Source Spotter, and Sub-Stats-Bot solve narrow slices (research/02 + research/07); Reddit's native filters operate opaquely at platform scale and, per Reddit's own documentation, "the ban evasion filter doesn't filter based on post or comment context" (research/07). Sentinel uniquely offers (a) 90-second statistical brigade detection with mod-visible signal breakdowns, (b) dual-signal ban-evader scoring (behavior × stylometry) with a side-by-side evidence view, and (c) 1–2 hour thread-escalation forecasts with mitigation projections. The demo lands on one screenshot: cluster graph + Memory side-by-side + Health Score gauge in a single pinned post. No competing tool can produce that screenshot.

### Demo positioning guidance

- **Open with brigade detection, not Memory** (Q3 mandates this; research/02 confirms Reddit's native ban-evasion is the most-discussed Memory analog).
- **Surface the 24h revert button in the demo's middle act.** Research/02 frames reversibility as the credibility moat.
- **Health Score's forecast diff is the third-act payoff** — no competing tool offers forward-looking mitigation projections (research/02 + research/07).
- **Avoid framing Sentinel as a Harassment Filter competitor** — Harassment Filter is content-level, post-hoc, comment-by-comment; Sentinel is behavior-level, predictive, thread-by-thread. The categories don't compete.
- **Use the "calibrated test sub" framing** in the YouTube description and Devpost narrative (research/08 § Honest framing options).

---

## Devvit-specific issues

### Blockers (must change before Milestone 1 begins)

- **14-day bootstrap is infeasible** on install under Reddit OAuth ~60 req/min + Devvit scheduler timeout (research/04 § Bootstrap Feasibility; research/05 Q3 confirmed by research/08 § Part A's three-pattern evidence). Captured in Broken Assumption A; remediation R-Bootstrap.
- **5 MB per-request write cap** (research/06 § Q4 — Redis Quotas, Source: redis.mdx). Wave D research (research/11) narrowed this to one write: `sentinel:memory:banned_index` only; all other writes safe as specified. Captured in Broken Assumption D; remediation R-5MB-Chunking. *Materiality: risky (downgraded from blocker by Wave D research).*
- **No standard Sets primitive** (research/06 § Q4 — Additional limits). Wave D research (research/10) resolved this to a pick from canonical patterns (sorted-set-as-set or hash-as-set); no redesign needed. Captured in Broken Assumption C; remediation R-NoSets. *Materiality: cosmetic (downgraded from blocker by Wave D research).*

### Rate-limit risks

- **Reddit OAuth ~60 req/min** throttles bootstrap and Memory's periodic banned-index scans (research/04 § Rate Limits and Quotas). The three-pattern hybrid (R-Bootstrap) keeps install-time call volume under ~50 requests; the existing 6-hour Memory scan cadence stays well within budget for an index of ≤500 banned users (~5000 calls / 60 per min = 83 minutes, chunkable across multiple scheduler runs).
- **Cross-sub user history capped at 100 items** (research/06 § Cross-Sub User History — Cap Verified). Affects Raid Radar Signal 3 and Memory subOverlap; remediation R-Sub-Overlap-Cap.
- **40,000 Redis cmds/sec combined** (research/06 § Q7). Sentinel's debounced write pattern (~10 writes/sec peak during a 50-thread coordinated raid) is well under 1% of the quota. Throttling behavior on overrun is still undocumented; carried as empirical-test item E-RedisThrottle.
- **Scheduler: 10 recurring jobs cap, 60 runJob/min creation, 60 deliveries/min** (research/06 § Q6). Sentinel's ~5 enumerated recurring jobs fit comfortably. The 60 runJob/min ceiling bounds the R-Bootstrap progressive backfill rate; the daily backfill batch should not schedule >50 child jobs per minute.
- **Sorted-set BYSCORE/BYLEX LIMIT caps at 1,000 results per call** (research/06 § Q4 — Additional limits). Affects `sentinel:alerts:open` paging when the open-alerts set exceeds 1,000 — needs cursor logic. At Sentinel's expected open-alert volume (~1–5 critical/day, ~10–50 total open at any time), this is far below the cap, but the pagination pattern must be documented for any future fan-out.
- **Modmail send rate undocumented** (still-unknown in research/06). Sentinel's expected critical-alert volume (~1–5/day per spec) is far below any plausible cap; carried as empirical-test item E-Modmail.

### Convention conflicts

- **Multi-key "atomic" persistence** — Devvit Redis is single-key atomic; no pipelining, no Lua. Remediation R-Dispatch-Idempotent.
- **5-second debounce** requires KV CAS implementation (research/04 § Spec Patterns That May Conflict). Remediation R-Debounce-CAS.
- **Cluster graph DOM budget** borderline on mobile (research/04 § Custom Post Complexity). Remediation R-Cluster-Graph.
- **onInstall must not block on data backfill** (research/04 § Install Hook). The three-pattern bootstrap (R-Bootstrap) honors this constraint where the 14-day fetch did not.
- **Storage schema Set primitive does not exist** (research/06). Remediation R-NoSets (also a blocker).
- **5 MB write cap** (research/06). Remediation R-5MB-Chunking (also a blocker).

---

## Plan Review Items (challenges to `01-product-decisions.md`)

These items challenge mechanism, not principle. Surfacing only — lead decides whether to amend in Phase 2.

### PRI-1 — Q12 Onboarding mechanism

- **Decision being challenged:** Q12's "Behavior on install" step 2: "Background: fetch last 14 days of activity, compute initial baselines."
- **Why research challenges it:** No real Devvit mod app attempts a 14-day backfill (research/08 § Part A); the closest pattern (Spam Source Spotter) caps at top-1000 hot posts. The 14-day fetch is computationally infeasible under Reddit OAuth rate limits (research/04 § Bootstrap Feasibility). The Q12 principle ("working from minute one, accuracy improves over 7 days") survives intact; only the mechanism (14-day fetch) fails.
- **Alternative the lead might consider:** Three-pattern hybrid: (a) bounded top-1000 hot-list fetch at install (<2 minutes, no timeout risk), (b) reactive accumulation on all incoming events from t=0, (c) progressive scheduled backfill of the 3–14d gap during the existing 7-day calibration ramp.
- **Severity:** Blocker for the decision's mechanism; cosmetic for the decision's principle.
- **Cascading changes if amended:** (1) `07-onboarding-and-install.md` Step 3 + welcome modal copy; (2) `02-architecture.md` `bootstrapBaseline()` signature; (3) `08-build-plan.md` Milestone 1 deliverable wording; (4) `00-architectural-summary.md` "Bootstrap window: 14 days" critical-threshold row.
- **Action:** Surfacing. Lead decides.

### PRI-2 — Q2/Q13 Demo realism and honest framing

- **Decisions being challenged:** Q2 (private test sub <200 members) is a hackathon requirement and not negotiable; Q13 (60-second scripted demo with Raid Radar leading) is the structure. The mechanism gap is that Sentinel's z-score engines are statistically inoperative at this scale without pre-staging.
- **Why research challenges it:** Research/08 § Part B quantifies the gap. On a <200-member sub: Raid Radar Signal 1 degrades to absolute-count via `stddev || 1`; Memory's ≥10-comment gate requires ~50 days to accumulate per user organically; Health Score velocity baseline is undefined on <10-comment threads. The demo signals fire only because alts are pre-staged. v1 was silent on this; v2 critique #4 flagged it; research/08 cements it.
- **Alternative the lead might consider:** (a) Add a "Statistical realism note" subsection to `09-demo-video-script.md` documenting the scale mismatch + pre-staging requirements; (b) elevate the existing pre-seeding tip ("The Memory match should already be detected and persisted before you start filming," 09 line 143) to a formal pre-demo checklist; (c) adopt research/08's "Option 1: Calibrated test sub" framing in the YouTube description and Devpost narrative — "Demo recorded on a private test subreddit with pre-staged test scenarios to demonstrate the full detection and response workflow. In production, Sentinel learns each sub's baseline over 3–7 days and detects organic brigades without pre-staging."
- **Severity:** Risky (honest-framing gap, not detection failure). Becomes a credibility risk only if a sophisticated judge probes the cold-start behavior.
- **Cascading changes if amended:** (1) `09-demo-video-script.md` new subsection + checklist; (2) optional addition to `10-app-listing.md` if the listing references demo footage; (3) the calibrated-test-sub framing is added to the YouTube description and Devpost notes, not to a spec file.
- **Action:** Surfacing. Lead decides.

### PRI-3 — Q1 Scope governance (proactive, not forced)

- **Decision being challenged:** Q1's "Build all three engines fully integrated." Not the principle — the build sequence's polish margin under the new deadline.
- **Why research challenges it (softly):** Research/07 § Sentinel Calibration estimates the 3-engine spec at 14–24 working days and notes that the closest peer (Bot Bouncer, ~126 commits) is a single-engine utility built iteratively over months. Under the original 16-day deadline this was a forced cut question; under the 47-day deadline it is a governance question. The lead may proactively cut scope to leverage time for polish/quality, but research does not force this.
- **Alternative the lead might consider:** (a) Default — build all three engines per spec; the new deadline gives ~10–14 working days of buffer over the spec's 24-day high estimate. (b) Optional — cut Memory to v1.1 and ship Raid Radar + Health Score + Memory dashboard stub at hackathon submission, then ship Memory as a post-hackathon update. (c) Optional alternate — cut Health Score's forecast model only (keep risk score + triage), reclaim 1–2 days for visual polish and demo iteration.
- **Severity:** Cosmetic (governance lever, not blocking).
- **Cascading changes if amended:** Depends on which cut is chosen. None if (a). If (b): `08-build-plan.md` Milestone 6 deferred to post-hackathon; `09-demo-video-script.md` Memory shot becomes a UI stub with "coming soon" badge. If (c): `05-engine-health-score.md` § Forecast generation cut; `09-demo-video-script.md` third-act payoff simplifies.
- **Action:** Surfacing. v2 raised this as a forced cut under the original deadline; v3 reframes it as proactive governance. Lead decides whether to act on it.

### PRI-4 — Q10 Memory cold-start framing

- **Decision being challenged:** Q10's "Sliding window per user. Devvit Redis. Bounded retention." Not the storage strategy — the implicit assumption that Memory becomes useful immediately after install.
- **Why research challenges it:** A fresh install on a sub with no prior bans has an empty banned-index. Memory's evaluation gate requires ≥10 comments per candidate. Together, these mean Memory may report "no matches" for days or weeks of normal operation, which diverges from the "94% style match" demo screenshot a mod sees in the listing (research/06 § Cross-Sub; research/08 § Memory at <200 members; v2 critique #6).
- **Alternative the lead might consider:** Add a single "Cold-start behavior" subsection to `04-engine-memory.md` (User-Spotlight surface shows "No ban history yet — Memory will start matching once mods take ban actions") and a single sentence to the welcome modal copy ("Memory improves as your ban history grows; it activates the first time you ban a user"). Optionally, surface a one-click "Import existing mod notes" action that uses `getModNotes(filter: 'BAN')` to pre-seed the banned-index from any prior Toolbox or native Reddit ban history (research/06 § Mod Notes API — Method Signatures).
- **Severity:** Risky (honest-expectations gap).
- **Cascading changes if amended:** (1) `04-engine-memory.md` new subsection; (2) `07-onboarding-and-install.md` welcome modal copy adjustment; (3) optionally `04-engine-memory.md` § Banned-user index extended to support ModNote pre-seeding.
- **Action:** Surfacing. Lead decides.

(No other Q-decisions are challenged by research. Q3–Q9, Q11, Q14, Q15 and the cross-cutting principles survive the evidence base.)

---

## Recommended plan revisions

Ordered by materiality (blockers → risky → cosmetic). Each revision uses the structured block format.

### File: sentinel-spec/07-onboarding-and-install.md, sentinel-spec/02-architecture.md, sentinel-spec/08-build-plan.md, sentinel-spec/00-architectural-summary.md
**Section:** `07-onboarding-and-install.md` Step 3 — Background bootstrap (lines 53–68); Step 4 modmail copy (lines 73–101); `02-architecture.md` § Bootstrap (lines 264–272); `08-build-plan.md` Milestone 1 (line 24); `00-architectural-summary.md` Bootstrap window row (line 71)
**Current:** Bootstrap fetches the sub's last 14 days of posts (paginated, max 1000 posts) and each post's top 100 comments; welcome modal claims "scanning your sub's last 14 days of activity to learn what 'normal' looks like. This takes about 2 minutes and runs in the background."
**Proposed:** Replace with a three-pattern hybrid: (P1) on install, fetch top-1000 hot posts and index them into `SubBaseline` + initial `UserFingerprint` records (citation: `fsvreddit/spam-src-spotter`); (P2) from t=0, all engines run reactively on every incoming event (citation: `fsvreddit/hive-protect` 100-item lookback model); (P3) during the 7-day calibration ramp, a scheduled hourly job progressively fills the 3–14 day gap in rate-limit-safe batches (≤50 API calls per child job, scheduled within the 60 runJob/min ceiling, citation: `fsvreddit/sub-stats-bot` daily-accumulation pattern). Welcome modal copy: "Scanning your sub's recent activity to seed your baseline. Detection is active immediately; accuracy improves over the next 7 days." Modmail step-4 copy: "Sentinel is now active. Detection runs immediately; accuracy improves over the next 7 days as your baseline warms up." Update `00-architectural-summary.md` "Bootstrap window: 14 days" row to "Bootstrap: 1000 hot posts at install + reactive + progressive (7d ramp)."
**Reason:** 14-day fetch infeasible at ~140K API calls vs ~60 req/min OAuth ceiling (research/04 § Bootstrap Feasibility). No real Devvit mod app attempts a 14-day backfill (research/08 § Part A). Three-pattern hybrid is the union of three real-world patterns and stays under 50 install-time API calls.
**Materiality:** blocker
**Implementation cost:** small (replaces one existing function + copy edits)

### File: sentinel-spec/02-architecture.md, sentinel-spec/00-architectural-summary.md
**Section:** `02-architecture.md` § Devvit Redis schema (full table); § Statistical primitives § RollingStat (lines 216–232); `00-architectural-summary.md` § Storage Schema table; § Critical Thresholds table
**Current:** `SubBaseline` annotated "Rolling window stats (last 14 days)"; `RollingStat` implements Welford; `baselineWindowDays` defaults to 14.
**Proposed:** Pin algorithm per signal, per research/09's per-algorithm evaluation and recommendation table:

- **Volatile signals — use Welford-with-decay (capped count):** comments/h z-score (Raid Radar Signal 1), velocity/min z-score (Health Score), report-rate z-score (Health Score), sentiment swing (Health Score). Standard Welford update with `if (n > M_max) n = M_max` — warm-up phase is identical to full-history Welford (accurate from first sample, critical for the 7-day calibration ramp); saturated phase is equivalent to EWMA with `α = 1/M_max`. M_max encodes the target window explicitly: `M_MAX_HOURLY = 336` (14d × 24h) for hourly signals; `M_MAX_5MIN = 4032` (14d × 24h × 12) for 5-min signals. Implementation cost: one extra line — `if (this.n > M_MAX) this.n = M_MAX;` — in the standard Welford update.
- **Slow-changing signals — use Full-history Welford:** account-age distribution, new-account ratio. Long-term stability is a feature for these signals; unbounded accumulation produces the correct baseline.
- **Sliding-window Welford rejected:** O(N) recompute per update exceeds the ≤20 ms per-comment budget at sub-minute update rates — 0.5–200 ms at N=336–20,160 (research/09 § Tradeoff matrix).
- **EWMA rejected:** warm-up variance is underestimated for the first 7–14 days; EWMA baseline is immature at Sentinel's 7-day calibration ramp launch (research/09 § Algorithm 3 — EWMA: "full convergence takes ~333 hourly updates = 14 days").

Remove `baselineWindowDays` from advanced settings (no semantic meaning under Welford-with-decay; M_max is a signal-level constant). Reannotate `SubBaseline` as "Online stats, seeded by top-1000 hot-post bootstrap, accumulated continuously." Aging is handled by the existing 90-day user-fingerprint retention; sub baselines do not age out.

**Reason:** Welford does not natively support sliding windows; the "rolling 14d" framing is ambiguous and produces divergent implementations (research/03 Item 4). Research/09 evaluates five candidate algorithms and confirms Welford-with-decay as the correct default for volatile signals: O(1), accurate warm-up, EWMA-equivalent at saturation, no scheduler dependency.
**Materiality:** blocker
**Implementation cost:** trivial (text + remove one settings field; one extra line in RollingStat.update)

### File: sentinel-spec/02-architecture.md, sentinel-spec/00-architectural-summary.md
**Section:** `02-architecture.md` § Devvit Redis schema (`sentinel:alerts:by_target:{targetId}` row); `00-architectural-summary.md` § Storage Schema (`sentinel:alerts:by_target:{targetId}` row)
**Current:** `sentinel:alerts:by_target:{targetId}` is documented as "Set of alertIds for quick lookup by thread/user/sub."
**Proposed:** Assign concrete encoding per use case, per research/10 § Part A — Set-membership emulation:

- **`sentinel:alerts:open`** → **sorted-set-as-set** (`zAdd(key, {member: alertId, score: createdAtMs})`). Built-in time ordering; O(log N) add/remove; `zRange` for full listing or time-window queries via `zRangeByScore`. Best fit: time-ordered alert enumeration where the existing spec already uses sorted set (research/10 § Pattern 1).
- **`sentinel:alerts:by_target:{targetId}`** → **hash-as-set** (`hSet(key, {[alertId]: '1'})`; `hGet`/`hDel` for O(1) membership; `hGetAll` for listing). O(1) unordered lookup; ~50–60 bytes per member. Best fit: unordered alertId lookup index (research/10 § Pattern 2).
- **`sentinel:memory:banned_index`** → already a hash (userId → fingerprint string); no change needed.
- **String-of-CSV explicitly rejected:** every add/remove requires a full read-modify-write under WATCH; amplifies retry contention and O(N) string parsing on every operation (research/10 § Pattern 3: "Not recommended for Sentinel").

Document in schema preamble: "Devvit Redis does not support standard Redis Sets (`SADD`/`SMEMBERS`/`SISMEMBER`), key enumeration (`KEYS`/`SCAN`), pipelining, or Lua scripts. Set-like structures use sorted-set-as-set (score = timestamp, when ordering matters) or hash-as-set (value = '1', when unordered O(1) lookup suffices)."

**Reason:** Devvit Redis explicitly excludes standard Sets (research/06 § Q4). Research/10 provides canonical patterns for each Sentinel use case; resolution is a pick from established patterns, not a redesign.
**Materiality:** cosmetic (downgraded from blocker — canonical patterns are well-defined; no architectural redesign needed)
**Implementation cost:** trivial (schema text + two primitive replacements)

### File: sentinel-spec/02-architecture.md, sentinel-spec/04-engine-memory.md, sentinel-spec/00-architectural-summary.md
**Section:** `02-architecture.md` § Devvit Redis schema (UserFingerprint, ThreadState, AuditLog rows); `04-engine-memory.md` § Banned-user index (lines 175–188); `00-architectural-summary.md` § Storage Schema
**Current:** Schema rows describe per-key payloads without size constraints; banned-index implied as a single Map; cluster-state caching not separately keyed.
**Proposed:** Per research/11 § Recommendation per Sentinel Oversize-Risk Write, only one write is a genuine oversize threat:

- **Restructure `sentinel:memory:banned_index`** (the sole oversize-risk write): Replace the monolithic blob with per-user keys (`sentinel:memory:banned:{userId}`, ~400–750 bytes each, never near 5 MB) plus `sentinel:memory:banned_ids` sorted set (score = bannedAt timestamp, member = userId) as an enumeration index. Write a new ban via two operations inside a WATCH/MULTI/EXEC transaction: `set(banned:{userId}, summary)` + `zAdd(banned_ids, {score: bannedAt, member: userId})`. Without restructuring, the monolithic blob breaks at ~7,000–15,000 bans; with per-user keys the structure scales indefinitely within 500 MB total budget.
- **No change needed for other writes:** Raid Radar cluster state (~15–150 KB, already per-cluster keyed), audit log entries (~400 bytes/entry × 1,000 entries ≈ 400 KB, already per-entry writes), per-user fingerprint (`sentinel:user:{userId}`, ~25–40 KB, already per-entity keyed), per-thread state (`sentinel:thread:{postId}`, ~30–40 KB, already per-entity keyed). All top out at 30–150 KB per key — well under the 5 MB cap (research/11 § Recommendation table).
- **Compression (`CompressionStream` / pako) as secondary fallback only** — Devvit runtime availability for `CompressionStream` is not confirmed; do not use as primary defense (research/11 § Approach 1 — Compression: "Runtime availability needs verification").
- **Multi-key splitting and versioning: not recommended** for any Sentinel write; avoidance eliminates the root cause cleanly without adding manifest complexity (research/11 § Approaches 2 and 3).

Add a schema note: "Devvit Redis enforces a 5 MB maximum per request. All schema keys are bounded per entity; no single write exceeds 1 MB by design. The `banned_index` restructuring (per-user keys + sorted-set enumeration) is the sole structural change required to meet this constraint."

**Reason:** Devvit Redis 5 MB per-request cap is the most operationally critical limit (research/06 § Q4 — Redis Quotas). Research/11 evaluates all five Sentinel oversize-risk writes and confirms only `sentinel:memory:banned_index` is a genuine threat — making this a focused single-key fix, not a general chunking problem.
**Materiality:** risky (downgraded from blocker — only one key requires structural change; concrete fix is straightforward)
**Implementation cost:** small (restructure banned-index from Map to per-user keys; enumeration index via sorted set)

### File: sentinel-spec/03-engine-raid-radar.md, sentinel-spec/04-engine-memory.md
**Section:** `03-engine-raid-radar.md` Signal 3 — Sub-overlap concentration (lines 51–58); Edge cases (lines 222–229); `04-engine-memory.md` § Behavioral Signal A (line 53); § Behavioral profile (UserFingerprint.otherSubs)
**Current:** "Do the new arrivals share another sub in common? Fires when share_pct > 70% AND top_shared_sub != currentSub" with no documented data-availability constraint. Memory's behavioral subOverlap also assumed unbounded.
**Proposed:** Document explicitly that cross-sub history is computed via `context.reddit.getCommentsAndPostsByUser({limit: 100, pageSize: 100, sort: "new"})`, hard-capped at 100 items per user (citation: research/06 § Cross-Sub User History — Cap Verified, exact API from `fsvreddit/hive-protect`). Reword Raid Radar Signal 3: "Across new arrivals' last 100 cross-sub comments, what fraction share a single external sub? Fires when share_pct > 70%." Reword Memory § Behavioral Signal A: "subOverlap Jaccard is computed against each compared user's last 100 cross-sub comments — older activity is invisible by Devvit data-source design." Add an edge-case note in both engines: "Slow infiltration spanning more than ~100 cross-sub comments per attacker is invisible to this signal; Memory's stylometry layer is the secondary catch."
**Reason:** Cross-sub user history is hard-capped at 100 items (research/05 Critical Finding 1; research/06 § Cross-Sub User History). Silent omission produces incorrect implementer assumptions. v1 R3 covered Raid Radar only; v2 noted Memory's subOverlap is the bigger impact because Memory's behavioral profile leans more heavily on cross-sub history.
**Materiality:** blocker (correctness-of-spec)
**Implementation cost:** trivial

### File: sentinel-spec/04-engine-memory.md, sentinel-spec/02-architecture.md
**Section:** `04-engine-memory.md` § Banned-user index (lines 175–188); `02-architecture.md` § Triggers used
**Current:** Banned-user index is described as Redis-only, populated from `ModAction.banuser` events. Mod Notes API is not referenced (v1 R10 deferred it to v2 because the API was deemed undocumented).
**Proposed:** Add a subsection "Optional Mod Notes integration (v1)": "On `ModAction.banuser`, in addition to writing the fingerprint to the Redis banned-index, optionally call `context.reddit.addModNote({subreddit, user, note: 'Sentinel ban: signal breakdown ...', label: 'BAN', redditId})` to persist a summary note. On install (or at first-run), call `context.reddit.getModNotes({subredditName, username: '*', filter: 'BAN'})` to optionally seed the banned-index from prior Toolbox or native Reddit ban history — this is the cold-start mitigation for sub installations with existing ban history." Mark this as opt-in via a settings toggle ("Sync banned-index to Mod Notes: yes/no, default yes"). Document the API references from research/06 § Mod Notes API.
**Reason:** Mod Notes API is fully public and typed in `@devvit/public-api`; verified in production use by `fsvreddit/toolboxnotesxfer` (research/06 § Mod Notes API — Method Signatures). v1 R10 deferred this to v2 based on an out-of-date risk assessment. Moving to v1 unlocks cross-install Memory persistence and a one-click cold-start mitigation (PRI-4).
**Materiality:** risky (reverses v1 R10; meaningful Memory capability uplift)
**Implementation cost:** small (one new opt-in flow + settings toggle)

### File: sentinel-spec/09-demo-video-script.md (and indirectly 10-app-listing.md, Devpost narrative)
**Section:** `09-demo-video-script.md` § entire script (no current subsection on statistical realism); pre-recording notes
**Current:** Demo script mandates pre-staged alts and pre-persisted Memory matches as recording tips (line 143, line 150). No discussion of the statistical reason for pre-staging.
**Proposed:** Add a new top-level section "Statistical realism note": "Sentinel's z-score engines (Raid Radar Signal 1, Health Score velocity) are calibrated for production subs at Q15 scale (10K–500K members). On the demo test sub (<200 members per Q2), baselines remain at the `stddev || 1` fallback for weeks of normal accumulation — Signal 1 effectively becomes an absolute-count trigger (~5 new accounts in 5 minutes). Memory's ≥10-comment evaluation gate cannot be reached organically (~50-day natural accumulation per user). Health Score thread-velocity baselines are undefined on threads with <10 comments. The demo therefore uses pre-staged alts (Raid Radar), pre-seeded fingerprints (Memory), and synthesized state (Health Score timelapse) — see Pre-demo checklist below. This is normal hackathon practice and is documented for transparency." Add a "Pre-demo checklist" subsection elevating the existing tips: (1) Pre-stage 8 alt accounts in a separate browser tab. (2) Pre-populate Memory's banned-index with the suspect's old-account fingerprint. (3) Pre-inject ThreadState with a rising velocity trajectory for the Health Score thread. (4) Configure the test sub to "High Sensitivity" so signals fire at demo scale. Add a "Public framing" subsection for the YouTube description and Devpost narrative: "Demo recorded on a private test subreddit with pre-staged test scenarios to demonstrate the full detection and response workflow. In production, Sentinel learns each sub's baseline over 3–7 days and detects organic brigades without pre-staging" (research/08 § Option 1: Calibrated test sub).
**Reason:** Small-sub demo statistical mismatch is real and quantified (research/08 § Part B). Pre-staging is required, not optional. Honest framing in the video description sets correct judge expectations and signals product maturity (research/08 § Honest framing options).
**Materiality:** risky (credibility risk if a judge probes; honest framing closes it)
**Implementation cost:** trivial (text only; no code change)

### File: sentinel-spec/10-app-listing.md
**Section:** Any pitch text or competitive-positioning copy currently citing Harassment Filter adoption stats
**Current:** v1 § Risk 1 (and the original research/02 source) cited "72% adoption in largest subs" for Harassment Filter. This was implicitly available for listing copy.
**Proposed:** Strike any "72% adoption" claim. Replace Memory-positioning copy with the verbatim Reddit-docs quote: "Reddit's own Ban Evasion Filter help page states: 'the ban evasion filter doesn't filter based on post or comment context (i.e. this tool doesn't use behavioral or contextual patterns).' Memory fills exactly this gap — it matches writing style and behavioral patterns that Reddit's native filter architecturally cannot." Cite Reddit's help URL.
**Reason:** "72% adoption" has no verifiable public source (research/07 § Adoption Reality, audited across Reddit's S-1 coverage, official blog, help pages, news coverage). Reddit's Ban Evasion Filter quote is self-documented by the competitor and is the strongest positioning evidence in the spec (research/07 § Ban Evasion Filter).
**Materiality:** risky (credibility risk; unsourced stat)
**Implementation cost:** trivial (replace two sentences)

### File: sentinel-spec/02-architecture.md
**Section:** § Alert dispatcher § dispatchAlert (lines 276–298); § Alert record (lines 128–153)
**Current:** `dispatchAlert(alert)` performs five steps framed as "Atomic persistence to KV."
**Proposed:** Replace "atomic" framing with idempotent retry semantics. Step order: (1) persist `sentinel:alert:{alertId}` with `dispatchState: 'pending'`; (2) `zAdd` to `sentinel:alerts:open`; (3) `zAdd` to `sentinel:alerts:by_target:{targetId}` (post R-NoSets); (4) append `sentinel:audit_log`; (5) update dashboard pinned post (debounced); (6) send modmail if critical; (7) set `dispatchState: 'complete'` on alert record. Crash recovery: on each tick of `sentinel.every_5m.refresh_thread_health`, scan recent alerts where `dispatchState == 'pending'` and replay steps 2–6. All steps are idempotent (set membership via zAdd; audit log keyed by alertId; dashboard read-and-render; modmail dedup-keyed by alertId).
**Reason:** Devvit Redis is single-key atomic with no pipelining and no Lua (research/06 § Q4); multi-key "atomic" persistence is not a primitive. Idempotent retry is the standard pattern.
**Materiality:** risky
**Implementation cost:** small

### File: sentinel-spec/02-architecture.md
**Section:** § Event ingestion § Debouncing (lines 207–208); ingestComment signature (lines 196–201)
**Current:** "Debounce engine evaluations to once per 5 seconds per thread." No implementation mechanism specified.
**Proposed:** Document the CAS pattern explicitly. Add a `sentinel:thread:{postId}:lastEval` key (TTL ~60s). Before invoking any engine evaluation: `last = await redis.get('sentinel:thread:{postId}:lastEval')`; if `last && now - parseInt(last) < 5000`, skip; else `redis.set('sentinel:thread:{postId}:lastEval', String(now))` and evaluate. Annotate as "approximate debounce — concurrent handlers may race; the 5s budget is a soft floor."
**Reason:** Devvit triggers do not provide built-in debounce; manual KV CAS is the only reliable pattern (research/04 § Spec Patterns That May Conflict).
**Materiality:** risky
**Implementation cost:** trivial

### File: sentinel-spec/05-engine-health-score.md
**Section:** Signal 2 — Sentiment swing (line 65); Forecast generation (lines 169–175)
**Current:** "Use AFINN-style word lists" (variant unspecified). "If slow mode were enabled (velocity drops 70%) const mitigatedTrajectory = trajectory * 0.3" (hardcoded constant).
**Proposed:** Pin lexicon as AFINN-2015-en; embed a ~30-entry emoji-→-score extension table; specify token handling (case-fold, strip punctuation, look up each token, sum, divide by token count, clamp to [-1, +1]); document neutral fallback for tokens not in the combined lexicon; document that non-English subs receive degraded sentiment accuracy. Make slow-mode impact configurable: introduce `slowModeVelocityImpact` in `SubSettings.advanced` (default 0.7) and reference it in the forecast formula; document pending E-SlowMode validation.
**Reason:** AFINN variant unspecified; English-only; emoji uncovered (research/03 Item 2). 70% slow-mode drop is a spec open question (`00-architectural-summary.md` Open Question 4) fed directly into the demo's forecast-diff payoff (research/07 § Mod Insights confirms no comparable tool); if the real impact diverges, the forecast loses credibility.
**Materiality:** risky (AFINN), cosmetic (slow-mode constant)
**Implementation cost:** small (ship lexicon JSON + emoji table ~50 KB; one settings field)

### File: sentinel-spec/04-engine-memory.md, sentinel-spec/02-architecture.md
**Section:** `04-engine-memory.md` § Stylometry similarity (lines 96–116); § UserFingerprint § stylometry (lines 80–93); `02-architecture.md` § Histogram class (lines 252–261)
**Current:** Cosine over numeric stylometry vector with no normalization; top-50 trigrams from raw text; vocabulary as unbounded `Set<string>`; `Histogram` class without bucket count or overlap formula.
**Proposed:** (a) L2-normalize the numeric stylometry vector before cosine; (b) trigram preprocessing — lowercase entire comment, collapse whitespace, strip leading/trailing, then extract overlapping 3-char windows; (c) cap vocabulary at top-N most-frequent (N=2000); maintain via `Map<word, count>`; when map exceeds 2500 entries, drop lowest-frequency 500; (d) pin histogram bucket schemas: posting-time → 24 buckets (one per UTC hour); account-age → 10 buckets (0–7d, 7–30d, 30–90d, 90–180d, 180d–1y, 1–2y, 2–5y, 5–10y, 10y+, unknown); comment-length → 5 buckets (0–50, 50–200, 200–500, 500–1500, 1500+ chars); (e) pin overlap formula as histogram intersection.
**Reason:** Un-normalized cosine biases toward magnitude-dominant features; unbounded vocabulary grows 10× per high-volume user; exact-string trigram membership is sensitive to case/whitespace; histogram overlap formula has multiple valid options that diverge (research/03 Items 3, 6, 8; § Vocabulary Set unbounded growth).
**Materiality:** risky
**Implementation cost:** small (one bundle add for stylometry preprocessing; settings field for vocabulary cap; histogram bucket pin is text-only)

### File: sentinel-spec/06-dashboard-and-ui.md, sentinel-spec/03-engine-raid-radar.md
**Section:** `06-dashboard-and-ui.md` § Tab: Threats (lines 60–77); `03-engine-raid-radar.md` § Dashboard panel § Middle: Cluster visualization (lines 184–188)
**Current:** Cluster graph (SVG, ~30–50 nodes + edges) renders inline on the Threats tab.
**Proposed:** (a) Lazy-load the cluster graph — render only after the user explicitly opens a specific alert's detail view; (b) cap to ≤20 nodes; collapse remainder into "+N more accounts" badge; (c) fixed-height container (320 px) to prevent layout shift; (d) cache rendered structure in app memory keyed by alertId; (e) cluster-state cache writes chunked to ≤2 MB per R-5MB-Chunking.
**Reason:** Devvit Blocks rendering complexity is borderline on mobile; 200+ DOM elements per cluster plausible at 30–50 nodes; Lighthouse flags >1500 total DOM nodes (research/04 § Custom Post Complexity; research/05 Q9).
**Materiality:** risky
**Implementation cost:** small

### File: sentinel-spec/04-engine-memory.md, sentinel-spec/07-onboarding-and-install.md
**Section:** `04-engine-memory.md` § (new) Cold-start behavior; `07-onboarding-and-install.md` Welcome modal copy
**Current:** Memory's cold-start condition on a fresh sub install is not addressed; the welcome modal makes no Memory-specific guidance.
**Proposed:** Add a "Cold-start behavior" subsection to `04-engine-memory.md`: "Memory's banned-index is populated by `ModAction.banuser` events on the installed sub. A fresh install on a sub that has never banned anyone has an empty index — Memory's User Spotlight surface reports 'No ban history yet — Memory will start matching once mods take ban actions.' If the sub already has ban history in Reddit Mod Notes or Toolbox usernotes, the optional Mod Notes integration (see R-ModNotes-Now) can pre-seed the banned-index at install. Memory's evaluation gate (≥10 comments per candidate) is configurable in advanced settings; lowering it speeds up matching for newly active candidates at the cost of higher false-positive risk." Add one sentence to the welcome modal Memory tile: "Memory activates the first time you ban a user; accuracy improves as your ban history grows."
**Reason:** A fresh install on a sub with no prior bans has an empty banned-index; mod expectations need to be set explicitly (v2 critique #6; research/06 § Cross-Sub; research/08 § Memory at <200 members).
**Materiality:** risky
**Implementation cost:** trivial (text only)

### File: sentinel-spec/08-build-plan.md
**Section:** Milestone 1 (lines 15–28); Risk register (lines 189–222)
**Current:** Milestone 1 includes bootstrap job. Risk register mentions a "1-day spike at the start of Milestone 1" for verifying Devvit API surface but does not call out specific runtime quotas.
**Proposed:** Retarget the Phase 0 empirical spike to the still-unknown items only: (E-SchedulerTimeout) per-job execution time and memory limit; (E-RedisThrottle) 40K cmds/sec throttling behavior on overrun; (E-SlowMode) slow-mode velocity impact. Closed by research/06 and therefore removed from the spike: Redis quotas (Q4 closed), Mod Notes API (closed), `accountCreatedAt` field name (closed). One day total. Record results in a new file `sentinel-spec/research/09-runtime-probes.md`.
**Reason:** Research/06 closed E1 (Q4 Redis quotas) and E7 (`accountCreatedAt` field name) with firm numbers from official docs; v1's Phase 0 spike was redundantly scoped to items now closed. Remaining unknowns (per-job timeout, 40K throttle behavior, slow-mode impact) are decision-driving for Milestone 1 parameters and warrant the spike.
**Materiality:** risky-leverage (one day spent now retires multi-day rework later)
**Implementation cost:** small (1 day, dedicated probes)

### Revision summary table

| ID | File(s) | Materiality | Cost | Primary research source |
|---|---|---|---|---|
| R-Bootstrap | 07-onboarding-and-install.md, 02-architecture.md, 08-build-plan.md, 00-architectural-summary.md | blocker | small | research/04 § Bootstrap Feasibility; research/08 § Part A |
| R-Welford | 02-architecture.md, 00-architectural-summary.md | blocker | trivial | research/03 Item 4; research/09 |
| R-NoSets | 02-architecture.md, 00-architectural-summary.md | cosmetic (was: blocker — downgraded Wave D) | trivial | research/06 § Q4 Additional limits; research/10 |
| R-5MB-Chunking | 02-architecture.md, 04-engine-memory.md, 00-architectural-summary.md | risky (was: blocker — downgraded Wave D) | small | research/06 § Q4 — Redis Quotas; research/11 |
| R-Sub-Overlap-Cap | 03-engine-raid-radar.md, 04-engine-memory.md | blocker | trivial | research/05 Critical Finding 1; research/06 § Cross-Sub User History |
| R-ModNotes-Now | 04-engine-memory.md, 02-architecture.md | risky | small | research/06 § Mod Notes API |
| R-Demo-Honest-Framing | 09-demo-video-script.md (+ external Devpost copy) | risky | trivial | research/08 § Part B + § Honest framing options |
| R-Competitive-Cleanup | 10-app-listing.md | risky | trivial | research/07 § Adoption Reality + § Ban Evasion Filter |
| R-Dispatch-Idempotent | 02-architecture.md | risky | small | research/04 § Spec Patterns That May Conflict; research/06 § Q4 |
| R-Debounce-CAS | 02-architecture.md | risky | trivial | research/04 § Spec Patterns That May Conflict |
| R-AFINN | 05-engine-health-score.md | risky (lexicon), cosmetic (slow-mode) | small | research/03 Item 2 |
| R-Stylometry-Norm | 04-engine-memory.md, 02-architecture.md | risky | small | research/03 Items 3, 6, 8, Vocabulary growth |
| R-Cluster-Graph | 06-dashboard-and-ui.md, 03-engine-raid-radar.md | risky | small | research/04 § Custom Post Complexity |
| R-Memory-Cold-Start | 04-engine-memory.md, 07-onboarding-and-install.md | risky | trivial | v2 critique #6; research/06 § Cross-Sub; research/08 § Memory at <200 |
| R-Phase0-Retarget | 08-build-plan.md | risky-leverage | small | research/06 (closes E1/E4/E7); residual still-unknowns |

**Items intentionally dropped from v1:** R10 (Mod Notes deferral to v2) is reversed and replaced by R-ModNotes-Now. R13 (split `performModAction` into auto/manual variants) is dropped as gold-plating per v2 critique #5 — the existing prose reminder in `02-architecture.md` § Mod action API is sufficient defense-in-depth for Q9. R14 (storage eviction policy with placeholder thresholds) is dropped because research/06 closed Q4 with firm numbers (500 MB / installation); the existing 90-day inactive aging combined with the 1000-entry audit-log cap keeps Sentinel well under 500 MB at stated scale, no graceful-degradation policy needed. R12 and R15 (cosmetic copy/parameter tweaks) are absorbed into their parent revisions (R-Bootstrap and R-AFINN respectively).

**Application order suggestion:** R-Bootstrap → R-Welford → R-NoSets → R-5MB-Chunking → R-Sub-Overlap-Cap (all blockers; touch the most spec files; unlock everything else). Then R-Dispatch-Idempotent → R-Debounce-CAS (architecture risky cluster). Then R-AFINN → R-Stylometry-Norm → R-Histogram (absorbed into R-Stylometry-Norm). Then R-Cluster-Graph (UI risky). Then R-ModNotes-Now → R-Memory-Cold-Start (Memory enhancements). Then R-Demo-Honest-Framing → R-Competitive-Cleanup (external-facing). Then R-Phase0-Retarget (spike kicks off before Milestone 1 begins). All revisions are independent in mechanism; ordering is pragmatic.

---

## Things to leave alone

These survive the evidence base and the deadline change. Most carry over from v1; a few are reinforced by Wave C.

- **Q1 Project scope (build all three engines)** — competitive landscape validates the platform thesis (research/02 + research/07). Cutting an engine cuts the differentiator. PRI-3 offers scope governance as a *proactive* lever the lead may choose, but no research forces a cut under the 47-day deadline.
- **Q2 Demo environment (private test sub + scripted alts)** — required by hackathon rules; statistical mismatch on small sub mitigated by R-Demo-Honest-Framing.
- **Q3 Demo narrative lead (Raid Radar)** — cluster-graph visual impact remains the most cinematic; R-Cluster-Graph preserves it.
- **Q4 Statistical brain (baseline + z-scores + signal stacking)** — research/03 validates O(1) updates, explainability, no training data. The most important decision in the spec stands.
- **Q5 Dual-signal Memory (behavior + stylometry combined)** — research/02 + research/07 confirm no Devvit app does dual-signal; the dual-signal guard directly addresses single-signal false-positive risk.
- **Q6 Health Score (baseline + trajectory)** — research/03 validates sigmoid + trajectory amplifier shape.
- **Q7 Tiered settings** — research/04 § Conventions to Adopt supports `context.settings` pattern.
- **Q8 Alert delivery (dashboard + modmail by severity)** — research/02 Mod Insights gap shows dashboard need; modmail-as-pager standard.
- **Q9 Suggest, don't auto-ban** — research/02 + research/07 frame this as the explicit differentiator vs Evasion Guard / Hive Protect's auto-ban posture. R13 (type-level split of `performModAction`) is dropped per v2 critique #5; the prose reminder is sufficient.
- **Q10 Sliding-window memory (100 comments/user, 90d retention, permanent banned)** — research/03 Item 5 + research/06 § Q4 confirm scale fits under 500 MB. PRI-4 surfaces cold-start framing as an honest-expectations item but does not challenge the storage strategy.
- **Q11 First-mod-wins + audit log + 24h revert** — research/02 + research/07 call reversibility a competitive advantage; Q11 is the mechanism.
- **Q13 Demo video structure** — PRI-2 challenges only the framing copy, not the structure.
- **Q14 False-positive feedback loop** — research/03 supports threshold adjustment without crossing into ML.
- **Q15 App listing strategy** — competitive thesis (research/02 + research/07) reinforces the brigade-screenshot lead.
- **Three-engine architecture and shared behavioral graph** — research/02 + research/07 name this as the moat.
- **Storage schema overall structure** (`02-architecture.md` § Devvit Redis schema) — namespacing pattern is correct; only the Set primitive (R-NoSets), 5 MB cap (R-5MB-Chunking), and dispatchAlert atomicity (R-Dispatch-Idempotent) framings change.
- **Sigmoid normalization (`sig(x - k)`)** — research/03 Item 7 validates the shape.
- **Statistical primitives (RollingStat / TimeSeries / Histogram)** — survive with the Welford clarification (R-Welford) and bucket pinning (absorbed into R-Stylometry-Norm).
- **Audit log retention (1000 entries, 30-day)** — bounded and consistent with Q11 + 5 MB write cap (1000 × 4 KB = 4 MB, safe).
- **Severity routing table** (`02-architecture.md` § Severity routing) — research/02 supports two-channel pattern.
- **Watching scope (50 threads max per sub)** — 50 × 50 KB = 2.5 MB, comfortably under both the 5 MB per-write cap and the 500 MB per-installation cap (research/06 § Q4).
- **Trigger set** — research/01 caps #3–#7 validate availability and payload usability.
- **Mod menu items on posts/users/comments** — standard ergonomics.
- **Daily/hourly/5min/6h scheduler cadence** — research/06 § Q6 confirms scheduler exists with documented rate limits; the cadences fit under the 10-job cap.
- **Welcome modal copy structure** — only the bootstrap-time language (R-Bootstrap) and the Memory cold-start sentence (R-Memory-Cold-Start) change; the rest stands.

### Cross-cutting observations

- **The "shared infrastructure" thesis (`02-architecture.md` line 30)** is the architectural keystone. Every revision in this report respects the pattern that engines do not call each other directly — they all read the same graph. None of the proposed changes break that invariant.
- **The "production-ready over impressive-looking" principle** is reinforced by accepting these revisions. The 14-day bootstrap, the multi-key "atomic" dispatch, and the unbounded Set primitive all look fine in the spec; the three-pattern hybrid, the idempotent retry, and the sorted-set re-encoding are what survive contact with Devvit's runtime.
- **The "honest > impressive" principle** carries through with extra weight in v3. R-Demo-Honest-Framing and R-Memory-Cold-Start both elevate "transparent limitation" from spec prose to user-facing copy. Mods get honest cold-start framing for both bootstrap and Memory, not implicit promises.
- **R13 (split performModAction)** is intentionally dropped. The prose reminder in `02-architecture.md` § Mod action API is sufficient defense-in-depth for Q9. Type-level enforcement would ripple across every engine-caller and dashboard button for marginal safety benefit (v2 critique #5).

---

## Empirical-test items (deferred to build phase)

Retargeted from v1's E1–E8 to the items research/06 did not close. Designed to be retired by a 1-day Phase 0 spike (R-Phase0-Retarget). Do NOT design solutions; record observed values and update spec parameters in Phase 2 follow-up.

- **E-SchedulerTimeout — Scheduler per-job execution time and memory limit** (research/06 § Q6 partial). Approach: schedule a one-off `runJob` that performs a tight CPU loop with a counter logged every 30 seconds; let it run for a 60-minute target. Record the duration at which Devvit terminates (and whether it emits a timeout error or kills silently). Repeat with an I/O-bound variant (Redis writes in a loop) to detect CPU-bound vs I/O-bound timeout differences. Pass/fail criterion: timeout ≥ 5 minutes for the progressive backfill chunks. If shorter, R-Bootstrap's hourly job must chunk further.

- **E-RedisThrottle — 40K cmds/sec throttling behavior on overrun** (research/06 § Q7 partial). Approach: write 1,000 keys/sec, then 10,000/sec, then 50,000/sec for 60 seconds each; measure success rate, p50/p95/p99 write latency, and rate-limit error response (if any). Record recovery time after overrun. Pass/fail criterion: ≥10 keys/sec sustained throughput per app with p99 < 500 ms. If lower, R-Debounce-CAS's 5-second debounce widens to 10 seconds; R-Dispatch-Idempotent's retry backoff lengthens.

- **E-SlowMode — Slow-mode velocity impact** (`00-architectural-summary.md` Open Question 4). Approach: enable slow mode on an active thread during scripted brigade simulation; measure comments/min for 30 minutes before vs 30 minutes after. Pass/fail criterion: observed reduction is within ±20% of the spec's 70% assumption. If outside, adjust R-AFINN's `slowModeVelocityImpact` default and re-derive forecast formula constants.

- **E-Modmail — Modmail send rate** (research/05 Q8 still-unknown). Approach: send 30 modmails in 60 seconds, then 60, then 100; record the rate at which sends start failing or get queued. Pass/fail criterion: ≥10 modmails/min sustained (Sentinel's expected burst is ~1–5/day per spec, far below). If lower, batch critical alerts within a 30-second window into a single summary modmail.

- **E-DOM-Count — Custom-post DOM node count at peak** (research/04 § Custom Post Complexity; research/05 Q9). Approach: open the full dashboard with cluster graph rendered (20 nodes per R-Cluster-Graph), all 5 tabs interacted with, KPI tiles populated, and an alert detail modal expanded; use a DOM-count helper to measure total nodes and time-to-interactive on mid-range mobile (e.g., Reddit native app on slow 4G). Pass/fail criterion: <1000 DOM nodes total, <2s TTI. If exceeded, apply additional lazy-loading.

- **E-Trigram-Latency — Trigram extraction + vocabulary maintenance latency** (research/03 Item 1). Approach: run the trigram extractor on 100 sample comments of length 50 / 200 / 500 / 1000 / 2000 chars; record per-comment p50/p95/p99 latency including the L2-normalized cosine + Jaccard pipeline (from R-Stylometry-Norm). Pass/fail criterion: <20ms p95 across all sizes. If >20ms, switch trigram + vocabulary maintenance to a batched hourly job.

**Closed by research/06 (no longer deferred):**
- ~~E1 Redis quotas~~ — closed (500 MB / installation, 5 MB / request, 40K cmds/sec, 4.2B keys, 20 tx concurrent, 5s tx timeout, no Sets, no key enum, no pipelining, no Lua, sorted-set LIMIT max 1000 results).
- ~~E4 Mod Notes API~~ — closed (`addModNote`/`getModNotes` fully typed and verified in production).
- ~~E7 `accountCreatedAt` field name~~ — closed (`user.createdAt` is `Date` type).

Empirical results from this spike should land in `sentinel-spec/research/09-runtime-probes.md` (new file) and feed back into spec parameter values during a Phase 2 follow-up pass. Each item lists pass/fail criteria so the spike is decision-driving rather than data-collecting.

---

## Phase 2 application notes

**For the lead applying this report:**

1. **Decide PRI-1 first.** Q12's mechanism revision is the gating item. If PRI-1 is approved as proposed (three-pattern hybrid), R-Bootstrap + R-Welford apply mechanically. If PRI-1 is rejected, the entire bootstrap stack needs redesign.

2. **Apply blockers in one editing session.** R-Bootstrap, R-Welford, R-NoSets, R-5MB-Chunking, R-Sub-Overlap-Cap all touch `02-architecture.md` and related summary tables. They are independent in mechanism but coherent in framing — apply together so the spec reads consistently.

3. **PRI-2 (demo honest framing) is editable in `09-demo-video-script.md` independently** of the Phase 0 spike. Apply when convenient.

4. **PRI-3 (scope governance) is optional.** The default path is "do not cut." If the lead chooses to cut scope for polish leverage, do so before Milestone 4 begins (Raid Radar) so the build sequence reflects the cut.

5. **PRI-4 (Memory cold-start framing) ties into R-ModNotes-Now.** Apply together: the Mod Notes integration is the cold-start mitigation for subs with prior ban history.

6. **R-Phase0-Retarget kicks off before Milestone 1.** Block on its results before locking parameter values for scheduler-chunk size, debounce TTL, and slow-mode velocity impact.

7. **R13 is dropped.** Do not split `performModAction`; the prose reminder is sufficient.

8. **R10 is reversed.** Mod Notes integration moves from v2 to v1 (R-ModNotes-Now); the deferral note in v1 is obsolete.

---

## Risks not addressed by this report

In service of "honest > impressive" (`01-product-decisions.md` cross-cutting principles), the limits of this review:

1. **Devvit runtime evolution.** Research/06 anchors on `reddit/devvit-docs` and the `@devvit/public-api` source as of early 2026. Reddit's developer platform may publish further documentation between now and build start; re-check `reddit/devvit-docs/docs/capabilities/server/scheduler.mdx` at the start of the Phase 0 spike for per-job timeout numbers that may appear after this report is written.

2. **Hackathon submission rule changes.** The Devpost hackathon page is live but submission detail is not publicly visible to non-participants. If the hackathon adds new mandatory criteria (publishing source code, demo length changes, mandatory open beta), this report has no signal on them.

3. **No primary-source Devvit testing.** Every research claim about Devvit's runtime is inferred from official docs (research/06 § Q4 cites `redis.mdx`, `scheduler.mdx`) or third-party apps. The Phase 0 spike is the first time Sentinel actually touches Devvit's runtime; all conclusions in this report are provisional until E-SchedulerTimeout, E-RedisThrottle, E-SlowMode, E-Modmail, E-DOM-Count, E-Trigram-Latency land.

4. **No competitive-app deep-dive.** Research/02 + research/07 identified competitors and overlap; they did not download and run each app on a test sub to compare detection accuracy or UX patterns. If a judge has used Hive Protect or Evasion Guard, they will have specific feature expectations this report cannot anticipate.

5. **No mod-user research.** The spec assumes the target audience is mods of 10K–500K subs (Q15) but no interviews or surveys validate the workflow assumptions in `06-dashboard-and-ui.md`. The dashboard's tab structure is a senior-product hypothesis, not a tested design.

6. **Statistical method choice in adversarial conditions.** Research/03 validates the math for normal data. It does not address adversarial inputs: an attacker who studies Sentinel's signal definitions (public via spec) and engineers a brigade to evade them. The spec's "honest limitation" framing covers this in principle (`04-engine-memory.md` § Edge cases mentions sophisticated evaders), but no formal threat model exists.

7. **Memory cold-start at production scale.** Research/08 § Memory at <200 members quantifies cold-start at the demo sub. The same arithmetic applied to a 10K–500K-member production sub gives ≥10-comment accumulation in hours for active users, which closes the gap — but the report has not validated the Mod Notes pre-seeding path (R-ModNotes-Now) against a production sub that does have prior ban history; the mechanism is sound but unobserved.

8. **Demo-sub realism.** The hackathon requires a <200-member sub (Q2). Sentinel's signals are calibrated for 10K–500K subs (Q15). The demo necessarily simulates rather than observes. PRI-2 + R-Demo-Honest-Framing close the framing gap; execution risk on the pre-staging is real and should be rehearsed at least once before recording.

These items are surfaced for the lead's awareness; none invalidate the report's recommendations.

---

## Research citation index

Quick-reference index of which research file informed which finding.

**research/01 — Devvit Capability Matrix**

- Caps #3–#7 (triggers): Validated #1; supports trigger set in Things to leave alone.
- Caps #11, #13, #14, #15 (mod actions): Validated #3.
- Cap #16 (scheduler): Validated #5 (combined with research/06 for rate-limit numbers).
- Cap #19 (Mod Notes): superseded by research/06 § Mod Notes API (now public).

**research/02 — Competitive Landscape**

- Differentiation thesis paragraph: Competitive risks § Differentiation thesis.
- Existing apps table: Risks 2–3.
- Reddit-internal features table: Risk 1 (refined by research/07 § Adoption Reality).

**research/03 — Statistical Methods Sanity**

- Item 1 (trigram extraction <20ms): E-Trigram-Latency.
- Item 2 (AFINN brittleness): Broken assumption H + R-AFINN.
- Item 3 (cosine normalization): Broken assumption K + R-Stylometry-Norm.
- Item 4 (Welford rolling 14d): Broken assumption B + R-Welford.
- Item 5 (storage budget): Validated #10 (refined by research/06).
- Item 6 (Jaccard preprocessing): Broken assumption K + R-Stylometry-Norm.
- Item 7 (sigmoid): Validated #9.
- Item 8 (histogram overlap): Broken assumption L + R-Stylometry-Norm (absorbed).

**research/04 — Devvit Best Practices**

- § Bootstrap Feasibility: Broken assumption A + R-Bootstrap.
- § Spec Patterns That May Conflict (atomic): Broken assumption I + R-Dispatch-Idempotent.
- § Spec Patterns That May Conflict (debounce): Broken assumption J + R-Debounce-CAS.
- § Custom Post Complexity: Broken assumption M + R-Cluster-Graph + E-DOM-Count.
- § Rate Limits and Quotas: rate-limit subsection; informs storage budget (refined by research/06).
- § Conventions to Adopt: Q7 tiered settings; general TypeScript/file structure.
- § Install Hook: R-Bootstrap "non-blocking install" requirement.

**research/05 — Devvit Verification (Round 2)**

- Q1 (cross-sub user history): Critical Finding 1 → Broken assumption E (refined by research/06).
- Q2 (createdAt): closed by research/06.
- Q3 (historical backfill): Broken assumption A + R-Bootstrap (with research/04 and research/08).
- Q4 (Redis quotas): closed by research/06.
- Q5 (Mod Notes): closed by research/06.
- Q6 (scheduler timeout): partially closed by research/06; E-SchedulerTimeout for per-job timeout.
- Q7 (KV throughput): substantially closed by research/06; E-RedisThrottle for overrun behavior.
- Q8 (modmail rate): still-unknown; E-Modmail.
- Q9 (Blocks rendering): partially closed (no Devvit-specific cap; web standard applies); R-Cluster-Graph mitigates.

**research/06 — Devvit Capabilities Deepened (Wave C)**

- Q4 Redis Quotas (closed): Validated #10; Broken assumption C (no Sets) + R-NoSets; Broken assumption D (5 MB cap) + R-5MB-Chunking; informs sorted-set LIMIT pagination note in Devvit-specific issues.
- Q6 Scheduler (partially closed): Validated #5; E-SchedulerTimeout (per-job timeout still open).
- Q7 KV Throughput (substantially closed): Devvit-specific issues § Rate-limit risks; E-RedisThrottle (overrun behavior still open).
- § `account.createdAt` (closed): Validated #2.
- § Mod Notes API (closed): Validated #6 + R-ModNotes-Now (reverses v1 R10).
- § Cross-Sub User History (closed): Broken assumption E + R-Sub-Overlap-Cap.

**research/07 — Hackathon Viability + Competitive Depth (Wave C)**

- § Part A Sentinel Calibration: Validated #13; PRI-3 framing (proactive scope, not forced).
- § Ban Evasion Filter: Competitive risks § Risk 1 (verbatim quote); Differentiation thesis; R-Competitive-Cleanup.
- § Harassment Filter + § Adoption Reality: R-Competitive-Cleanup (strike 72% adoption); Competitive risks § Note on prior unsourced stat.
- § Mod Insights: Competitive risks § Risk 1.
- § Differentiation thesis paragraph: Competitive risks § Differentiation thesis.

**research/08 — Bootstrap + Small-Sub Demo (Wave C)**

- § Part A (three patterns): R-Bootstrap (the three-pattern hybrid).
- § Part B Baseline math at <200 members: Broken assumption G + PRI-2 + R-Demo-Honest-Framing.
- § Part B Engine-by-engine viability: PRI-4 + R-Memory-Cold-Start.
- § Honest framing options: R-Demo-Honest-Framing (Option 1: Calibrated test sub).
- § Bootstrap pattern decision matrix: R-Bootstrap (implementer-facing reference).

**research/09 — Rolling-Stat Algorithm Workaround (Wave D)**

- § Per-algorithm evaluation (all five candidates): R-Welford algorithm-per-signal recommendation.
- § Algorithm 5 — Welford-with-decay: default for volatile signals (comments/h, velocity, report-rate, sentiment swing); Validated #11 supplement.
- § Algorithm 1 — Full-history Welford: default for slow-changing signals (account-age distribution, new-account ratio).
- § Tradeoff matrix: Sliding-window Welford rejection (>20 ms budget at sub-minute rates).
- § Algorithm 3 — EWMA: EWMA rejection (warm-up problem during 7-day calibration ramp).

**research/10 — Sets + Atomicity Workaround (Wave D)**

- § Part A — Pattern 1 (sorted-set-as-set): R-NoSets encoding for `sentinel:alerts:open`.
- § Part A — Pattern 2 (hash-as-set): R-NoSets encoding for `sentinel:alerts:by_target:{targetId}`.
- § Part A — Pattern 3 (string-of-CSV): explicitly rejected for Sentinel.
- § Part B — Pattern 1 (WATCH-MULTI-EXEC): Validated #14 (positive discovery); reduces R-Dispatch-Idempotent complexity; primary atomicity mechanism for dispatchAlert.
- § Part B — Pattern 2 (idempotent retry): backstop pattern; combined with WATCH-MULTI-EXEC for dispatchAlert.
- `TxClientLike` interface confirmation: Validated #14 source.

**research/11 — Large-Value Chunking Workaround (Wave D)**

- § Recommendation per Sentinel Oversize-Risk Write: R-5MB-Chunking focus narrowed to `banned_index` only.
- § Approach 4 — Avoidance/Re-architect: primary recommendation for `banned_index` (per-user keys + sorted-set enumeration); R-5MB-Chunking proposed pattern.
- § Approach 1 — Compression: secondary fallback only; `CompressionStream` runtime availability unconfirmed in Devvit.
- § Approaches 2–3 (multi-key splitting, versioning): not recommended for Sentinel writes.
- `fsvreddit/hive-protect` citation: per-item queue pattern (avoidance in practice).

---

*End of Plan Review Report v4. 15 revisions across 9 spec files (3 blocker / 10 risky / 1 risky-leverage / 1 cosmetic). Wave D re-grading: R-NoSets blocker → cosmetic; R-5MB-Chunking blocker → risky. Net blocker count: 5 → 3 (R-Bootstrap, R-Welford, R-Sub-Overlap-Cap). Positive discovery: WATCH/MULTI/EXEC transaction support confirmed (research/10, Validated #14). 4 Plan Review Items (PRI-1 Q12 mechanism, PRI-2 demo realism, PRI-3 scope governance, PRI-4 Memory cold-start). 6 empirical-test items deferred to Phase 0 spike (3 closed by research/06: Redis quotas, Mod Notes API, accountCreatedAt). v1's R10 reversed (Mod Notes promoted to v1); v1's R13 dropped (gold-plating per v2 critique #5); v1's R14 dropped (research/06 closed Q4). v1's R12 + R15 absorbed into parent revisions. Deadline rebalance: v2's PRI-2 (forced scope cut) deflated by the 2026-06-27 postponement; v2's critiques #3, #4, #5, #6 survive intact and are reinforced.*
