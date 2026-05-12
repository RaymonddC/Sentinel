# Sentinel — Delegation Log

Append-only log of teammate spawns by the lead architect. One entry per spawn.

---

## 2026-05-11 17:08 · Phase 0 · project-context-writer

Brief: Create root CLAUDE.md with shared context for all future teammates.
Model/Effort: haiku / low
Output location: ./CLAUDE.md
Status: accepted
Time: 17:08 → 17:19 (~11m)
Notes: 44 lines. README and 01-product-decisions.md align — no contradictions flagged. Coding conventions extracted conservatively (TypeScript, kebab-case).

## 2026-05-11 17:08 · Phase 0 · subagent-definitions-author

Brief: Create five named subagent definitions in `.claude/agents/`.
Model/Effort: haiku / low
Output location: `.claude/agents/{devvit-researcher,component-implementer,integration-architect,test-runner,spec-proofreader}.md`
Status: accepted
Time: 17:08 → 17:20 (~12m)
Notes: All 5 files written, YAML frontmatter validated. Sizes 383–651 B. No path conflicts.

## 2026-05-11 17:08 · Phase 0 · spec-summarizer

Brief: Read all 11 spec files, produce one-page architectural summary for the lead's reference.
Model/Effort: haiku / low
Output location: `sentinel-spec/00-architectural-summary.md`
Status: accepted
Time: 17:08 → 17:26 (~18m)
Notes: ~115 lines. No contradictions across files. 5 open questions surfaced (UI mockups not provided; sentiment lexicon underspecified; cold-start defaults incomplete; slow-mode velocity assumption unvalidated; account-age entropy threshold not empirically tuned) — folded into Phase 1 research backlog.

---

## 2026-05-11 17:30 · Phase 1 Wave A · devvit-data-researcher

Brief: Build Devvit capability matrix — for each spec signal/feature, what Devvit actually exposes (events, user data, mod actions, storage, custom posts, modmail, slow-mode). Cite sources.
Model/Effort: haiku / low
Output location: `sentinel-spec/research/01-devvit-capability-matrix.md`
Status: accepted (with verification follow-up needed)
Time: 17:30 → 17:42 (~12m)
Notes: 20 caps surveyed. 8 confirmed / 6 conditional / 2 BLOCKED / 4 unable-to-determine. **BLOCKERS:** (1) cross-sub user history — Devvit appears sub-scoped only; (2) cross-sub data access. **UNABLE TO DETERMINE:** account.createdAt access, Redis quotas, 14-day historical backfill API, Mod Note SDK. → These five items need a verification follow-up (separate teammate, possibly r/devvit or actual Devvit example apps) before the synthesizer can produce confident revisions. Sub-scope blocker, if confirmed, would force material spec revision (Raid Radar Signal 3, Memory's "active in 4 of former subs" claim, the cross-sub graph thesis itself).

## 2026-05-11 17:30 · Phase 1 Wave A · devvit-competitive-researcher

Brief: Identify existing Devvit apps + Reddit-internal features (Mod Notes, Crowd Control, Automod) that overlap with the three Sentinel engines.
Model/Effort: haiku / low
Output location: `sentinel-spec/research/02-competitive-landscape.md`
Status: accepted
Time: 17:30 → 17:36 (~6m)
Notes: 8 Devvit apps overlap (Evasion Guard, Hive Protect, Spam Source Spotter, Trending Tattler + 4 workflow tools). 7 Reddit-internal features overlap — strongest threat is Ban Evasion Filter + Harassment Filter + Mod Insights at platform scale (72% adoption in largest subs). **Hardest claim to defend:** statistical brigade detection beating Reddit's LLM-powered Harassment Filter + platform-wide ban-evasion fingerprinting. **Sentinel's unique win:** unified behavioral graph + explainable/reversible actions + 90s detection speed (no single engine wins alone).

## 2026-05-11 17:30 · Phase 1 Wave A · stats-sanity-researcher

Brief: Validate spec's statistical methods (Welford, z-scores, sigmoid, cosine, Jaccard, n-grams, AFINN) against Devvit data volumes and target latencies.
Model/Effort: haiku / low
Output location: `sentinel-spec/research/03-stats-methods-sanity.md`
Status: accepted
Time: 17:30 → 17:38 (~8m)
Notes: 9 methods evaluated, 8 spec validations. 4 OK / 3 risky / 1 broken. **Top red flag:** spec says "rolling 14d Welford" but Welford doesn't natively support windowing — needs decision (windowed Welford vs full-history with 14d as bootstrap only). Secondary: AFINN English-only / variant unspecified, top-50 trigram extraction <20ms needs benchmark, histogram-overlap formula not defined.

## 2026-05-11 17:30 · Phase 1 Wave A · devvit-practices-researcher

Brief: Devvit best practices, rate limits, scheduler quotas, async patterns, bootstrap feasibility (14-day backfill), and any spec patterns that conflict with Devvit conventions.
Model/Effort: haiku / low
Output location: `sentinel-spec/research/04-devvit-best-practices.md`
Status: accepted (with verification follow-up needed)
Time: 17:30 → 17:37 (~7m)
Notes: 8 conventions, 6 rate limits, 5 spec conflicts (1 BLOCKER + 3 risky + 1 cosmetic). **BLOCKER:** 14-day full backfill unfeasible — independently corroborates data-researcher's "unable to determine"; concrete fallbacks proposed (24h initial + 7d warm-up, or 3h background backfill job). **Risky:** debounce timing, atomic alert persistence, custom post complexity. Custom post achievable but cluster graph is the mobile-UX bottleneck (lazy-loading + canvas optimization needed). **Unknowns shared with data-researcher:** scheduler job timeout, KV write throughput, modmail rate limit, blocks rendering ceiling — all five need verification before opus synthesizer can write confident revisions.

---

## 2026-05-11 17:45 · Phase 1 Wave B · devvit-verification-researcher

Brief: Resolve 9 unknowns left by Wave A — cross-sub access, account.createdAt, 14d backfill API, Redis quotas, Mod Note SDK, scheduler timeout, KV write throughput, modmail rate, Blocks rendering ceiling. Go deeper than developers.reddit.com docs (npm public-api, GitHub Devvit examples, r/Devvit recent posts, typedoc).
Model/Effort: haiku / low
Output location: `sentinel-spec/research/05-devvit-verification.md`
Status: failed-to-start
Time: spawned 17:45 → never reached active
Notes: Pane %9 registered in team config but agent never reached `isActive` state. Status ping not processed. Re-spawned as `devvit-verifier-v2` with haiku/medium per updated effort policy.

## 2026-05-11 18:05 · Phase 1 Wave B · devvit-verifier-v2 (retry)

Brief: Same as above — resolve 9 unknowns left by Wave A.
Model/Effort: haiku / **medium** (effort upgraded from low per user policy update; previous attempt at low failed to start)
Output location: `sentinel-spec/research/05-devvit-verification.md`
Status: accepted
Time: 18:05 → 18:25 (~20m)
Notes: 6 of 9 resolved. **Most-impactful flip:** cross-sub user history is SCOPED not blocked — limited to ~100 recent items per user (per Hive Protect docs). Raid Radar's multi-month overlap baseline must narrow to recent activity. Mod Notes API exists but is undocumented — proven by `toolboxnotesxfer` app (reverse-engineer for Memory integration). `account.createdAt` accessible but field name unconfirmed (test before deploy). Blocks rendering safe (~300 nodes vs 1500 ceiling). 3 still-unknown (Q4 Redis quotas, Q6 scheduler timeout, Q7 KV throughput) — deferred to empirical-test in build phase.

---

## 2026-05-11 18:25 · Phase 1.3 · integration-architect (synthesizer)

Brief: Synthesize CLAUDE.md + 01-product-decisions + 00-architectural-summary + all 5 research files into the Plan Review Report. Sections per lead's spec: Summary / Validated / Broken / Competitive / Devvit-specific / Plan Review Items / Recommended revisions / Leave alone / Empirical-test items.
Model/Effort: opus / high
Output location: `sentinel-spec/00-plan-review.md`
Status: **rejected by user** — "wrong direction overall"
Time: 18:25 → ~19:15 (~50m incl. plan-approval cycle)
Notes: Verdict REVISE, 522 lines, 15 revisions / 1 PRI / 8 empirical items. User rejected without specific feedback. Redo planned: opus/xhigh with self-critique mode. Original archived to `sentinel-spec/00-plan-review.v1-rejected.md`. Shutdown approved 18:39, pane %11 freed.

---

## 2026-05-11 18:40 · Phase 1.3 (redo) · integration-architect-v2 (self-critique synthesizer)

Brief: Read rejected v1 report at `00-plan-review.v1-rejected.md` + all prior research + compass + summary. Phase A (internal): self-critique — identify what direction was wrong in v1. Phase B: produce corrected synthesis at `sentinel-spec/00-plan-review.md`. Begin report with a "Critique of prior synthesis" preface so the lead has an audit trail.
Model/Effort: opus / xhigh — max reasoning; user rejected opus/high without specific steer.
Output location: `sentinel-spec/00-plan-review.md` (fresh; v1 preserved separately)
Status: pending — plan-approval required before report writing
Time: spawned 18:40 →
Notes: mode=plan. Plan must include Phase A critique findings, revised verdict (if different), and how new direction diverges. Lead approves or revises.

**UPDATE 18:46:** v2 plan was sharp (6 concrete v1 failures identified, 3 PRIs proposed). User paused synth before report-write: research base too shallow. v2 shutdown approved; report never written. v2 plan content preserved in transcript for next synth's seed context.

---

## 2026-05-11 18:50 · Phase 1 Wave C · devvit-caps-deepener

Brief: Sonnet/medium re-research on the 3 still-unknowns (Q4 Redis quotas, Q6 scheduler timeout, Q7 KV throughput) + confirm `account.createdAt` field name + reverse-engineer Mod Notes API from `toolboxnotesxfer` + verify ~100-item cross-sub cap. Go beyond haiku's doc-reading: read TS types, npm package source, open-source Devvit mod-tool apps, deeper r/Devvit corpus.
Model/Effort: sonnet / medium
Output location: `sentinel-spec/research/06-devvit-caps-deepened.md`
Status: accepted
Time: 18:50 → ~19:15 (~25m)
Notes: 2.5/3 unknowns closed. **Q4 FULLY CLOSED:** 500 MB/installation (matches spec budget), 5 MB max per write, 40K commands/sec, ~4.2B keys, 20 concurrent tx max, 5s tx timeout. **Architectural constraints:** no key enumeration, no standard Sets, no pipelining. **Q6 PARTIAL:** 10 recurring jobs/install, 60 runJob/min, 60 deliveries/min, 1-min granularity — but per-job timeout/memory/concurrency still officially undocumented. **Q7 SUBSTANTIAL:** 40K commands/sec confirmed (read+write combined); write-specific cap + throttle behavior still undocumented. **Secondary all resolved:** `user.createdAt` is `Date` type (internal `createdUtc` unix seconds wrapped); **Mod Notes API is PUBLIC** — `context.reddit.addModNote()` / `getModNotes()` fully typed; cross-sub `getCommentsAndPostsByUser({limit:100, sort:"new"})` confirmed and includes `subredditName`. **Most-impactful new constraint:** 5 MB per-write cap may force chunking of cluster state / dense audit payloads.

## 2026-05-11 18:50 · Phase 1 Wave C · viability-researcher

Brief: Sonnet/medium reality check. (A) Examine real Devvit hackathon entries / shipped mod-tools: scope, complexity, live-vs-scripted demo, build time, dev team size — reality-check 16-day plan for 3-engine platform. (B) Deeper read on Reddit-internal top-3 (Ban Evasion Filter, Harassment Filter, Mod Insights) — capabilities, scope, adoption.
Model/Effort: sonnet / medium
Output location: `sentinel-spec/research/07-viability-and-competitive-depth.md`
Status: accepted
Time: 18:50 → ~19:10 (~20m)
Notes: 6 comparable apps found (Syllacrostic, 575, Laddergram, WYR, Hive Protect, Bot Bouncer) — **zero are multi-engine threat-detection systems; all single-mechanic**. Verdict: 16-day solo 3-engine viability **UNLIKELY**. Bot Bouncer (closest complexity peer) took months / ~126 commits iteratively. Hardest threat: Ban Evasion Filter × Memory cold-start problem — filter is platform-scale always-on; Memory needs ≥10 banned-user samples possibly deleted. **The "72% Harassment Filter adoption" stat is UNSOURCED** — recommend removing from claims. **Strongest positioning angle (verbatim from Reddit's own docs):** Ban Evasion Filter "doesn't filter based on post or comment context" — exact opposite of Memory's content-aware pitch.

## 2026-05-11 18:50 · Phase 1 Wave C · bootstrap-demo-researcher

Brief: Sonnet/medium analytical research. (A) Find 2-3 real Devvit apps that do install-time backfill; document actual mechanism + constraints. (B) Math out statistical viability in <200-member sub (z-scores on near-zero baselines) — Q2 hackathon constraint vs Q15 calibrated-for-10K-to-500K mismatch. Survey other Devvit mod-tool apps that demo on small subs.
Model/Effort: sonnet / medium
Output location: `sentinel-spec/research/08-bootstrap-and-small-sub-demo.md`
Status: accepted
Time: 18:50 → ~19:18 (~28m)
Notes: **3 concrete bootstrap patterns found** — Spam Source Spotter (bounded 1000-post hot-fetch at install + reactive), Hive Protect (zero-fetch purely reactive with 100-item cap), sub-stats-bot (daily scheduled forward-accumulation). **Small-sub verdict: REQUIRES-SCRIPTED-DEMO.** Critical math finding: `stddev || 1` fallback converts Raid Radar Signal 1 from z-score → absolute-count trigger on small/cold subs (~5 new accounts in 5min fires). Memory ≥10-comment gate makes it inoperative on fresh small sub without pre-seeding. Both already implicitly handled by demo script's pre-staging but never documented as statistical constraints — validates v2's PRI-3 hard.

---

## 2026-05-11 19:20 · DEADLINE UPDATE

User announced hackathon deadline postponed by ~1 month: **2026-05-27 → 2026-06-27** (~47 cal days runway from postponement date). Deflates v2's PRI-2 (scope-cut Memory) urgency — spec's 14–24 working-day estimate now fits comfortably with buffer. Scope-cut may still be surfaced as governance option, not forced choice. Memory engine restored to default-build scope.

---

## 2026-05-11 19:21 · Phase 1.3 (third pass) · integration-architect-v3

Brief: Synthesize all 8 research files + spec + v1 rejected report + v2 preserved critique into Plan Review Report. Updated context: deadline postponed to 2026-06-27. Preface with "Critique of prior synthesis" paragraph. Same 9 H2 sections.
Model/Effort: opus / xhigh
Output location: `sentinel-spec/00-plan-review.md` (fresh; v1 still at `.v1-rejected.md`)
Status: accepted (awaiting user review for Phase 2 go)
Time: 19:21 → ~21:35 (~2h14m)
Notes: 597 lines (target 700-850; under by 14% — v3 flagged willingness to expand). Verdict REVISE. **15 revisions across 9 spec files** (5 blocker / 9 risky / 1 risky-leverage). **4 PRIs:** Q12 mechanism, demo realism, scope governance, Memory cold-start. **Most-impactful divergences vs v1:** v1 missed 2 Wave C blockers entirely (no Sets primitive, 5 MB write cap). v3 reverses v1's R10 (Mod Notes API public, promoted to v1) and drops v1's R13 (gold-plating per v2 critique #5). Summary amendment folded verbatim. Two plan_approval_response calls during cycle (initial text + formal harness-bound retry).

---

## 2026-05-11 21:40 · Phase 1 Wave D · 3 blocker-workaround researchers (parallel)

Lead's decision: before approving Phase 2 revisions, research concrete workarounds for the 3 blockers that aren't trivially-resolved. (R-Bootstrap already has 3 patterns from research/08; R-ModNotes-Now is a positive flip not a blocker.)

### W1 · rolling-stat-researcher

Brief: Evaluate Welford full-history / windowed Welford / EWMA / periodic-reset / hybrid for Sentinel's "rolling 14d" baseline stats. Tradeoffs at Devvit scale + recommend per signal (comments/h z-score, sentiment, report rate).
Model/Effort: sonnet / medium
Output location: `sentinel-spec/research/09-rolling-stats-workaround.md`
Status: **failed-to-start** (pane %1 registered, never reached active)
Time: spawned 21:40 → never reached active
Notes: Same failure pattern as prior verification-researcher (sonnet model, mode default). Re-spawned as `rolling-stat-researcher-v2` below.

### W1-retry · rolling-stat-researcher-v2

Brief: same as W1.
Model/Effort: sonnet / medium
Output location: `sentinel-spec/research/09-rolling-stats-workaround.md`
Status: pending
Time: spawned 21:50 →
Notes: Retry of failed W1 spawn.

### W2 · set-atomicity-researcher

Brief: Find canonical Devvit patterns for set-membership emulation (no Sets primitive) and multi-key atomicity (no pipelining, no Lua). Real-app examples. Recommend approach for `alerts:open`, `alerts:by_target:{id}`, banned-index, dispatchAlert.
Model/Effort: sonnet / medium
Output location: `sentinel-spec/research/10-sets-atomicity-workaround.md`
Status: pending
Time: spawned 21:40 →
Notes: —

### W3 · chunking-researcher

Brief: Find workarounds for 5MB per-write cap. Compression / multi-key split / versioning / data restructuring. Real-app examples. Recommend specific approach for each Sentinel oversize-risk write (cluster state, banned-index hot-cache, dense audit batches).
Model/Effort: sonnet / medium
Output location: `sentinel-spec/research/11-chunking-workaround.md`
Status: accepted
Time: ~23:12 (~92m)
Notes: Narrower than feared — **only `banned_index` is genuinely oversize-risk**. Others (cluster state, audit, fingerprint, thread state) safe at 30-150KB. Recommended: avoidance/re-architect (per-user keys + sorted-set enumeration). Compression as secondary fallback (CompressionStream not confirmed in Devvit runtime).

### W2 · set-atomicity-researcher — completion

Status: accepted
Time: ~23:13 (~93m)
Notes: **BIG positive finding — Devvit Redis DOES support WATCH/MULTI/EXEC optimistic-locking transactions.** Confirmed from official redis.mdx + `TxClientLike` interface in `packages/public-api/src/types/redis.ts`. Recommended patterns: sorted-set-as-set for `alerts:open` (time-ordered), hash-as-set for `alerts:by_target` (O(1) unordered), banned_index already hash (OK). dispatchAlert can be a real atomic transaction — no compensating-action hacks needed.

### W1-retry · rolling-stat-researcher-v2 — completion

Status: accepted
Time: ~23:13 (~83m)
Notes: Recommended **Welford-with-decay (capped count)** as default — converges to EWMA at saturation, preserves accurate warm-up for 7d calibration ramp. **Full-history Welford** for slow signals (account-age dist, new-account ratio) where long-term stability is a feature. Sliding-window Welford rejected (>20ms budget at sub-minute rates). EWMA has warm-up problem.

---

## 2026-05-11 23:20 · Phase 1.4 · integration-architect-v4 (fold-in)

Brief: Targeted update to `00-plan-review.md` (v3 trunk). Fold in Wave D workarounds (research/09, /10, /11) + WATCH/MULTI/EXEC discovery. Update specific revision blocks (R-Welford, R-NoSets, R-5MB) with concrete patterns. Re-grade materiality where workaround simplifies the fix. Preserve everything else from v3.
Model/Effort: sonnet / high (narrower than v3 synthesis; opus not needed)
Output location: `sentinel-spec/00-plan-review.md` (overwrite v3 in place)
Status: pending
Time: spawned 23:20 →
Notes: No plan-approval gate (narrow targeted update, single file). v3 stays as reference until overwritten.

---

## 2026-05-12 — PHASE 1 CLOSED · PHASE 2 STARTED

User approved (terse "continue"): all 15 revisions + lead's default PRI calls:
- PRI-1 Q12: revise mechanism (3-pattern hybrid), keep principle
- PRI-2 Demo realism: accept "calibrated test sub" honest framing
- PRI-3 Scope governance: keep all 3 engines (deadline comfortable at 47d)
- PRI-4 Memory cold-start: accept "improves as ban history grows" framing

User instruction: phase Phase 2 in small waves due to token limitations. Wave plan:
- **Wave 2.1** (2 panes): 02-architecture + 07-onboarding (foundation, heaviest)
- **Wave 2.2** (3 panes): 03-raid-radar + 04-memory + 05-health-score (engines)
- **Wave 2.3** (4 panes): 06-dashboard + 08-build-plan + 09-demo-video + 10-app-listing
- **Wave 2.4** (1 pane): 00-architectural-summary (refresh after all)

Also: 16 shutdown_requests sent to Phase 1 teammates in parallel. Approvals arriving async.

---

## 2026-05-12 00:00 · Phase 2 Wave 2.1 · spec-editor-02-architecture

Brief: Apply all revisions in `00-plan-review.md` targeting `02-architecture.md`. Add `## Changelog` section at top citing each applied revision by ID. Plan-approval gated.
Model/Effort: sonnet / medium
Output location: `sentinel-spec/02-architecture.md` (edit in place)
Status: pending — plan-approval required
Time: spawned 00:00 →
Notes: mode=plan. Must submit edit list before applying.

## 2026-05-12 00:00 · Phase 2 Wave 2.1 · spec-editor-07-onboarding

Brief: Apply all revisions in `00-plan-review.md` targeting `07-onboarding-and-install.md` (primarily R-Bootstrap = 14d fetch → 3-pattern hybrid; Memory cold-start framing; calibration banner copy). Add `## Changelog` section. Plan-approval gated.
Model/Effort: sonnet / medium
Output location: `sentinel-spec/07-onboarding-and-install.md` (edit in place)
Status: pending — plan-approval required
Time: spawned 00:00 →
Notes: mode=plan.
