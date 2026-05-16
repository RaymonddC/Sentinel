# 09 · Runtime probes (Phase 0 spike)

> **Status:** 1/6 probe answered locally; 5/6 require a live Devvit playtest.
> Treat the env-bound probes as blockers for any spec-pinned parameter that
> depends on them. Record real outcomes inline.

| Probe | Status | Where it can run |
|---|---|---|
| E-Trigram-Perf | ✅ Local | covered by `src/__tests__/perf.test.ts` |
| E-SlowMode-API | ⏳ Pending | `devvit playtest` in a test sub |
| E-SchedulerTimeout | ⏳ Pending | `devvit playtest` (schedule a one-off job) |
| E-RedisThrottle | ⏳ Pending | `devvit playtest` (loop writes) |
| E-SlowMode-Impact | ⏳ Pending | live test sub mid-brigade (depends on E-SlowMode-API) |
| E-useInterval | ⏳ Pending | `devvit playtest` (probe inside custom-post render) |

## E-Trigram-Perf ✅

Local benchmark wired in `src/__tests__/perf.test.ts`:
> "extractTrigrams + cosine for 500-comment fingerprint pair < 20ms (Phase 0 budget)"

The assertion guards Memory's per-comment stylometry refresh path. Latest CI
run: passing. If the Devvit runtime is materially slower than the Node test
host, tighten by trimming `topNgrams` from 50 to 30 in
`src/engines/memory/stylometry.ts` § `pruneTopN`.

**Outcome (local):** under 20ms on Node 22 / Linux. Devvit runtime numbers
TBD.

## E-SlowMode-API (highest priority — blocks demo)

Probe whether `@devvit/public-api` exposes a programmatic slow-mode toggle.

- [ ] `context.reddit.getSubredditById(...).setSlowMode(intervalSeconds)`
- [ ] `context.reddit.getSubredditInfoById(...).mod.setSlowMode(...)`
- [ ] `context.reddit.getPostById(postId).setSuggestedSort('controversial')` as partial alternative
- [ ] AutoModerator wiki edit via `context.reddit.getWikiPage('config/automoderator').edit({ content })`

**Pass:** at least one toggle works in `devvit playtest`.
**Fail:** keep the Redis-flag + stickied-comment fallback in
`src/alerts/mod-action.ts § applySlowMode`. Demo narration:
"Sentinel marks the thread for slow mode; mod confirms with one click."

**Outcome:** _record here_

## E-SchedulerTimeout

Schedule a one-off `runJob` with a 30s counter log. Record termination time.

- Pass: ≥ 5 min.
- Fail: shrink `src/scheduler/backfill-job.ts` chunk size proportionally.

**Outcome:** _record here_

## E-RedisThrottle

Write 1K / 10K / 50K keys/sec for 60s. Record p99 + error class.

- Pass: ≥ 10 keys/sec sustained, p99 < 500ms.
- Fail: widen `DEBOUNCE_WINDOW_MS` (5_000 → 10_000) in
  `src/ingest/debounce.ts` and lengthen dispatch backoff in
  `src/storage/transactions.ts § runTx`.

**Outcome:** _record here_

## E-SlowMode-Impact

Only if E-SlowMode-API passed. Toggle slow mode mid-brigade; measure cpm
before vs after.

- Pass: within ±20% of 0.70.
- Fail: update `slowModeVelocityImpact` default in
  `src/types/settings.ts § defaultSettings`.

**Outcome:** _record here_

## E-useInterval

Probe whether `useInterval(30_000)` is available inside `addCustomPostType`'s
render context.

- Pass: polling works.
- Fail: dashboard refreshes on tab switch + add a manual "Refresh" button to
  `src/ui/post.tsx`.

**Outcome:** _record here_
