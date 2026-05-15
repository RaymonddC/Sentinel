# 11 · Ultraplan — Build-Schedule Master Plan

> The day-by-day execution plan from today (2026-05-14) to the hackathon deadline (2026-06-27).
> Synthesises `02`–`10` and `00-architectural-summary.md` into a dated schedule, a dependency
> graph, a file manifest, test scenarios, boilerplate, risks, and a Phase 5 spawn plan.
> This file does **not** reverse any decision in `01-product-decisions.md`. Where the build
> surfaces a conflict, it is raised as a Plan Review item for lead approval — never silently changed.

---

## 1. Schedule overview

**Runway:** 2026-05-14 (Thu) → 2026-06-27 (Sat). 44-day span, 45 calendar days inclusive
(Day 1 = today, Day 45 = Devpost submission day).

**Working-day assumption:** ~6 focused build hours/day, Monday–Friday. The 6 weekends
(12 days) are treated as **elastic buffer** — rest by default, available for catch-up if a
milestone slips. They are *not* counted in the milestone budget. This yields **32 working
days** in the runway.

**Spec estimate vs runway:** `08-build-plan.md` estimates Phase 0 + 8 milestones at
16–27 working days. The schedule below commits **28 working days** to milestones (the
high-confidence end of the estimate) and reserves **4 pure-buffer working days** (Days 41–44)
plus all 12 weekend days. Pure buffer = 4 / 32 working days = **12.5%**, inside the 10–15%
target; weekend elastic buffer is additional headroom.

**Buffer is reserved for** (in priority order): (1) integration debugging at engine
boundaries; (2) demo video recording retakes; (3) app-listing polish and screenshots;
(4) Devpost submission mechanics. If a milestone runs long, it spends the *adjacent
weekend* first, then eats into Days 41–44 last.

**Phase 0 gate:** Day 1 is the empirical spike. Milestone 1 parameter values (scheduler
chunk size, debounce TTL, `slowModeVelocityImpact` default) are **locked on Day 1's
results**. If a probe fails its pass/fail bar, the Day 2 plan adjusts before any
Foundation code is written.

**Scope governance (PRI-3):** the lead decides between options (a) all three engines,
(b) defer Memory to v1.1, (c) cut Health Score forecast — **before Milestone 4 begins
(Day 12)**. This plan is written for **option (a), the spec default**, because the runway
supports it. Check-in CP-3 (Day 9) is the explicit decision point.

---

## 2. Day-by-day schedule

> Working days carry full task detail. Weekend and pure-buffer days are intentionally
> compact. Every task cites its source spec section.

### Day 1 (2026-05-14, Thursday)
- **Focus:** Phase 0 — empirical spike. Retire runtime unknowns before Foundation begins.
- **Tasks:**
  - Stand up a throwaway Devvit project on a scratch sub for probing (`08-build-plan.md` § Phase 0).
  - **E-SchedulerTimeout** — one-off `runJob` with a CPU-bound loop (counter logged every 30 s) and an I/O-bound variant (tight Redis-write loop); record termination duration + error/silent-kill (`00-plan-review.md` § Empirical-test items).
  - **E-RedisThrottle** — write at 1K / 10K / 50K keys/sec for 60 s each; record success rate, p50/p95/p99 latency, error type, recovery time (`00-plan-review.md` § Empirical-test items).
  - **E-SlowMode** — enable slow mode on a scripted active thread; measure comments/min 30 min before vs after (`00-plan-review.md` § Empirical-test items).
  - Re-check `reddit/devvit-docs` scheduler/redis pages for any timeout numbers published since research/06 (`00-plan-review.md` § Devvit runtime evolution).
- **Expected output:** `sentinel-spec/research/09-runtime-probes.md` (new file, ~80–150 lines) with measured values + go/no-go calls.
- **Success criteria:** All 3 probes run; each scored against its pass/fail bar (timeout ≥5 min; ≥10 keys/sec sustained, p99 <500 ms; slow-mode reduction within ±20% of 0.70).
- **Dependencies:** None — this is the project's first action.
- **Parallelizable with:** Nothing (gates everything). The 3 probes themselves run sequentially on one scratch sub.

### Day 2 (2026-05-15, Friday)
- **Focus:** Milestone 1 — Foundation, part 1: project skeleton + statistical primitives.
- **Tasks:**
  - Devvit project skeleton: `devvit.yaml`, `package.json`, `tsconfig`, `main.ts` entry stub (`08-build-plan.md` M1; `02-architecture.md` § What's NOT in the architecture).
  - Type definitions: `SubBaseline`, `UserFingerprint`, `ThreadState`, `Alert`, `SubSettings` (`02-architecture.md` § The behavioral graph, § Settings).
  - Statistical primitives with tests: `RollingStat` (Welford-with-decay; `M_MAX_HOURLY=336`, `M_MAX_5MIN=4032`), `TimeSeries` (288-bucket ring), `Histogram` (pinned bucket schemas, histogram-intersection overlap, entropy) (`02-architecture.md` § Statistical primitives).
  - Lock M1 parameters from Day 1 probe results (scheduler chunk size, debounce TTL).
- **Expected output:** `src/types/*.ts`, `src/stats/{rolling-stat,time-series,histogram,math-utils}.ts` + colocated `*.test.ts`. Stats tests passing.
- **Success criteria:** `RollingStat.zScore` correct against a hand-computed fixture; `Histogram.overlap` returns 1.0 for identical, ~0 for disjoint; `TimeSeries` ring wraps at 288.
- **Dependencies:** Day 1 probe results (parameter lock).
- **Parallelizable with:** Type defs and stats primitives are independent — splittable across two teammates (see P-1).

### Day 3 (2026-05-16, Saturday) — *weekend, elastic buffer*
- **Focus:** Rest / optional catch-up. No scheduled work. Use only if Day 2 slipped.

### Day 4 (2026-05-17, Sunday) — *weekend, elastic buffer*
- **Focus:** Rest / optional catch-up. Lead prepares CP-2 agenda.

### Day 5 (2026-05-18, Monday)
- **Focus:** Milestone 1 — Foundation, part 2: storage layer + event ingestion.
- **Tasks:**
  - Redis key builders (`src/storage/keys.ts`) for every key in `02-architecture.md` § Devvit Redis schema.
  - Typed store modules: baseline / user / thread / settings / calibration, with JSON get/set helpers (`02-architecture.md` § The behavioral graph).
  - Event ingestion module: `ingestComment`, `ingestPost`, `ingestModAction`, `ingestReport` — single point of entry, updates graph records (`02-architecture.md` § Event ingestion).
  - KV compare-and-set debounce helper (`02-architecture.md` § Event ingestion — "Debouncing matters").
- **Expected output:** `src/storage/*.ts`, `src/ingestion/{ingest,debounce}.ts` + tests.
- **Success criteria:** A simulated `CommentSubmit` updates `ThreadState`, `UserFingerprint`, and `SubBaseline` in one pass; debounce skips a second event inside 5 s.
- **Dependencies:** Day 2 (types + stats primitives).
- **Parallelizable with:** Day 7–8 dashboard shell needs only the type defs — a UI teammate can start in parallel (P-2).

### Day 6 (2026-05-19, Tuesday)
- **Focus:** Milestone 1 — Foundation, part 3: triggers, bootstrap, settings defaults, welcome modal.
- **Tasks:**
  - Devvit trigger registration: `CommentSubmit`, `PostSubmit`, `ModAction`, `PostReport`/`CommentReport`, `AppInstall`, `AppUpgrade` → ingestion module (`02-architecture.md` § Triggers used).
  - Three-pattern bootstrap: P1 hot-1000 seed, P3 hourly progressive-backfill job scheduled, `bootstrapComplete` flag (`02-architecture.md` § Bootstrap; `07-onboarding-and-install.md` § Step 3).
  - Settings storage with first-install defaults (`02-architecture.md` § Settings — Defaults on first install).
  - Welcome modal (basic Devvit form, copy from `07-onboarding-and-install.md` § Step 2).
- **Expected output:** `src/ingestion/triggers.ts`, `src/bootstrap/bootstrap.ts`, `src/storage/settings-store.ts`, `src/ui/welcome-modal.ts`.
- **Success criteria:** Install on scratch sub → "Setup in progress" shows → debug log confirms events ingested → P1 completes <2 min / <50 API calls.
- **Dependencies:** Day 5 (ingestion + storage).
- **Parallelizable with:** Welcome modal is independent of triggers/bootstrap — splittable.
- **Milestone gate:** M1 "Demoable" line must pass before Day 7. **CP-2.**

### Day 7 (2026-05-20, Wednesday)
- **Focus:** Milestone 2 — Dashboard skeleton, part 1: custom post + tabs + KPIs.
- **Tasks:**
  - Custom post creation + pin on bootstrap completion; title `🛡️ Sentinel Dashboard — DO NOT REMOVE` (`06-dashboard-and-ui.md` § The pinned dashboard custom post).
  - Tab bar + router: Threats / Users / Threads / Activity Log / Settings (`06-dashboard-and-ui.md` § Layout).
  - KPI row: Active Threats, Threads Watched, Users Profiled, Time Saved Today — pulling live KV data (`06-dashboard-and-ui.md` § KPI tiles).
  - 30-s polling on dashboard open (`06-dashboard-and-ui.md` § What NOT to build — use polling).
- **Expected output:** `src/ui/dashboard.ts`, `src/ui/components/{kpi-row,tab-bar}.ts`.
- **Success criteria:** Dashboard post appears + pins; KPI tiles read real counts; tab switching works.
- **Dependencies:** Day 6 (bootstrap completion fires post creation; settings store for header state).
- **Parallelizable with:** Started Day 5 by a UI teammate against type stubs (P-2).

### Day 8 (2026-05-21, Thursday)
- **Focus:** Milestone 2 — Dashboard skeleton, part 2: settings UI + empty states + calibration banner.
- **Tasks:**
  - Settings tab: tiered UI — simple defaults visible, collapsible advanced panel (`06-dashboard-and-ui.md` § Tab: Settings; `01-product-decisions.md` Q7).
  - Reusable empty-state component for every tab ("No threats yet", etc.) (`08-build-plan.md` M2).
  - Calibration banner component — shows for first 7 days post-install (`07-onboarding-and-install.md` § Step 5).
- **Expected output:** `src/ui/components/{settings-tab,empty-state,calibration-banner}.ts`.
- **Success criteria:** Settings round-trip (change sensitivity → save → reload → persisted); advanced panel expands/collapses; empty states render on all 5 tabs.
- **Dependencies:** Day 7 (tab router); Day 6 (settings store).
- **Parallelizable with:** Empty-state + calibration banner are independent of settings tab.
- **Milestone gate:** M2 "Demoable" line must pass before Day 9.

### Day 9 (2026-05-22, Friday)
- **Focus:** Milestone 3 — Alert dispatcher + audit log. The spine is complete after today.
- **Tasks:**
  - `dispatchAlert()` — WATCH/MULTI/EXEC transaction for steps 1–3, idempotent steps 4–7, `dispatchState` crash-recovery (`02-architecture.md` § Alert dispatcher).
  - Alert store: `alerts:open` sorted-set-as-set, `alerts:by_target` hash-as-set (`02-architecture.md` § Devvit Redis schema).
  - `performModAction()` / `revertModAction()` with 24 h revert window + reversal metadata (`02-architecture.md` § Mod action API).
  - Audit log store: append-only, capped 1000, 30-day retention; Activity Log tab wired to it (`02-architecture.md` § Audit log; `06-dashboard-and-ui.md` § Tab: Activity Log).
  - Severity routing: dashboard vs modmail-on-critical (`02-architecture.md` § Severity routing).
- **Expected output:** `src/alerts/{dispatcher,severity}.ts`, `src/storage/{alert-store,audit-store}.ts`, `src/actions/mod-actions.ts`, `src/ui/components/activity-log-tab.ts`.
- **Success criteria:** Debug-inject a test alert → appears on Threats tab → click "false positive" → dismissed + logged; replay `dispatchAlert` with same alertId → no duplicate.
- **Dependencies:** Day 7–8 (dashboard tabs); Day 5 (storage helpers).
- **Parallelizable with:** Audit-log tab UI vs dispatcher logic — splittable.
- **Milestone gate:** M3 "Demoable" passes → **spine complete**. **CP-3 + PRI-3 scope decision.**

### Day 10 (2026-05-23, Saturday) — *weekend, elastic buffer*
- **Focus:** Rest. Reserved catch-up for M1–M3 if CP-3 flags slippage.

### Day 11 (2026-05-24, Sunday) — *weekend, elastic buffer*
- **Focus:** Rest. Lead confirms PRI-3 scope in writing before Day 12. Lead prepares M4 spawn brief.

### Day 12 (2026-05-25, Monday)
- **Focus:** Milestone 4 — Raid Radar, part 1: the four signals.
- **Tasks:**
  - Signal 1 — new-user influx z-score (`>4σ`) (`03-engine-raid-radar.md` § Signal 1).
  - Signal 2 — account-age clustering (median `<30 d` AND entropy `<0.5`) (`03-engine-raid-radar.md` § Signal 2).
  - Signal 3 — sub-overlap concentration (`>70%`), via `getCommentsAndPostsByUser({limit:100})` 100-item cap (`03-engine-raid-radar.md` § Signal 3).
  - Signal 4 — synchronized timing (`sync_score >0.85`) (`03-engine-raid-radar.md` § Signal 4).
- **Expected output:** `src/engines/raid-radar/signals.ts` + tests with fixture threads.
- **Success criteria:** Each signal returns 0–1 on hand-built fixtures; Signal 3 honours the 100-item cap.
- **Dependencies:** Day 6 (ingestion feeds thread/user records); Day 2 (stats primitives).
- **Parallelizable with:** Each of the 4 signals is independently testable — splittable across teammates (P-3).

### Day 13 (2026-05-26, Tuesday)
- **Focus:** Milestone 4 — Raid Radar, part 2: confidence + evaluation loop + alert generation.
- **Tasks:**
  - `calculateBrigadeConfidence()` — ≥2 signals required; 2→×0.7, 3→×0.85, 4→×1.0 (`03-engine-raid-radar.md` § Confidence calculation).
  - `evaluateThreadForBrigade()` — debounced (KV CAS), per-sensitivity thresholds, calibration-ramp conservatism (`03-engine-raid-radar.md` § Engine logic; `07-onboarding-and-install.md` § calibration ramp).
  - Alert generation → `dispatchAlert()`; severity critical if conf `>0.9` else high.
  - Wire evaluation into `ingestComment` and the every-5-min scheduled scan.
- **Expected output:** `src/engines/raid-radar/{confidence,evaluate}.ts` + tests.
- **Success criteria:** Hero-brigade fixture fires a critical alert; single-signal fixture fires nothing.
- **Dependencies:** Day 12 (signals); Day 9 (`dispatchAlert`).
- **Parallelizable with:** —

### Day 14 (2026-05-27, Wednesday)
- **Focus:** Milestone 4 — Raid Radar, part 3: cluster graph + signal breakdown UI.
- **Tasks:**
  - Cluster visualization — lazy-load on alert-detail open, ≤20 nodes + "+N more" badge, 320 px fixed-height container, alertId in-memory cache, ≤2 MB cache writes (`03-engine-raid-radar.md` § Cluster visualization; `06-dashboard-and-ui.md` § Cluster graph implementation constraints).
  - Signal breakdown panel (the `✓ New-user influx +717% z=6.2` block) (`03-engine-raid-radar.md` § Signal breakdown).
  - Threat overview header (red active / green all-clear) (`03-engine-raid-radar.md` § Threat overview).
- **Expected output:** `src/ui/components/{threats-tab,cluster-graph}.ts`.
- **Success criteria:** Open alert detail → graph renders ≤20 nodes; >20 accounts → "+N more" badge; no layout shift.
- **Dependencies:** Day 13 (alerts exist to render); Day 8 (Threats tab shell).
- **Parallelizable with:** Cluster graph vs signal-breakdown panel — splittable.

### Day 15 (2026-05-28, Thursday)
- **Focus:** Milestone 4 — Raid Radar, part 4: action buttons + auto-actions + false-positive loop.
- **Tasks:**
  - Action buttons: Lock thread / Slow mode / Filter new accts / Notify mod team / False positive (`03-engine-raid-radar.md` § Action buttons).
  - Auto-action handler — slow mode + new-account filter, gated on per-engine opt-in AND auto-action threshold, suppressed during 7-day ramp (`03-engine-raid-radar.md` § Engine logic; `02-architecture.md` § Mod action API).
  - False-positive feedback loop + per-sub threshold calibration (`03-engine-raid-radar.md` § False positive handling).
- **Expected output:** `src/actions/auto-actions.ts`, `src/calibration/calibration.ts` + tests.
- **Success criteria:** "Slow mode" button applies real slow mode + writes audit entry + shows Undo; false-positive click increments calibration counter.
- **Dependencies:** Day 9 (`performModAction`); Day 14 (alert UI).
- **Parallelizable with:** Calibration loop vs auto-action handler — splittable.

### Day 16 (2026-05-29, Friday)
- **Focus:** Milestone 4 — Raid Radar, part 5: end-to-end + capture demo footage.
- **Tasks:**
  - Run all 4 Raid Radar test scenarios on the scratch sub (`03-engine-raid-radar.md` § Test scenarios).
  - Tune for the 90-second detection target; verify edge cases (viral-but-legit, slow-burn) do not fire.
  - Capture raw demo footage of the hero brigade (most demo video frames originate here) (`08-build-plan.md` M4 note).
- **Expected output:** Raid Radar fully working end-to-end; raw screen recording archived.
- **Success criteria:** M4 "Demoable" line passes — alert fires within 90 s, cluster graph populates, slow mode applies.
- **Dependencies:** Days 12–15.
- **Parallelizable with:** —
- **Milestone gate:** M4 complete. **CP-5.**

### Day 17 (2026-05-30, Saturday) — *weekend, elastic buffer*
- **Focus:** Rest. Catch-up reserve for M4 if the 90-s target needed extra tuning.

### Day 18 (2026-05-31, Sunday) — *weekend, elastic buffer*
- **Focus:** Rest. Lead prepares M5 spawn brief.

### Day 19 (2026-06-01, Monday)
- **Focus:** Milestone 5 — Health Score, part 1: sentiment lexicon + signals.
- **Tasks:**
  - Sentiment module: AFINN-2015-en lexicon + 30-entry emoji extension table; token handling = case-fold → strip punctuation → tokenize → sum → ÷ token count → clamp [−1,+1]; neutral fallback 0 (`05-engine-health-score.md` § Signal 2 — Sentiment computation).
  - Signal 1 velocity z-score; Signal 3 new-account ratio; Signal 4 report-rate z-score (`05-engine-health-score.md` § The four signals).
  - Signal 2 sentiment swing (`first_30min_avg − last_30min_avg`, clamp ≥0).
- **Expected output:** `src/engines/health-score/{sentiment,signals}.ts` + tests.
- **Success criteria:** Sentiment scorer matches hand-scored sentences; each signal returns expected value on fixtures.
- **Dependencies:** Day 5 (ThreadState/baseline stores); Day 2 (stats).
- **Parallelizable with:** Sentiment lexicon is static data — can be prepared any time before Day 19 (P-4).

### Day 20 (2026-06-02, Tuesday)
- **Focus:** Milestone 5 — Health Score, part 2: risk score + trajectory amplifier.
- **Tasks:**
  - `calculateThreadRisk()` — weighted combination (0.30/0.25/0.20/0.25), sigmoid/clamp normalisation, trajectory amplifier `1 + min(slope, 0.3)` (`05-engine-health-score.md` § Risk score computation).
  - Risk levels + dashboard colour mapping (green/amber/orange/red) (`05-engine-health-score.md` § Risk levels).
- **Expected output:** `src/engines/health-score/risk.ts` + tests.
- **Success criteria:** Stable-50% thread scores lower than climbing-50% thread (amplifier verified).
- **Dependencies:** Day 19 (signals).
- **Parallelizable with:** —

### Day 21 (2026-06-03, Wednesday)
- **Focus:** Milestone 5 — Health Score, part 3: forecast + watched-thread management.
- **Tasks:**
  - `forecast()` — 1 h / 2 h linear extrapolation + `ifMitigated` using `slowModeVelocityImpact` (default 0.70, from Day 1 E-SlowMode result) (`05-engine-health-score.md` § Forecast generation).
  - Watched-thread set — auto-add threads with comments in last 6 h, manual pin, max 50 most-recent (`05-engine-health-score.md` § Watching scope).
  - Wire evaluation into `ingestComment`, report triggers, every-5-min scan.
- **Expected output:** `src/engines/health-score/{forecast,watch-set}.ts` + tests.
- **Success criteria:** Forecast produces lower mitigated curve; watch set caps at 50.
- **Dependencies:** Day 20 (risk score); Day 1 (E-SlowMode default).
- **Parallelizable with:** Forecast vs watch-set — splittable.

### Day 22 (2026-06-04, Thursday)
- **Focus:** Milestone 5 — Health Score, part 4: dashboard panel (triage queue, gauge, signals, forecast box).
- **Tasks:**
  - Triage queue — all watched threads sorted by risk, colour-coded (`05-engine-health-score.md` § Section A).
  - Selected-thread detail — risk gauge, trajectory chart, signal bars, forecast box, action buttons (`05-engine-health-score.md` § Section B).
  - Calibration health section — accuracy, false-positive rate, avg early warning (`05-engine-health-score.md` § Section C).
- **Expected output:** `src/ui/components/threads-tab.ts`.
- **Success criteria:** Triage queue renders + sorts; clicking a thread shows gauge + forecast.
- **Dependencies:** Day 21 (forecast + watch set); Day 8 (Threads tab shell).
- **Parallelizable with:** Triage queue vs detail panel — splittable.

### Day 23 (2026-06-05, Friday)
- **Focus:** Milestone 5 — Health Score, part 5: end-to-end + false-positive loop + capture footage.
- **Tasks:**
  - Negative-feedback loop — "actually was a problem" on non-alerted threads (`05-engine-health-score.md` § False positive handling).
  - Run the escalating-thread test scenario; verify edge cases (megathread exempt, slow-burn drama) (`05-engine-health-score.md` § Edge cases).
  - Capture Health Score timelapse footage for the demo.
- **Expected output:** Health Score working end-to-end; raw timelapse recording archived.
- **Success criteria:** M5 "Demoable" passes — risk climbs 22%→89%, forecast shifts after slow mode.
- **Dependencies:** Days 19–22.
- **Parallelizable with:** —
- **Milestone gate:** M5 complete. **CP-6.**

### Day 24 (2026-06-06, Saturday) — *weekend, elastic buffer*
- **Focus:** Rest. Catch-up reserve for M5.

### Day 25 (2026-06-07, Sunday) — *weekend, elastic buffer*
- **Focus:** Rest. Lead prepares M6 spawn brief (Memory is the long pole — brief carefully).

### Day 26 (2026-06-08, Monday)
- **Focus:** Milestone 6 — Memory, part 1: behavioral fingerprint.
- **Tasks:**
  - `BehavioralProfile` build — posting-time histogram (24 buckets), comment-length histogram (5 buckets), posting frequency, sub overlap (last-100 cross-sub), weekday/weekend (`04-engine-memory.md` § Signal A).
  - `behavioralSimilarity()` — histogram intersection + Jaccard + frequency delta, weighted 0.30/0.20/0.35/0.15 (`04-engine-memory.md` § Signal A).
- **Expected output:** `src/engines/memory/behavioral.ts` + tests.
- **Success criteria:** Identical profiles → ~1.0; disjoint → low; honours 100-item sub-overlap cap.
- **Dependencies:** Day 5 (UserFingerprint store); Day 2 (Histogram).
- **Parallelizable with:** Behavioral vs stylometry (Day 27) — splittable across two teammates (P-5).

### Day 27 (2026-06-09, Tuesday)
- **Focus:** Milestone 6 — Memory, part 2: stylometry fingerprint (the heaviest piece).
- **Tasks:**
  - `StylometryProfile` build — sentence length, punctuation profile, capitalization, emoji usage, top-50 trigrams, vocabulary `Map<string,number>` capped top-2000 (`04-engine-memory.md` § Signal B).
  - Trigram preprocessing — lowercase → collapse whitespace → strip edges → overlapping 3-char windows (`04-engine-memory.md` § Signal B).
  - `stylometrySimilarity()` — L2-normalized cosine on numeric vector + Jaccard on trigrams + emoji histogram intersection, weighted 0.30/0.55/0.15.
- **Expected output:** `src/engines/memory/stylometry.ts` + tests.
- **Success criteria:** Trigram preprocessing matches spec on fixtures; vocab map drops lowest-freq 500 at 2500 entries; cosine uses L2-normalized vectors.
- **Dependencies:** Day 5 (UserFingerprint); Day 2 (math-utils cosine/jaccard).
- **Parallelizable with:** Behavioral (Day 26) — see P-5.

### Day 28 (2026-06-10, Wednesday)
- **Focus:** Milestone 6 — Memory, part 3: combined match logic + banned-user index.
- **Tasks:**
  - `isLikelyEvader()` — 3 guards (age <12 mo, ≥10 comments, both signals over floor), combined `0.4×beh + 0.6×style > 0.78` (`04-engine-memory.md` § Combined match logic).
  - Banned-user index — `banned:{userId}` per-user keys + `banned_ids` sorted set; new bans written via WATCH/MULTI/EXEC (`04-engine-memory.md` § Banned-user index).
  - Cold-start behavior — empty-index UX message; configurable ≥10-comment gate (`04-engine-memory.md` § Cold-start behavior).
- **Expected output:** `src/engines/memory/evader.ts`, `src/storage/banned-index.ts` + tests.
- **Success criteria:** Dual-signal guard rejects single-signal matches; banned-index write stays one-key-per-user (no oversize write).
- **Dependencies:** Days 26–27 (both fingerprints).
- **Parallelizable with:** Banned-index storage vs evader logic — splittable.

### Day 29 (2026-06-11, Thursday)
- **Focus:** Milestone 6 — Memory, part 4: scan jobs + Mod Notes integration.
- **Tasks:**
  - New-user scan against banned index on first comment; every-6-h re-scan job (`04-engine-memory.md` § When Memory runs).
  - Optional Mod Notes integration — `addModNote` on ban, `getModNotes({filter:'BAN'})` cold-start seed, settings toggle (default yes) (`04-engine-memory.md` § Optional Mod Notes integration).
  - Wire Memory evaluation into `ingestComment` + `ingestModAction`.
- **Expected output:** `src/engines/memory/scan.ts`, Mod Notes calls in `src/ingestion/ingest.ts`.
- **Success criteria:** New account matching a banned fingerprint is flagged within one scan cycle; Mod Note written on ban when toggle on.
- **Dependencies:** Day 28 (evader logic + banned index).
- **Parallelizable with:** Mod Notes integration vs scan jobs — splittable.

### Day 30 (2026-06-12, Friday)
- **Focus:** Milestone 6 — Memory, part 5: User Spotlight + side-by-side + mod menu items.
- **Tasks:**
  - User Spotlight panel — confidence range, reason breakdown, "possible match" framing only (`04-engine-memory.md` § What Memory shows the mod).
  - Side-by-side comparison view — banned vs suspect, rendered from real data (`04-engine-memory.md` § Side-by-side view).
  - Mod menu items — "Open in Sentinel" / "Run evader check" on user, "Check author" on comment, Health Score items on post (`06-dashboard-and-ui.md` § Mod menu items).
- **Expected output:** `src/ui/components/{users-tab,side-by-side}.ts`, `src/ui/menu-items.ts`.
- **Success criteria:** Spotlight never says "is the banned user"; side-by-side renders both fingerprints; menu items open the right panel.
- **Dependencies:** Day 29 (scan produces matches); Day 8 (Users tab shell).
- **Parallelizable with:** Side-by-side vs menu items — splittable.

### Day 31 (2026-06-13, Saturday) — *weekend, elastic buffer*
- **Focus:** Rest. Catch-up reserve for M6 (longest milestone — most likely to need it).

### Day 32 (2026-06-14, Sunday) — *weekend, elastic buffer*
- **Focus:** Rest.

### Day 33 (2026-06-15, Monday)
- **Focus:** Milestone 6 — Memory, part 6: end-to-end + capture footage.
- **Tasks:**
  - Run the ban-evader test scenario (banned alt → fresh alt, same style) (`04-engine-memory.md` § Demo scenario).
  - Verify edge cases — image-only/short comments skip stylometry, two-similar-users no false positive, exempt-users list (`04-engine-memory.md` § Edge cases).
  - Capture the Memory side-by-side "smoking gun" footage.
- **Expected output:** Memory working end-to-end; raw recording archived.
- **Success criteria:** M6 "Demoable" passes — evader flagged within an hour, side-by-side lands.
- **Dependencies:** Days 26–30.
- **Parallelizable with:** —
- **Milestone gate:** M6 complete — **all three engines done. CP-8.**

### Day 34 (2026-06-16, Tuesday)
- **Focus:** Milestone 7 — Polish, part 1: performance budgets + stress test.
- **Tasks:**
  - Verify per-engine performance budgets (Raid Radar <100 ms, Health Score <50 ms, Memory scan <500 ms) (`03`/`04`/`05` § Performance budget).
  - Storage stress test — 10K fingerprints + 50 threads + 1000 alerts; confirm under 500 MB quota (`08-build-plan.md` § Risk register — "Storage limits hit").
  - **E-DOM-Count** — cumulative dashboard DOM under peak (50 watched threads + open alerts) (`00-architectural-summary.md` Open Question 4).
- **Expected output:** Performance test results logged; any fingerprint-caching fixes applied.
- **Success criteria:** All budgets met; storage bounded; DOM under Lighthouse concern threshold.
- **Dependencies:** Days 16, 23, 33 (all engines complete).
- **Parallelizable with:** Stress test vs DOM measurement — splittable.

### Day 35 (2026-06-17, Wednesday)
- **Focus:** Milestone 7 — Polish, part 2: settings round-trips + edge-case sweep.
- **Tasks:**
  - Settings save/load round-trip; auto-action opt-in respected; quiet hours respected; exempt users/flairs respected (`08-build-plan.md` M7; `02-architecture.md` § Settings).
  - Error handling on Devvit API failures — retries, graceful degradation (`08-build-plan.md` M7).
  - Calibration banner correctness during first 7 days (`07-onboarding-and-install.md` § Step 5).
- **Expected output:** Edge-case fixes across stores + engines.
- **Success criteria:** Every M7 checkbox in `08-build-plan.md` verified.
- **Dependencies:** Day 34.
- **Parallelizable with:** Settings vs error-handling — splittable.

### Day 36 (2026-06-18, Thursday)
- **Focus:** Milestone 7 — Polish, part 3: mobile layout + visual polish.
- **Tasks:**
  - All UI interactions on mobile viewport — single-column collapse (`06-dashboard-and-ui.md` § Mobile considerations).
  - Visual polish pass — severity colours, spacing, restrained animation, tabular numerics (`06-dashboard-and-ui.md` § Visual style).
  - Accessibility — keyboard nav, screen-reader labels, colour-never-only-signal, WCAG AA contrast (`06-dashboard-and-ui.md` § Accessibility).
- **Expected output:** Polished, mobile-correct dashboard.
- **Success criteria:** M7 "Demoable" — production-ready feel, works under stress.
- **Dependencies:** Day 35.
- **Parallelizable with:** —
- **Milestone gate:** M7 complete. **CP-9.**

### Day 37 (2026-06-19, Friday)
- **Focus:** Milestone 8 — Demo prep, part 1: test sub + scenarios + video.
- **Tasks:**
  - Set up `r/SentinelDemo` (<200 members); execute the pre-seeding checklist — 8 alts, Memory banned-index seed, ThreadState injection, High Sensitivity config (`09-demo-video-script.md` § Pre-demo checklist).
  - Make all test scenarios scripted + runnable on demand (`08-build-plan.md` M8).
  - Edit the demo video per `09-demo-video-script.md` shot list (≤60 s, captions, honest-framing description text).
- **Expected output:** Test sub live; demo video draft cut.
- **Success criteria:** Video ≤60 s; honest-framing paragraph included verbatim.
- **Dependencies:** Days 16, 23, 33 (footage captured); Day 36 (polished UI).
- **Parallelizable with:** Test-sub setup vs video editing — splittable.

### Day 38 (2026-06-20, Saturday) — *weekend, elastic buffer*
- **Focus:** Rest. Catch-up reserve for video retakes.

### Day 39 (2026-06-21, Sunday) — *weekend, elastic buffer*
- **Focus:** Rest.

### Day 40 (2026-06-22, Monday)
- **Focus:** Milestone 8 — Demo prep, part 2: app listing + screenshots + Devpost.
- **Tasks:**
  - App listing copy per `10-app-listing.md` (name, tagline, description, Tool Overview, Project Impact).
  - 6 screenshots in priority order — hero cluster graph first (`10-app-listing.md` § Screenshots).
  - Public demo post in the <200-member sub; fill Devpost form fields; finalise video upload (captions, thumbnail).
- **Expected output:** Complete app listing; Devpost draft filled.
- **Success criteria:** M8 "Demoable" — submission-ready; `10-app-listing.md` pre-launch checklist green.
- **Dependencies:** Day 37 (test sub + video).
- **Parallelizable with:** Screenshots vs listing copy — splittable.
- **Milestone gate:** M8 complete. **CP-10 — submission-ready with 5 days to spare.**

### Day 41 (2026-06-23, Tuesday) — *pure buffer*
- **Focus:** Buffer 1/4 — integration debugging at engine boundaries; absorb any milestone overrun.

### Day 42 (2026-06-24, Wednesday) — *pure buffer*
- **Focus:** Buffer 2/4 — demo video retakes; app-listing polish.

### Day 43 (2026-06-25, Thursday) — *pure buffer*
- **Focus:** Buffer 3/4 — final QA pass on the scratch + demo subs; screenshot re-shoots.

### Day 44 (2026-06-26, Friday) — *pure buffer*
- **Focus:** Buffer 4/4 — Devpost dry-run; verify video public + ≤60 s + captioned; freeze the build (no breaking changes during judging).

### Day 45 (2026-06-27, Saturday) — *deadline*
- **Focus:** Devpost submission.
- **Tasks:** Final submit of Devpost form; confirm video URL public; confirm app listing live; confirm public demo post visible. Submit with margin — do not wait for the deadline hour.
- **Success criteria:** Submission confirmed received.
- **Dependencies:** Day 40 (everything submission-ready); Days 41–44 (buffer absorbed any slip).

---

## 3. Milestone-to-day mapping

| Milestone | Spec source | Day range | Working days | Calendar dates |
|---|---|---|---|---|
| **Phase 0** — Empirical spike | `08-build-plan.md` § Phase 0 | Day 1 | 1 | Thu May 14 |
| **M1** — Foundation | `08-build-plan.md` M1 | Days 2, 5–6 | 3 | Fri May 15; Mon–Tue May 18–19 |
| **M2** — Dashboard skeleton | `08-build-plan.md` M2 | Days 7–8 | 2 | Wed–Thu May 20–21 |
| **M3** — Alert dispatcher + audit log | `08-build-plan.md` M3 | Day 9 | 1 | Fri May 22 |
| **M4** — Raid Radar | `08-build-plan.md` M4 | Days 12–16 | 5 | Mon–Fri May 25–29 |
| **M5** — Health Score | `08-build-plan.md` M5 | Days 19–23 | 5 | Mon–Fri Jun 1–5 |
| **M6** — Memory engine | `08-build-plan.md` M6 | Days 26–30, 33 | 6 | Mon–Fri Jun 8–12; Mon Jun 15 |
| **M7** — Polish + edge cases | `08-build-plan.md` M7 | Days 34–36 | 3 | Tue–Thu Jun 16–18 |
| **M8** — Demo prep | `08-build-plan.md` M8 | Days 37, 40 | 2 | Fri Jun 19; Mon Jun 22 |
| **Pure buffer** | this plan § 6 | Days 41–44 | 4 | Tue–Fri Jun 23–26 |
| **Submission** | — | Day 45 | — | Sat Jun 27 |

**Weekends (elastic buffer, not budgeted):** Days 3–4, 10–11, 17–18, 24–25, 31–32, 38–39.

Total: 28 working days on milestones + 4 pure-buffer working days + 12 weekend elastic-buffer days + submission day. The spec's high estimate (27 working days incl. Phase 0) fits inside the 28 committed, with the 4 pure-buffer days and 12 weekend days as overrun protection.

---

## 4. Dependency graph

```
Phase 0 (Day 1)
   │  (locks scheduler chunk, debounce TTL, slowModeVelocityImpact)
   ▼
M1 Foundation (Days 2,5,6)
   │  types ─► stats ─► storage ─► ingestion ─► triggers + bootstrap + settings
   ├───────────────► M2 Dashboard skeleton (Days 7,8)   [needs types + bootstrap + settings]
   │                       │
   ▼                       ▼
M3 Alert dispatcher (Day 9) ◄── needs storage + dashboard tabs
   │  dispatchAlert ─► performModAction/revert ─► audit log ─► Activity tab
   │
   ├──────────────► M4 Raid Radar (Days 12–16)   [needs ingestion + dispatchAlert + Threats tab]
   │
   ├──────────────► M5 Health Score (Days 19–23) [needs ingestion + dispatchAlert + Threads tab]
   │
   └──────────────► M6 Memory (Days 26–30,33)    [needs ingestion + UserFingerprint + Users tab + ModAction]
                            │
   M4 + M5 + M6 ────────────┴──► M7 Polish (Days 34–36)  [needs all engines + all UI]
                                      │
                                      ▼
                                M8 Demo prep (Days 37,40) [needs polished build + captured footage]
                                      │
                                      ▼
                                Submission (Day 45)
```

**Critical path:** `Phase 0 → M1 Foundation → M3 Alert dispatcher → M4 Raid Radar → M6 Memory → M7 Polish → M8 Demo prep → Submission`.

M6 Memory is the long pole (6 working days, the largest milestone) and is gated last among
the engines, so it dominates the back half of the critical path. M2 and M5 are *not* on the
critical path — M2 overlaps M1's tail, and M5 could run concurrently with M6 given a second
engine teammate (see § 5). Phase 0 is critical because its results lock M1's parameters.

**Blocking table:**

| Task | Blocked by | Blocks |
|---|---|---|
| M1 Foundation | Phase 0 (parameter lock) | M2, M3, all engines |
| M2 Dashboard skeleton | M1 types + bootstrap + settings | engine UI panels (M4/M5/M6) |
| M3 Alert dispatcher | M1 storage; M2 tabs | M4/M5/M6 alert generation; mod actions |
| M4 Raid Radar | M1 ingestion; M3 dispatchAlert; M2 Threats tab | demo footage; M7 |
| M5 Health Score | M1 ingestion; M3 dispatchAlert; M2 Threads tab | demo footage; M7 |
| M6 Memory | M1 UserFingerprint + ModAction ingest; M3; M2 Users tab | demo footage; M7 |
| M7 Polish | M4 + M5 + M6 | M8 |
| M8 Demo prep | M7; footage captured Days 16/23/33 | Submission |

---

## 5. Parallel-work opportunities

Each tag is a place where two teammates can build concurrently without blocking each other.

| Tag | Window | Stream A | Stream B | Notes |
|---|---|---|---|---|
| **P-1** | Day 2 | Type definitions (`src/types/*`) | Statistical primitives (`src/stats/*`) | Stats depend only on plain numbers, not on the graph types. |
| **P-2** | Days 5–7 | Foundation: storage + ingestion + triggers | Dashboard shell: custom post, tab bar, KPI row | UI teammate works against type stubs from P-1; integrates when bootstrap lands Day 6. |
| **P-3** | Day 12 | Raid Radar Signals 1 + 2 | Raid Radar Signals 3 + 4 | Four pure functions, independently testable against fixtures. |
| **P-4** | Anytime before Day 19 | AFINN-2015-en lexicon + emoji table (static data file) | — | Lexicon is static content; can be assembled during M1–M4 idle capacity. |
| **P-5** | Days 26–27 | Memory behavioral fingerprint | Memory stylometry fingerprint | The two signals are independent until `isLikelyEvader` combines them on Day 28. |
| **P-6** | Days 19–33 | M5 Health Score (engine teammate A) | M6 Memory (engine teammate B) | **Highest-leverage parallelization.** With two engine teammates, M5 and M6 overlap — both depend only on the spine (M1+M3), not on each other. Compresses the critical path by up to ~5 working days, converting them to additional buffer. |
| **P-7** | Within M4/M5/M6 | Engine logic | Engine dashboard panel | Each milestone's UI panel can be built alongside its engine logic once the alert/data shape is fixed. |
| **P-8** | Days 37, 40 | Test-sub setup + demo video edit | App-listing copy + screenshots | Independent deliverables within M8. |

---

## 6. Buffer days

**Pure-buffer working days (4):** Days 41–44 (Tue–Fri Jun 23–26). These are unscheduled by
design — reserved, in priority order, for: (1) integration debugging at engine boundaries;
(2) demo video retakes; (3) app-listing polish + screenshot re-shoots; (4) Devpost
submission dry-run + build freeze.

**Pure buffer = 4 / 32 working days = 12.5%** — inside the 10–15% target.

**Weekend elastic buffer (12 days, not budgeted):** Days 3–4, 10–11, 17–18, 24–25, 31–32,
38–39. Default state is rest. A milestone that runs long spends its *adjacent weekend*
before touching Days 41–44, so most slippage never reaches the pure-buffer block.

**Slippage policy:** if M4 or M6 (the two largest milestones) overruns by ≤2 days, absorb it
into the following weekend. If overrun exceeds 2 days on any single milestone, the lead
triggers the PRI-3 scope conversation again — option (c) (cut Health Score forecast,
reclaims 1–2 days) is the lowest-regret cut, then option (b) (defer Memory to v1.1). The
buffer math means a cut should not be needed unless two milestones each overrun materially.

---

## 7. Daily check-in points (lead ↔ user)

Check-ins are scheduled at milestone gates and roughly every 3 working days.

| ID | Day (date) | Trigger | Review agenda |
|---|---|---|---|
| **CP-1** | Day 1 EOD (Thu May 14) | Phase 0 complete | Probe results in `research/09-runtime-probes.md`; go/no-go on M1 parameter values; any probe failure → M1 plan adjustment. |
| **CP-2** | Day 6 EOD (Tue May 19) | M1 gate | Install works, events ingest, P1 bootstrap <2 min. Confirm storage schema as built matches `02-architecture.md`. |
| **CP-3** | Day 9 EOD (Fri May 22) | M3 gate — **spine complete** | Test alert dispatches + reverts. **PRI-3 scope decision due** — lead confirms option (a)/(b)/(c) in writing before Day 12. |
| **CP-4** | Day 14 EOD (Wed May 27) | M4 mid-point | All 4 Raid Radar signals + confidence working; cluster graph rendering. Tuning risk check on the 90-s target. |
| **CP-5** | Day 16 EOD (Fri May 29) | M4 gate | Hero brigade fires <90 s; demo footage captured; 4 test scenarios pass. |
| **CP-6** | Day 23 EOD (Fri Jun 5) | M5 gate | Risk climbs correctly; forecast shifts with mitigation; timelapse footage captured. |
| **CP-7** | Day 28 EOD (Wed Jun 10) | M6 mid-point | Both fingerprints + combined match logic + banned-index working. Stylometry false-positive risk check. |
| **CP-8** | Day 33 EOD (Mon Jun 15) | M6 gate — **all engines done** | Evader scenario lands; side-by-side footage captured. Confirm buffer position vs schedule. |
| **CP-9** | Day 36 EOD (Thu Jun 18) | M7 gate | Performance budgets met; storage stress test green; mobile + accessibility verified. |
| **CP-10** | Day 40 EOD (Mon Jun 22) | M8 gate — **submission-ready** | Video ≤60 s + captioned; app listing complete; Devpost draft filled. 5 days of buffer remain. |
| **CP-11** | Day 44 EOD (Fri Jun 26) | Pre-submission | Build frozen; Devpost dry-run done; everything public and verified. Green-light Day 45 submit. |

---

## 8. File structure

TypeScript source in dependency order (top = built first). Each file: 1-line purpose +
day created. Tests are colocated (`*.test.ts`) and written the same day as their module.

```
Sentinel/
├── devvit.yaml                              # Devvit app manifest                              [Day 2]
├── package.json / tsconfig.json             # Project + TS config                              [Day 2]
├── src/
│   ├── main.ts                              # App entry: registers triggers, custom post,
│   │                                        #   menu items, scheduler jobs                     [Day 2, grows through M6]
│   ├── types/
│   │   ├── graph.ts                         # SubBaseline, UserFingerprint, ThreadState,
│   │   │                                    #   Alert, ModActionRecord, CommentSample          [Day 2]
│   │   ├── settings.ts                      # SubSettings, EngineSettings, PerSignalThresholds  [Day 2]
│   │   └── signals.ts                       # SignalSnapshot + per-engine signal result types  [Day 2]
│   ├── stats/
│   │   ├── math-utils.ts                    # sigmoid, clamp, mean, median, stddev,
│   │   │                                    #   cosineSimilarity, l2Normalize, jaccard         [Day 2]
│   │   ├── rolling-stat.ts                  # RollingStat — Welford+decay, M_MAX constants      [Day 2]
│   │   ├── time-series.ts                   # TimeSeries — 288-bucket 5-min ring buffer         [Day 2]
│   │   └── histogram.ts                     # Histogram — pinned buckets, intersection, entropy [Day 2]
│   ├── storage/
│   │   ├── keys.ts                          # Namespaced sentinel:* key builders                [Day 5]
│   │   ├── redis-client.ts                  # Typed JSON get/set, WATCH/MULTI/EXEC wrapper, CAS  [Day 5]
│   │   ├── baseline-store.ts                # Load/save SubBaseline                             [Day 5]
│   │   ├── user-store.ts                    # Load/save UserFingerprint, FIFO recentComments    [Day 5]
│   │   ├── thread-store.ts                  # Load/save ThreadState                             [Day 5]
│   │   ├── settings-store.ts                # Load/save SubSettings with install defaults       [Day 6]
│   │   ├── calibration-store.ts             # Dismissal counts per signal type                  [Day 9]
│   │   ├── alert-store.ts                   # Alert persistence; alerts:open SS; by_target hash [Day 9]
│   │   ├── audit-store.ts                   # Append-only audit log, cap 1000, 30-day GC        [Day 9]
│   │   └── banned-index.ts                  # banned:{userId} keys + banned_ids sorted set      [Day 28]
│   ├── ingestion/
│   │   ├── debounce.ts                      # KV compare-and-set debounce helper                [Day 5]
│   │   ├── ingest.ts                        # ingestComment/Post/ModAction/Report               [Day 5, grows M4–M6]
│   │   └── triggers.ts                      # Devvit trigger handler registration               [Day 6]
│   ├── bootstrap/
│   │   └── bootstrap.ts                     # P1 hot-list seed + P3 progressive backfill        [Day 6]
│   ├── alerts/
│   │   ├── severity.ts                      # Severity routing helpers                          [Day 9]
│   │   └── dispatcher.ts                    # dispatchAlert — WATCH/MULTI/EXEC + 7-step replay   [Day 9]
│   ├── actions/
│   │   ├── mod-actions.ts                   # performModAction / revertModAction (24h window)   [Day 9]
│   │   └── auto-actions.ts                  # Opt-in slow-mode / new-account-filter gating      [Day 15]
│   ├── calibration/
│   │   └── calibration.ts                   # False-positive loop, per-sub threshold nudging    [Day 15]
│   ├── engines/
│   │   ├── raid-radar/
│   │   │   ├── signals.ts                   # influx / age-cluster / sub-overlap / sync timing  [Day 12]
│   │   │   ├── confidence.ts                # calculateBrigadeConfidence (≥2-signal gate)       [Day 13]
│   │   │   └── evaluate.ts                  # evaluateThreadForBrigade (debounced)              [Day 13]
│   │   ├── health-score/
│   │   │   ├── sentiment.ts                 # AFINN-2015-en + emoji table + token scoring       [Day 19]
│   │   │   ├── signals.ts                   # velocity / sentiment swing / new-acct / reports   [Day 19]
│   │   │   ├── risk.ts                      # calculateThreadRisk + trajectory amplifier        [Day 20]
│   │   │   ├── forecast.ts                  # forecast() 1h/2h/ifMitigated                      [Day 21]
│   │   │   └── watch-set.ts                 # Watched-thread management (max 50)                [Day 21]
│   │   └── memory/
│   │       ├── behavioral.ts                # BehavioralProfile + behavioralSimilarity          [Day 26]
│   │       ├── stylometry.ts                # StylometryProfile + trigrams + stylometrySim      [Day 27]
│   │       ├── evader.ts                    # isLikelyEvader — 3 guards + combined score        [Day 28]
│   │       └── scan.ts                      # New-user scan + every-6h re-scan job              [Day 29]
│   ├── scheduler/
│   │   └── jobs.ts                          # daily purge, hourly rollup, every-5m refresh,
│   │                                        #   every-6h GC, P3 backfill, 6h evader rescan      [Day 6, grows M4–M6]
│   ├── ui/
│   │   ├── dashboard.ts                     # Custom post root, tab router, 30s polling         [Day 7]
│   │   ├── welcome-modal.ts                 # Install welcome form                              [Day 6]
│   │   ├── menu-items.ts                    # Post / user / comment mod menu items              [Day 30]
│   │   └── components/
│   │       ├── kpi-row.ts                   # 4 KPI tiles                                       [Day 7]
│   │       ├── tab-bar.ts                   # Tab bar + active-tab state                        [Day 7]
│   │       ├── empty-state.ts               # Reusable empty-state fallback                     [Day 8]
│   │       ├── calibration-banner.ts        # First-7-days "still learning" banner              [Day 8]
│   │       ├── settings-tab.ts              # Tiered settings UI (simple + advanced)            [Day 8]
│   │       ├── activity-log-tab.ts          # Audit log feed + Undo buttons                     [Day 9]
│   │       ├── threats-tab.ts               # Raid Radar alert cards + threat header            [Day 14]
│   │       ├── cluster-graph.ts             # Lazy-load ≤20-node SVG, 320px fixed height        [Day 14]
│   │       ├── threads-tab.ts               # Health Score triage queue, gauge, forecast box    [Day 22]
│   │       ├── users-tab.ts                 # Memory User Spotlight + search                    [Day 30]
│   │       └── side-by-side.ts              # Memory banned-vs-suspect comparison view          [Day 30]
│   └── debug/
│       └── debug-commands.ts                # Test-alert injection, scenario triggers,
│                                            #   ThreadState injection for demo                  [Day 9, grows through M6]
└── sentinel-spec/research/
    └── 09-runtime-probes.md                 # Phase 0 empirical-spike results                   [Day 1]
```

**File-creation count specified: 51** (50 `src/*` TypeScript files + `research/09-runtime-probes.md`),
plus `devvit.yaml` / `package.json` / `tsconfig.json` project config and ~45 colocated `*.test.ts`.

---

## 9. Test scenarios per milestone

Pass/fail criteria are verifiable. Each milestone is "done" only when its scenarios pass
(per `08-build-plan.md` § Per-milestone definition of done).

### Phase 0
1. **E-SchedulerTimeout** — run a one-off job CPU + I/O loop. *Pass:* termination ≥5 min. *Fail:* <5 min → P3 backfill chunks smaller.
2. **E-RedisThrottle** — write 1K/10K/50K keys/sec for 60 s each. *Pass:* ≥10 keys/sec sustained, p99 <500 ms. *Fail:* lower → debounce widens to 10 s.
3. **E-SlowMode** — measure comments/min 30 min pre/post slow mode. *Pass:* reduction within ±20% of 0.70. *Fail:* outside → update `slowModeVelocityImpact` default.

### M1 — Foundation
1. **Ingestion correctness** — simulate `CommentSubmit`. *Pass:* `ThreadState`, `UserFingerprint`, `SubBaseline` all updated in one pass.
2. **Debounce** — fire two events 2 s apart on one thread. *Pass:* second skipped.
3. **Stats primitives** — `RollingStat.zScore`, `Histogram.overlap`, `TimeSeries` wrap. *Pass:* match hand-computed fixtures.
4. **Bootstrap P1** — install on scratch sub. *Pass:* completes <2 min, <50 API calls, `bootstrapComplete` flips.

### M2 — Dashboard skeleton
1. **Post creation** — bootstrap completes. *Pass:* dashboard post created + pinned, correct title.
2. **Live KPIs** — populate KV with N users / M threads. *Pass:* tiles show N and M.
3. **Tab switching** — click each of 5 tabs. *Pass:* correct content, empty states on unpopulated tabs.
4. **Settings round-trip** — change sensitivity → save → reload. *Pass:* value persisted; advanced panel collapses.

### M3 — Alert dispatcher + audit log
1. **Dispatch** — debug-inject a critical alert. *Pass:* appears on Threats tab + modmail sent.
2. **Idempotent replay** — call `dispatchAlert` twice with same alertId. *Pass:* no duplicate in `alerts:open`.
3. **Mod action + revert** — `performModAction` then `revertModAction` inside 24 h. *Pass:* action applied then inverted; audit entries correct.
4. **Audit cap** — append 1100 entries. *Pass:* list capped at 1000.

### M4 — Raid Radar
1. **Hero brigade** — 8 alts in 60 s from one fake external sub. *Pass:* critical alert within 90 s.
2. **Slow burn** — 1 alt every few minutes for 30 min. *Pass:* no alert.
3. **Viral but legit** — 8 diverse natural-style accounts. *Pass:* no alert (Signals 2 + 3 stay low).
4. **Half-brigade** — 5 new accounts, no sub overlap. *Pass:* MEDIUM, not CRITICAL. Cluster graph caps at ≤20 nodes.

### M5 — Health Score
1. **Escalating thread** — staggered confrontational comments over 30 min. *Pass:* risk climbs 22%→~89%.
2. **Forecast** — check `forecast()` output. *Pass:* `ifMitigated` curve below unmitigated.
3. **Megathread exempt** — add a high-velocity thread to exempt list. *Pass:* skipped by Health Score.
4. **Calibration stats** — Section C. *Pass:* accuracy + false-positive rate render real numbers.

### M6 — Memory
1. **Ban evader** — banned alt → fresh alt, same style. *Pass:* flagged within one scan cycle.
2. **Dual-signal guard** — two real users with similar style but different behavior. *Pass:* no match (single-signal rejected).
3. **Cold-start** — fresh install, no bans. *Pass:* Spotlight shows "No ban history yet" message.
4. **Banned-index scale** — write 5,000 banned fingerprints. *Pass:* per-user keys, no write exceeds 5 MB; side-by-side renders.

### M7 — Polish
1. **Storage stress** — 10K fingerprints + 50 threads + 1000 alerts. *Pass:* under 500 MB.
2. **Performance budgets** — measure eval times. *Pass:* Raid Radar <100 ms, Health Score <50 ms, Memory scan <500 ms.
3. **Settings enforcement** — set quiet hours + exempt users + auto-action opt-in. *Pass:* all respected.
4. **Mobile + DOM** — narrow viewport + peak dashboard. *Pass:* single-column renders; DOM under Lighthouse concern threshold.

### M8 — Demo prep
1. **Scenario runnability** — trigger each scripted scenario on the demo sub. *Pass:* all run on demand.
2. **Video constraints** — final cut. *Pass:* ≤60 s, captioned, honest-framing paragraph verbatim in description.
3. **App listing** — pre-launch checklist in `10-app-listing.md`. *Pass:* all items green.
4. **Devpost** — submission form. *Pass:* all required fields filled; video URL public; demo post in <200-member sub.

---

## 10. Pre-coded boilerplate snippets

Repetitive patterns to paste at build time. Each is spec-accurate; adjust identifiers to context.

### 10.1 Devvit trigger handler skeleton
```typescript
import { Devvit } from '@devvit/public-api';

Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    try {
      await ingestComment(event, context);   // single ingestion entry point
    } catch (err) {
      console.error('[sentinel] CommentSubmit ingest failed', err);
      // graceful degradation — never throw out of a trigger handler
    }
  },
});
```

### 10.2 Typed Redis JSON get/set helper
```typescript
async function getJson<T>(redis: RedisClient, key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function setJson<T>(redis: RedisClient, key: string, value: T): Promise<void> {
  const payload = JSON.stringify(value);
  if (payload.length > 5_000_000) throw new Error(`[sentinel] write exceeds 5MB cap: ${key}`);
  await redis.set(key, payload);
}
```

### 10.3 KV compare-and-set debounce
```typescript
// Returns true if the caller should proceed (outside the debounce window).
async function debounceGate(redis: RedisClient, postId: string, windowMs = 5000): Promise<boolean> {
  const key = `sentinel:thread:${postId}:lastEval`;
  const last = await redis.get(key);
  if (last && Date.now() - parseInt(last) < windowMs) return false;   // within window — skip
  await redis.set(key, String(Date.now()), { expiration: 60 });        // soft floor; handlers may race
  return true;
}
```

### 10.4 WATCH/MULTI/EXEC transaction template (dispatchAlert steps 1–3)
```typescript
async function persistAlertAtomic(redis: RedisClient, alert: Alert): Promise<void> {
  const txn = await redis.watch(`sentinel:alert:${alert.alertId}`);
  await txn.multi();
  await txn.set(`sentinel:alert:${alert.alertId}`, JSON.stringify({ ...alert, dispatchState: 'pending' }));
  await txn.zAdd('sentinel:alerts:open', { member: alert.alertId, score: alert.triggeredAt });
  await txn.hSet(`sentinel:alerts:by_target:${alert.targetId}`, { [alert.alertId]: '1' });
  await txn.exec();   // steps 4–7 run after, idempotent + keyed by alertId
}
```

### 10.5 RollingStat — Welford update with decay cap
```typescript
push(value: number, mMax = Infinity): void {
  this.n++;
  if (this.n > mMax) this.n = mMax;                 // decay cap (M_MAX_HOURLY / M_MAX_5MIN)
  const delta = value - this.mean;
  this.mean += delta / this.n;
  this.m2 += delta * (value - this.mean);
}
get stddev(): number { return this.n > 1 ? Math.sqrt(this.m2 / this.n) : 0; }
zScore(value: number): number { return (value - this.mean) / (this.stddev || 1); }   // stddev||1 fallback
```

### 10.6 Histogram intersection overlap
```typescript
// Normalize each histogram so buckets sum to 1.0, then sum the per-bucket minimums.
function histogramOverlap(a: number[], b: number[]): number {
  const sumA = a.reduce((s, x) => s + x, 0) || 1;
  const sumB = b.reduce((s, x) => s + x, 0) || 1;
  let overlap = 0;
  for (let i = 0; i < a.length; i++) overlap += Math.min(a[i] / sumA, b[i] / sumB);
  return overlap;   // ∈ [0, 1]
}
```

### 10.7 Component empty-state fallback
```typescript
function withEmptyState<T>(items: T[], emptyLabel: string, render: (items: T[]) => JSX.Element): JSX.Element {
  if (!items || items.length === 0) {
    return (
      <vstack alignment="center middle" padding="large" gap="small">
        <text size="large">{emptyLabel}</text>
        <text size="small" color="secondary">Nothing to show yet.</text>
      </vstack>
    );
  }
  return render(items);
}
```

### 10.8 Scheduler job registration skeleton
```typescript
Devvit.addSchedulerJob({
  name: 'sentinel.every_5m.refresh_thread_health',
  onRun: async (_event, context) => {
    try {
      await refreshWatchedThreads(context);   // also replays dispatchState==='pending' alerts
    } catch (err) {
      console.error('[sentinel] refresh_thread_health failed', err);
    }
  },
});
// Registered on AppInstall: context.scheduler.runJob({ name, cron: '*/5 * * * *' });
```

### 10.9 Idempotent post-transaction step (audit append)
```typescript
// Step 4 of dispatchAlert — safe to replay because it is keyed by alertId.
async function appendAuditOnce(redis: RedisClient, alertId: string, entry: AuditEntry): Promise<void> {
  const marker = `sentinel:audit:applied:${alertId}`;
  if (await redis.get(marker)) return;                  // already applied — skip
  await redis.rPush('sentinel:audit_log', JSON.stringify(entry));
  await redis.set(marker, '1', { expiration: 60 * 60 * 24 * 30 });   // 30-day retention
}
```

---

## 11. Risks and mitigations

| # | Risk | Likelihood | Schedule impact | Mitigation |
|---|---|---|---|---|
| R1 | **Phase 0 probe fails** (scheduler timeout <5 min, or Redis throttle worse than expected). | Medium | 0–1 day (re-tune M1 params) | Phase 0 is *designed* to surface this on Day 1 before any Foundation code. Pass/fail bars pre-define the fallback (smaller P3 chunks, 10 s debounce). No code rework — just parameter changes. |
| R2 | **M6 Memory overruns** — stylometry (trigrams + vocab cap) is the heaviest single piece; 6-day milestone is the long pole. | Medium | 1–3 days | Adjacent weekend (Days 31–32) absorbs ≤2-day slip. P-5 splits behavioral/stylometry across teammates. P-6 (run M5+M6 in parallel with two engine teammates) converts critical-path days to buffer. Last resort: PRI-3 option (b) defer Memory to v1.1. |
| R3 | **90-second detection target needs heavy tuning** on the demo sub. | Medium | 1–2 days | `09-demo-video-script.md` § Statistical realism note already documents demo-sub z-score degradation; the demo runs at High Sensitivity with pre-staged alts. Day 16 is reserved for tuning + capture; Days 17–18 weekend is the catch-up reserve. |
| R4 | **Stylometry false positives** on real users with similar styles. | Medium | 0–1 day | Dual-signal guard + 0.78 combined threshold + 12-month age cutoff already specified. Fallback per `08-build-plan.md` risk register: raise stylometry floor 0.75→0.85, or behavior-only Memory for v1. |
| R5 | **Devvit API surprise** — an API behaves differently than research/06 documented. | Low–Medium | 1–2 days | Spine-first build (`08-build-plan.md` philosophy) means API issues surface during M1, leaving runway to adapt. Policy per build plan: document the limitation and adapt — no hacks. |
| R6 | **Storage limits hit** under stress. | Low | 0–1 day | 90-day aging policy + per-entity bounded keys + banned-index per-user restructuring already in spec. M7 Day 34 stress test verifies; weekend reserve covers fixes. |
| R7 | **Demo video production runs long** (recording, editing, retakes). | Medium | 1–2 days | Footage captured incrementally at Days 16/23/33, not all at the end. Days 41–44 pure buffer + a 30-second backup cut (`09-demo-video-script.md` § Backup version) cap the downside. |
| R8 | **Integration bugs at engine↔spine boundaries** when engines land. | Medium | 1–2 days | Spine fully tested at M3 before any engine plugs in. Each engine milestone ends with an end-to-end day (16/23/33). Day 41 pure buffer is explicitly for boundary debugging. |
| R9 | **Two milestones each overrun materially**, exhausting buffer. | Low | 3+ days | This is the only scenario that forces a scope cut. PRI-3 conversation re-triggers (CP-8 checkpoint watches for it); option (c) cut Health Score forecast (1–2 days), then option (b) defer Memory. |
| R10 | **Teammate session drop / context loss** (already happened once — this plan is a retry). | Medium | 0–1 day | Self-contained spawn briefs (ROLE/MODEL/EFFORT/CONTEXT/TASK/OUTPUT format). All deliverables are files committed to the repo, so a dropped teammate's work is recoverable; respawn with the same brief. |

---

## 12. Phase 5 spawn plan

Phase 5 is build execution. Default teammate config is **sonnet / medium** unless the task
needs deeper reasoning. Every spawn brief follows the ROLE/MODEL/EFFORT/CONTEXT/TASK/OUTPUT/
OUT-OF-SCOPE/PLAN-APPROVAL format and is **self-contained** (R10 mitigation). Inputs always
include `CLAUDE.md`, `01-product-decisions.md`, this ultraplan, and the relevant engine spec.

| Spawn | Role | Model / effort | Spawn day | Key inputs | Expected output |
|---|---|---|---|---|---|
| S-0 | `phase0-spike-runner` | sonnet / medium | Day 1 | `08-build-plan.md` § Phase 0; `00-plan-review.md` § Empirical-test items | `research/09-runtime-probes.md` with 3 probe results + go/no-go calls |
| S-1 | `foundation-builder` | **opus / high** | Day 2 | `02-architecture.md`; Day 1 probe results | `src/types/*`, `src/stats/*`, `src/storage/*`, `src/ingestion/*`, `src/bootstrap/*`, settings + welcome modal + tests (M1) |
| S-1b | `component-implementer` (stats) | sonnet / medium | Day 2 | `02-architecture.md` § Statistical primitives | `src/stats/{rolling-stat,time-series,histogram,math-utils}.ts` + tests (P-1 parallel stream) |
| S-2 | `dashboard-builder` | sonnet / medium | Day 5 | `06-dashboard-and-ui.md`; M1 type stubs | `src/ui/dashboard.ts`, `src/ui/components/{kpi-row,tab-bar,empty-state,settings-tab,calibration-banner}.ts` (M2; starts P-2 parallel) |
| S-3 | `alert-dispatcher-builder` | **opus / high** | Day 9 | `02-architecture.md` § Alert dispatcher, § Mod action API | `src/alerts/*`, `src/storage/{alert-store,audit-store}.ts`, `src/actions/mod-actions.ts`, `activity-log-tab.ts` (M3) |
| S-4 | `raid-radar-builder` | **opus / high** | Day 12 | `03-engine-raid-radar.md`; M3 dispatchAlert | `src/engines/raid-radar/*`, `src/actions/auto-actions.ts`, `src/calibration/calibration.ts`, `threats-tab.ts`, `cluster-graph.ts` (M4) |
| S-4b | `component-implementer` (signals) | sonnet / medium | Day 12 | `03-engine-raid-radar.md` § signals 1–4 | `src/engines/raid-radar/signals.ts` + tests (P-3 parallel stream) |
| S-5 | `health-score-builder` | **opus / high** | Day 19 | `05-engine-health-score.md` | `src/engines/health-score/*`, `threads-tab.ts` (M5) |
| S-6 | `memory-builder` | **opus / high** | Day 26 | `04-engine-memory.md` | `src/engines/memory/*`, `src/storage/banned-index.ts`, `users-tab.ts`, `side-by-side.ts`, `menu-items.ts` (M6) |
| S-6b | `component-implementer` (stylometry) | **opus / high** | Day 27 | `04-engine-memory.md` § Signal B | `src/engines/memory/stylometry.ts` + tests (P-5 parallel; opus because trigram/vocab logic is subtle) |
| S-7 | `integration-architect` | **opus / high** | Day 9 (advisory), reviews at CP-5/6/8 | all engine specs; this ultraplan § 4 | Engine↔spine interface review notes; no code — guards boundary consistency |
| S-8 | `polish-engineer` | sonnet / medium | Day 34 | `08-build-plan.md` M7; `06-dashboard-and-ui.md` | Performance/stress fixes, edge-case fixes, mobile + a11y pass (M7) |
| S-9 | `test-runner` | sonnet / medium | Recurring — end of each milestone (Days 6, 8, 9, 16, 23, 33, 36) | milestone test scenarios (§ 9) | Pass/fail report per milestone gate |
| S-10 | `demo-producer` | sonnet / medium | Day 37 | `09-demo-video-script.md`; `10-app-listing.md`; captured footage | Demo video, app listing copy, screenshots, Devpost draft (M8) |
| S-11 | `spec-proofreader` | sonnet / low | Day 40 | `10-app-listing.md`; Devpost text | Proofread report on external-facing copy before submission |

**Spawn sequencing notes:**
- S-1 and S-1b run concurrently on Day 2 (P-1). S-2 spawns Day 5 against M1 type stubs (P-2).
- **P-6 option:** if the lead wants to compress the critical path, spawn S-6 (`memory-builder`)
  on Day 19 alongside S-5 (`health-score-builder`) instead of Day 26 — M5 and M6 both depend
  only on the spine, not each other. This converts ~5 critical-path days into buffer but
  requires two opus engine teammates active simultaneously.
- Engine builders are **opus / high** because each is multi-file work with statistical
  reasoning and spec-fidelity requirements; UI/polish/demo work is **sonnet / medium**.
- S-7 (`integration-architect`) is advisory-only — it never writes code; it reviews
  interface consistency at the engine checkpoints to catch boundary drift early (R8).
- All briefs must carry the **OUT OF SCOPE** clause: do not reverse `01-product-decisions.md`;
  surface conflicts as Plan Review items. Do not use plan-mode (per project memory).

---

*End of Ultraplan. 45 day-entries scheduled (32 working days: 28 milestone + 4 pure-buffer;
12 weekend elastic-buffer days; 1 submission day). 51 file-creations specified.
Critical path: Phase 0 → M1 Foundation → M3 Alert dispatcher → M4 Raid Radar → M6 Memory →
M7 Polish → M8 Demo prep → Submission. Built for PRI-3 option (a) — all three engines.*
