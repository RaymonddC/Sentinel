# 09 · Runtime probes (Phase 0 spike)

> **Status:** placeholder. The Phase 0 spike must run before lockable parameter
> choices for the engines (slow-mode API, scheduler timeout, Redis throttle,
> slow-mode velocity impact, trigram perf, useInterval). Each probe below has
> a pass/fail criterion; record results inline.

## E-SlowMode-API (highest priority — blocks demo)

Probe whether `@devvit/public-api` exposes a programmatic slow-mode toggle.

- [ ] Try `context.reddit.getSubredditById().setSlowMode(intervalSeconds)`
- [ ] Try `context.reddit.getSubredditInfoById(...).mod.setSlowMode(...)`
- [ ] Try `context.reddit.getPostById(postId).setSuggestedSort('controversial')` as a partial alternative
- [ ] AutoModerator wiki edit path via `context.reddit.getWikiPage('config/automoderator').edit({ content })`

**Pass:** at least one toggle works in playtest.
**Fail:** keep the Redis-flag + stickied-comment fallback in `src/alerts/mod-action.ts`. Update the demo script to narrate "Sentinel marks the thread for slow mode; mod confirms."

**Outcome:** _record here_

## E-SchedulerTimeout

Schedule a one-off `runJob` that loops with a 30s counter log. Record termination time.

- Pass: ≥ 5 min.
- Fail: shrink `src/scheduler/backfill-job.ts` chunk size proportionally.

**Outcome:** _record here_

## E-RedisThrottle

Write 1K / 10K / 50K keys/sec for 60s. Record p99 latency + error class.

- Pass: ≥ 10 keys/sec sustained, p99 < 500ms.
- Fail: widen `DEBOUNCE_WINDOW_MS` (5_000 → 10_000) in `src/ingest/debounce.ts` and lengthen dispatch backoff in `src/alerts/dispatch.ts`.

**Outcome:** _record here_

## E-SlowMode-Impact

Only if E-SlowMode-API passed. Enable slow mode mid-brigade; measure cpm before vs after.

- Pass: within ±20% of 0.70.
- Fail: update `slowModeVelocityImpact` default in `src/types/settings.ts`.

**Outcome:** _record here_

## E-Trigram-Perf

Benchmark `extractTrigrams + cosineSimilarity` on a 500-comment fixture inside Devvit's runtime.

- Pass: < 20ms per fingerprint pair.
- Fail: trim numeric stylometry subvector or cap trigrams to top-30 in `src/engines/memory/stylometry.ts`.

**Outcome:** _record here_

## E-useInterval

Probe whether `useInterval(30_000)` is available inside `addCustomPostType`'s render.

- Pass: polling works.
- Fail: dashboard refreshes on tab switch + add a manual "Refresh" button.

**Outcome:** _record here_
