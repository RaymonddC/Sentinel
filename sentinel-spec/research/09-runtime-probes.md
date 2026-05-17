# 09 · Runtime probes (Phase 0 spike)

> **Status:** 3/6 probes resolved (1 local, 2 static); 3/6 still require a live
> Devvit playtest. Treat the env-bound probes as blockers for any spec-pinned
> parameter that depends on them. Record real outcomes inline.

| Probe | Status | Where it can run |
|---|---|---|
| E-Trigram-Perf | ✅ Local | covered by `src/__tests__/perf.test.ts` |
| E-SlowMode-API | ✅ RESOLVED — static | type-surface inspection of `@devvit/public-api` |
| E-SchedulerTimeout | ⏳ Pending | `devvit playtest` (schedule a one-off job) |
| E-RedisThrottle | ⏳ Pending | `devvit playtest` (loop writes) |
| E-SlowMode-Impact | ⏳ Pending | live test sub mid-brigade (depends on E-SlowMode-API) |
| E-useInterval | ✅ RESOLVED — static | type-surface inspection of `@devvit/public-api` |

## E-Trigram-Perf ✅

Local benchmark wired in `src/__tests__/perf.test.ts`:
> "extractTrigrams + cosine for 500-comment fingerprint pair < 20ms (Phase 0 budget)"

The assertion guards Memory's per-comment stylometry refresh path. Latest CI
run: passing. If the Devvit runtime is materially slower than the Node test
host, tighten by trimming `topNgrams` from 50 to 30 in
`src/engines/memory/stylometry.ts` § `pruneTopN`.

**Outcome (local):** under 20ms on Node 22 / Linux. Devvit runtime numbers
TBD.

## E-SlowMode-API ✅ RESOLVED — static

Probe whether `@devvit/public-api` exposes a programmatic slow-mode toggle.

**Method:** Full grep + manual inspection of all `.d.ts` files in
`node_modules/@devvit/public-api/` (v0.11.x). Searched namespaces:
`setSlowMode`, `slowMode`, `slow_mode`, `setOptions`, `modSettings`,
`subreddit.settings`, `rate`, `throttle`, and every method on
`RedditAPIClient`, `Subreddit`, `SubredditInfo`, and `SubredditSettings`.

**Result: API does NOT exist.**

- `Subreddit` class — no slow-mode methods; no `setOptions`, no `modSettings`.
- `SubredditSettings` type — contains `restrictCommenting` and `restrictPosting`
  (subreddit-wide booleans) but **no slow-mode field of any kind**.
- `SubredditInfo` type — no slow-mode property.
- `RedditAPIClient` — no slow-mode method; full method list confirmed (banUser,
  muteUser, modNotes, wiki, flair, widgets, etc.). Zero hits for "slow".
- Hypothesized paths confirmed absent:
  - [x] `context.reddit.getSubredditById(...).setSlowMode(...)` — **not found**
  - [x] `context.reddit.getSubredditInfoById(...).mod.setSlowMode(...)` — **not found**
  - [x] `context.reddit.modSettings` — **not found**
  - [x] `subreddit.setOptions(...)` — **not found**
- AutoModerator wiki path (`context.reddit.getWikiPage(subredditName,
  'config/automoderator')` → `.update(content, reason?)`) **is possible** as a
  raw wiki edit, but AutoModerator has no slow-mode directive — it only handles
  comment/post rules. This is not a slow-mode toggle.

**Implication for Sentinel:**
→ Keep fallback; sticky-comment is the path forward. The Redis-flag +
stickied-mod-distinguished-comment implementation in
`src/alerts/mod-action.ts § applySlowMode` is correct and final.
Demo narration: "Sentinel marks the thread for slow mode; mod confirms with one click."
No code changes required.

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

## E-useInterval ✅ RESOLVED — static

Probe whether `useInterval` is available inside `addCustomPostType`'s render context.

**Method:** Inspection of `node_modules/@devvit/public-api/` declaration files
(`index.d.ts`, `types/hooks.d.ts`, `types/context.d.ts`,
`devvit/internals/blocks/handler/useInterval.d.ts`).

**Result: useInterval EXISTS and is exported.**

**Export path:**
```
import { useInterval } from '@devvit/public-api';
```
Confirmed in `index.d.ts`:
```
export { useInterval } from './devvit/internals/blocks/handler/useInterval.js';
```

**TypeScript signature:**
```ts
// Top-level named export (preferred):
function useInterval(
  callback: () => void | Promise<void>,
  requestedDelayMs: number
): UseIntervalResult;

type UseIntervalResult = {
  start: () => void;  // Start the interval
  stop: () => void;   // Stop the interval
};

// Also available (deprecated) via context:
context.useInterval(callback, delay): UseIntervalResult
```

**Constraints (from JSDoc in `types/hooks.d.ts`):**
- Delay must be **at least 100ms** (`delay must be at least 100ms`).
- **Only one `useInterval` hook may be running at a time** per render context.
- Available only within a Block Component (inside `addCustomPostType` render).
- `.start()` / `.stop()` control lifecycle explicitly — does not auto-start on creation.
- Callback may be async (`Promise<void>`).

**Implication for Sentinel:**
→ Dashboard auto-refresh via `useInterval` is viable; wire up in
`src/ui/post.tsx` with `interval.start()` after creation. Minimum delay is
100ms (30 000ms for 30s polls is well above the floor). No "Refresh" button
required as a fallback. The `depends: [tab]` pattern in `useAsync` already
handles tab-switch refresh; `useInterval` can layer on top for live polling.
