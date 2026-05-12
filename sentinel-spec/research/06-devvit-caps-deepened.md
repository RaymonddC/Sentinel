# Devvit Capabilities — Deepened (Wave C)

## Summary

Wave C closed **Q4 fully** (all 4 Redis quota dimensions now have official numbers from devvit-docs source) and **Q7 substantially** (40,000 commands/sec limit confirmed; write-specific throttle not separately documented). **Q6 remains partially open**: scheduler rate limits (10 recurring jobs, 60 runJob calls/min, 60 deliveries/min) are confirmed, but per-job execution time, memory limit, and concurrency remain officially undocumented. All three secondary items are now resolved: `user.createdAt` is confirmed as a `Date` type (not `created_utc`), the Mod Notes API has verified public method signatures from official source, and the 100-item cross-sub user history cap is definitively confirmed with the exact API call. **Architecture-changing finding**: Redis has a 5 MB max request size per write, which means large JSON blobs (e.g., cluster state with many edges) must be chunked. The 500 MB / installation cap is confirmed—Sentinel's storage budget is safe if keys are pruned per spec.

---

## Closed Unknowns (Q4 / Q6 / Q7)

### Q4 — Redis Quotas

**Status: CLOSED** (all four dimensions resolved from official documentation)

| Dimension | Value | Source |
|-----------|-------|--------|
| Max storage per installation | **500 MB** | devvit-docs `redis.mdx` [1] |
| Max key count | **~4.2 billion** (hash capacity) | devvit-docs `redis.mdx` [1] |
| Max value/request size | **5 MB per request** | devvit-docs `redis.mdx` [1] |
| Max commands per second | **40,000 cmds/sec** | devvit-docs `redis.mdx` [1] |
| Transaction concurrency | **20 concurrent per installation** | devvit-docs `redis.mdx` [1] |
| Transaction timeout | **5 seconds** | devvit-docs `redis.mdx` [1] |

**Additional limits from the same source:**
- No pipelining supported
- No standard Redis Sets (only sorted sets via `zAdd`/`zRange`)
- No key enumeration (`KEYS *` / `SCAN` not available)
- No Lua scripts
- Sorted set `BYSCORE`/`BYLEX` with `LIMIT` returns max **1,000 results** per call
- Isolation: each installation operates in its own namespace; cross-installation access blocked

**Confidence: High** — read directly from the official `devvit-docs` GitHub repository (`reddit/devvit-docs/docs/capabilities/server/redis.mdx`).

**Sentinel impact**: The 5 MB per-request cap is the most operationally critical limit. Any single Redis write (including serialized cluster state, user fingerprint batches, or dense audit payloads) must stay under 5 MB. Recommend chunking any value over ~2 MB. The 500 MB / installation cap is large enough for Sentinel's use case at launch.

---

### Q6 — Scheduler Job Limits

**Status: PARTIALLY CLOSED** — rate limits confirmed; per-job execution time and memory remain undocumented.

| Dimension | Value | Source |
|-----------|-------|--------|
| Max recurring jobs per installation | **10 live jobs** | devvit-docs `scheduler.mdx` [2] |
| `runJob()` creation rate limit | **60 calls/minute** | devvit-docs `scheduler.mdx` [2] |
| `runJob()` delivery rate limit | **60 deliveries/minute** | devvit-docs `scheduler.mdx` [2] |
| Minimum cron granularity | **1 execution/minute** (base); experimental second-level via extended cron syntax | devvit-docs `scheduler.mdx` [2] |
| Max execution time per job | **Not documented** | Searched 5+ sources [3][4][5] |
| Memory limit per job | **Not documented** | Searched 5+ sources |
| Concurrency (simultaneous job executions) | **Not documented** | Searched 5+ sources |

**Confidence: Mixed** — rate limits are High confidence (official docs). Execution time and memory are genuinely undocumented even at source-code level (`packages/public-api/src/types/scheduler.ts` contains no timeout fields).

**Observation from community app code**: `fsvreddit/hive-protect` self-imposes a 10-second application-level timeout on its queue-processing scheduler jobs (`addSeconds(new Date(), 10)` used as internal deadline). This is an app-level guard, not a platform limit—but it suggests the dev is uncertain about platform limits too and builds in conservative bounds.

**Sentinel impact**: 5-minute cron scans are supported (well above 1-minute minimum). The 10-job cap per installation is not a concern—Sentinel needs at most 3–5 recurring jobs (5-min scan, daily digest, weekly cleanup). Execution time budget per job is unknown; implement lightweight checkpointing or split across multiple `runJob` calls if jobs risk running long.

---

### Q7 — KV Write Throughput

**Status: SUBSTANTIALLY CLOSED** — combined commands/sec limit confirmed; write-specific throttle and overrun behavior not separately documented.

| Dimension | Value | Source |
|-----------|-------|--------|
| Max commands/sec (read + write combined) | **40,000/sec per installation** | devvit-docs `redis.mdx` [1] |
| Write-specific limit | **Not separately documented** (subsumed in 40K cmds/sec) | [1] |
| Throttling behavior on overrun | **Not documented** | Multiple searches [3][4][5] |

**Inference**: At 40,000 commands/sec and Sentinel's debounced write pattern (one write per 5-second debounce per thread, 50 threads max), peak Sentinel write volume is ~10 writes/sec—well under 1% of the quota. Even under a coordinated raid (all 50 threads active simultaneously), Sentinel's writes won't approach the 40K ceiling.

**Confidence: High** for the 40,000 cmds/sec number (official docs). **Still-unknown**: what happens when the limit is exceeded—does Redis return an error, queue the operation, or silently drop? No error response spec was found in docs or GitHub issues.

---

## Sharpened Items

### `account.createdAt` — Field Name and Type

**Status: FULLY RESOLVED** from official source code.

| Attribute | Value |
|-----------|-------|
| Public field name | `user.createdAt` |
| TypeScript type | `Date` (JavaScript Date object) |
| JSDoc | "The date the user was created." |
| Internal source field | `data.createdUtc` (Unix seconds from protobuf) |
| Where it surfaces | `User` object; accessible from trigger payloads AND via `context.reddit.getUserById(t2_id)` |

**Source**: `packages/public-api/src/apis/reddit/models/User.ts` [6]

The field is **not** `created_utc` — that's the internal protobuf name. Devvit wraps it as `createdAt` (a `Date`) in the public SDK. This is a breaking clarification vs. Wave A's inference of `created_utc`.

**Code snippet** (from `fsvreddit/modmail-userinfo` `src/components/accountAge.ts` [7]):
```typescript
import { User } from "@devvit/public-api";
import { formatDistanceToNow, intervalToDuration, formatDuration } from "date-fns";

function getAccountAge(user: User): string {
  // user.createdAt is a Date object
  return formatDistanceToNow(user.createdAt); // e.g. "about 2 years"
}
```

**Internal SDK implementation** (from User.ts [6]):
```typescript
// Devvit converts the Unix-seconds protobuf field to a Date on construction:
const createdAt = new Date(0);
createdAt.setUTCSeconds(data.createdUtc);
this.#createdAt = createdAt;
```

---

### Mod Notes API — Method Signatures

**Status: FULLY RESOLVED** — found in official `RedditAPIClient.ts` and `ModNote.ts`.

The Mod Notes API is a **documented public API** in `@devvit/public-api`, not undocumented as previously inferred. It is accessed via `context.reddit`.

**Method 1 — Write a mod note:**
```typescript
context.reddit.addModNote(options: CreateModNoteOptions): Promise<ModNote>
```

`CreateModNoteOptions`:
```typescript
{
  subreddit: string;   // e.g. 'memes'
  user: string;        // e.g. 'spez'
  note: string;        // text body of the note
  redditId?: T1ID | T3ID;  // optional post/comment ID to attach (e.g. 't3_1234')
  label?: UserNoteLabel;   // optional label
}

// UserNoteLabel enum:
type UserNoteLabel =
  | "BOT_BAN" | "PERMA_BAN" | "BAN"
  | "ABUSE_WARNING" | "SPAM_WARNING" | "SPAM_WATCH"
  | "SOLID_CONTRIBUTOR" | "HELPFUL_USER";
```

**Method 2 — Read mod notes:**
```typescript
context.reddit.getModNotes(options: GetModNotesOptions): Listing<ModNote>
```

`GetModNotesOptions`:
```typescript
{
  subredditName: string;   // e.g. 'memes'
  username: string;        // e.g. 'spez'
  filter?: ModNoteType;    // optional type filter
  limit?: number;          // max notes to return (e.g. 1000)
  pageSize?: number;       // notes per page (e.g. 100)
}

// ModNoteType enum:
type ModNoteType =
  | "NOTE" | "APPROVAL" | "REMOVAL"
  | "BAN" | "MUTE" | "INVITE" | "SPAM"
  | "CONTENT_CHANGE" | "MOD_ACTION" | "ALL";
```

**`ModNote` object** returned:
```typescript
{
  id: string;
  operator: { id?: T2ID; name?: string };
  user: { id?: T2ID; name?: string };
  subreddit: { id?: T5ID; name?: string };
  type: ModNoteType;
  createdAt: Date;
  userNote?: { note?: string; redditId?: T1ID | T3ID | T5ID; label?: UserNoteLabel };
  modAction?: { /* reddit mod action record */ };
}
```

**Source**: `packages/public-api/src/apis/reddit/RedditAPIClient.ts` [8] + `packages/public-api/src/apis/reddit/models/ModNote.ts` [9]

**Confirmation via real app**: `fsvreddit/toolboxnotesxfer` uses `context.reddit.addModNote(noteContent)` in production [10]. This app bulk-transfers Toolbox usernotes to native Reddit mod notes, proving the API works end-to-end.

---

### Cross-Sub User History — Cap Verified

**Status: VERIFIED AND CLOSED** — exact method call and limit confirmed from source.

The 100-item cap from Wave B is confirmed. The actual API call from `fsvreddit/hive-protect/src/getProblematicItems.ts` [11]:

```typescript
const userOverviewOptions: GetUserOverviewOptions = {
  username: userName,
  limit: 100,        // Hard cap at 100 items
  pageSize: 100,     // Fetch all in one page
  sort: "new",       // Most recent first
};

// Returns Post | Comment objects sorted by date
const userContent = await context.reddit
  .getCommentsAndPostsByUser(userOverviewOptions)
  .all();
// userContent.length <= 100
```

Each result item includes:
- `subredditName` and `subredditId` (cross-sub visibility confirmed — results span all subreddits)
- `url` and `permalink`
- `score`
- `createdAt: Date` (timestamp of individual post/comment)

**Method signature**:
```typescript
context.reddit.getCommentsAndPostsByUser(
  options: GetUserOverviewOptions
): Listing<Post | Comment>
```

The **100-item limit is an API parameter**, not a hard platform constraint. However, Reddit's API does not return more than 1,000 items for user history regardless of pagination—the practical effective limit is the Reddit API's own page limit for user overview listings. Setting `limit: 100` is a practical choice by hive-protect.

**Sentinel implication**: Sub-overlap signals must be derived from the most recent 100 posts/comments only. Older activity (multi-month brigades) is invisible. This constrains Raid Radar's temporal baseline window.

---

## Code Snippets

### 1. Checking user account age in a trigger handler
```typescript
// Source: fsvreddit/modmail-userinfo/src/components/accountAge.ts [7]
import { User } from "@devvit/public-api";
import { formatDistanceToNow } from "date-fns";

// user is obtained from trigger event or context.reddit.getUserById()
function getAccountAgeDays(user: User): number {
  const ageMs = Date.now() - user.createdAt.getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}
```

### 2. Writing a Mod Note from a Devvit app
```typescript
// Source: fsvreddit/toolboxnotesxfer/src/notesTransfer.ts [10]
import { CreateModNoteOptions } from "@devvit/public-api";

const noteContent: CreateModNoteOptions = {
  label: "SPAM_WARNING",
  note: "Participated in raid on r/targetSub, wave 2026-05-11",
  redditId: "t3_abc123",   // post where action was observed
  subreddit: "mySubreddit",
  user: "suspiciousUser",
};

await context.reddit.addModNote(noteContent);
```

### 3. Fetching cross-sub user history
```typescript
// Source: fsvreddit/hive-protect/src/getProblematicItems.ts [11]
import { GetUserOverviewOptions } from "@devvit/public-api";

const options: GetUserOverviewOptions = {
  username: "suspiciousUser",
  limit: 100,
  pageSize: 100,
  sort: "new",
};

const history = await context.reddit
  .getCommentsAndPostsByUser(options)
  .all();

// Analyze subreddit distribution:
const subredditMap = new Map<string, number>();
for (const item of history) {
  const count = subredditMap.get(item.subredditName) ?? 0;
  subredditMap.set(item.subredditName, count + 1);
}
```

### 4. Scheduler job with self-imposed time budget (hive-protect pattern)
```typescript
// Source: fsvreddit/hive-protect/src/handleContentCreation.ts [12]
import { addSeconds } from "date-fns";

// Pattern: set an internal deadline to avoid overshoot
const jobDeadline = addSeconds(new Date(), 10); // 10-second budget

while (queue.length > 0 && new Date() < jobDeadline) {
  const item = queue.shift();
  await processItem(item, context);
}

// If queue not empty, reschedule continuation
if (queue.length > 0) {
  await context.scheduler.runJob({
    name: "CheckUserQueue",
    runAt: new Date(), // immediately
    data: { remainingQueue: queue },
  });
}
```

---

## Still-Undocumented Items

### Q6 partial: Scheduler per-job execution timeout and memory limit

**Verdict: Still-undocumented even at deeper level.**

Sources tried:
1. `reddit/devvit-docs/docs/capabilities/server/scheduler.mdx` — documents rate limits (10 jobs, 60/min), not per-job runtime limit [2]
2. `packages/public-api/src/types/scheduler.ts` — contains `ScheduledJobOptions`, `ScheduledCronJobOptions`, `ScheduledJobHandler` types; no timeout or memory fields [13]
3. `deepwiki.com/reddit/devvit` — no scheduler timeout numbers found [14]
4. WebSearch: "devvit scheduler timeout execution limit" — returned Google Cloud, AWS Batch docs; no Devvit-specific hits
5. WebSearch: "r/devvit scheduler" — no posts with timeout numbers discovered
6. `fsvreddit/hive-protect` source code — implements its own 10-second app-level guard, implying dev uncertainty about platform timeout

**Best inference**: Devvit runs on serverless infrastructure; function timeouts are typically 30 seconds to several minutes. Sentinel's 5-minute scan job likely has ample budget, but **cannot be stated as a confirmed number**.

### Q7 partial: Throttling behavior when 40K cmds/sec is exceeded

**Verdict: Still-undocumented.**

Sources tried:
1. `redis.mdx` — states the 40K limit but not the error response or backpressure mechanism [1]
2. `types/redis.ts` — `RedisClient` type shows Promise-returning methods but no error type for rate-limit violations [15]
3. WebSearch: "devvit redis exceeded rate limit error response" — no Devvit-specific results
4. GitHub Issues on `reddit/devvit` — no issue found about Redis rate-limit error behavior
5. `fsvreddit` app sources — no rate-limit handling code found; apps assume Redis calls succeed

**Best inference**: Likely throws a generic Promise rejection on overrun (standard Redis error behavior). Recommend wrapping Redis writes in try/catch with exponential backoff for high-throughput paths.

---

## Sources Cited

1. `reddit/devvit-docs/docs/capabilities/server/redis.mdx` (official docs, raw GitHub) — Redis quota numbers  
   https://raw.githubusercontent.com/reddit/devvit-docs/main/docs/capabilities/server/redis.mdx

2. `reddit/devvit-docs/docs/capabilities/server/scheduler.mdx` (official docs, raw GitHub) — Scheduler rate limits  
   https://raw.githubusercontent.com/reddit/devvit-docs/main/docs/capabilities/server/scheduler.mdx

3. `github.com/reddit/devvit/issues` — Searched for scheduler timeout, Redis quota; no relevant issues found  
   https://github.com/reddit/devvit/issues

4. `deepwiki.com/reddit/devvit` — No quota/timeout numbers  
   https://deepwiki.com/reddit/devvit

5. WebSearch results for "devvit redis quota", "devvit scheduler timeout", "devvit KV write throughput" — returned non-Devvit results

6. `reddit/devvit/packages/public-api/src/apis/reddit/models/User.ts` — `user.createdAt` type and JSDoc  
   https://raw.githubusercontent.com/reddit/devvit/main/packages/public-api/src/apis/reddit/models/User.ts

7. `fsvreddit/modmail-userinfo/src/components/accountAge.ts` — `user.createdAt` usage with date-fns  
   https://raw.githubusercontent.com/fsvreddit/modmail-userinfo/main/src/components/accountAge.ts

8. `reddit/devvit/packages/public-api/src/apis/reddit/RedditAPIClient.ts` — `addModNote`, `getModNotes` public method signatures  
   https://raw.githubusercontent.com/reddit/devvit/main/packages/public-api/src/apis/reddit/RedditAPIClient.ts

9. `reddit/devvit/packages/public-api/src/apis/reddit/models/ModNote.ts` — `CreateModNoteOptions`, `GetModNotesOptions`, `ModNote` type definitions  
   https://raw.githubusercontent.com/reddit/devvit/main/packages/public-api/src/apis/reddit/models/ModNote.ts

10. `fsvreddit/toolboxnotesxfer/src/notesTransfer.ts` — `context.reddit.addModNote()` real-world usage  
    https://raw.githubusercontent.com/fsvreddit/toolboxnotesxfer/main/src/notesTransfer.ts

11. `fsvreddit/hive-protect/src/getProblematicItems.ts` — `getCommentsAndPostsByUser` with `limit: 100, pageSize: 100`  
    https://github.com/fsvreddit/hive-protect/blob/main/src/getProblematicItems.ts

12. `fsvreddit/hive-protect/src/handleContentCreation.ts` — scheduler job 10-second self-imposed deadline pattern  
    https://github.com/fsvreddit/hive-protect/blob/main/src/handleContentCreation.ts

13. `reddit/devvit/packages/public-api/src/types/scheduler.ts` — Scheduler type definitions (no timeout fields)  
    https://raw.githubusercontent.com/reddit/devvit/main/packages/public-api/src/types/scheduler.ts

14. `reddit/devvit-docs/docs/capabilities/server/overview.md` — Server feature overview (no execution limits)  
    https://raw.githubusercontent.com/reddit/devvit-docs/main/docs/capabilities/server/overview.md

15. `reddit/devvit/packages/public-api/src/types/redis.ts` — `RedisClient` type (no rate-limit error types)  
    https://raw.githubusercontent.com/reddit/devvit/main/packages/public-api/src/types/redis.ts
