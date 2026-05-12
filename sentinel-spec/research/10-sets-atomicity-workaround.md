# Sets + Atomicity Workaround (R-NoSets)

## Summary

Devvit Redis has no native Sets primitive, but **hash-as-set** is the best default for
unordered membership indices (O(1) insert/exists/delete via `hSet`/`hGet`/`hDel`), while
**sorted-set-as-set** is optimal when ordering by time matters — exactly the case for
`sentinel:alerts:open`. The critical and previously uncertain finding for atomicity:
Devvit Redis **does** support `WATCH`/`MULTI`/`EXEC` (optimistic-locking transactions),
confirmed from the official `redis.mdx` and the `TxClientLike` interface in
`packages/public-api/src/types/redis.ts`. All queued commands inside `multi()`/`exec()`
execute as an atomic unit; if a watched key changes before `exec()`, the block aborts and
should be retried. This pattern directly solves every multi-key write in Sentinel (alert
dispatch, mod-action + audit, banned-index update) without compensating-action hacks.

---

## Part A — Set-membership emulation

### Pattern 1: Sorted-set as set

**Operations:**
```
add:    zAdd(key, { member: id, score: timestamp })
check:  zScore(key, id)    → number | undefined  (undefined = absent)
list:   zRange(key, '-inf', '+inf', { by: 'score' })  → sorted by score
remove: zRem(key, [id])
```

**Complexity:** O(log N) add/remove/check; O(N) full scan.  
**Memory:** ~80 bytes per member (skiplist node + member string).  
**Atomicity:** Each command is individually atomic. `zAdd` + other ops can be queued
inside `multi()`/`exec()` via `TxClientLike`.  
**Built-in ordering:** Score doubles as a priority or timestamp — unique to this pattern.  
**LIMIT cap:** `zRange` with `BYSCORE`/`BYLEX` + `LIMIT` returns max 1 000 results per
call; `LIMIT` requires `rev` or `by:'score'/'lex'` options. Paginate for larger sets.  
**Real app:** Devvit official docs use this pattern for leaderboards (`zAdd('leaderboard',
{member:'user',score:37})`; `zRange` by score). The lexicographic variant (all scores = 0)
emulates a pure set with alphabetical iteration. [Source 1]

**Best fit:** `sentinel:alerts:open` — naturally sorted by creation time.

---

### Pattern 2: Hash as set

**Operations:**
```
add:    hSet(key, { [memberId]: '1' })
check:  hGet(key, memberId)     → string | undefined  (undefined = absent)
list:   hGetAll(key)            → Record<string,string>; Object.keys() = members
remove: hDel(key, [memberId])
count:  hLen(key)
```

**Complexity:** O(1) add/check/delete; O(N) full scan.  
**Memory:** ~50–60 bytes per member (hash field + fixed value `'1'`).  
**Atomicity:** `hSet` is atomic per call. Multiple `hSet`/`hDel` ops can be queued
inside `multi()`/`exec()`. `hSetNX` (set only if field absent) is available on
`RedisClient` but not on `TxClientLike`.  
**No ordering.** Members returned by `hGetAll` are in insertion order (not guaranteed
stable in Redis). Cannot range-query by score.  
**Real app:** Devvit official docs inventory/grocery-list examples (`hSet('inventory',
{sword:'1',potion:'4'})`). The `sentinel:memory:banned_index` is already a hash
(userId → fingerprint string), confirming hash is the idiomatic Devvit pattern for
string-keyed collections. [Source 1, 2]

**Best fit:** `sentinel:alerts:by_target:{targetId}` — unordered alertId lookup index.

---

### Pattern 3: String-of-CSV

**Operations:**
```
add:    get → parse → append → set   (not atomic without WATCH-MULTI-EXEC)
check:  get → parse → includes(id)   (O(N) string scan)
list:   get → split(',')
remove: get → parse → filter → set
```

**Complexity:** O(N) on every read/write (full string parse).  
**Memory:** ~(len(id)+1) bytes/member in the string; single key.  
**Atomicity:** Requires WATCH-MULTI-EXEC to prevent lost-update on concurrent writes.
Under high write concurrency, retry rate climbs.  
**Size limit:** 5 MB string cap → safe for sets up to ~50 000 short IDs but degrades
fast; entire string must be read and rewritten on every change.  
**No partial operations.** Cannot add/remove a single member without a full read-modify-
write cycle.  
**Real app:** No fsvreddit or devvit-examples app was found using this pattern for
production sets. It appears only in toy examples.

**Not recommended for Sentinel.** Every operation on `alerts:open` or `by_target` would
require a full read + rewrite under WATCH, amplifying retry contention.

---

### Pattern 4: Multi-key flat

**Operations:**
```
add:    set('prefix:{id}', '1')        or  set('prefix:{id}', '1', { nx: true })
check:  exists('prefix:{id}')          → boolean   (on RedisClient only)
list:   IMPOSSIBLE — no KEYS * or SCAN
remove: del('prefix:{id}')
```

**Complexity:** O(1) per single-member op.  
**Memory:** One key per member; each key ~30–60 bytes overhead.  
**Atomicity:** Each `set`/`del` is individually atomic. Cannot atomically iterate all
members.  
**Fatal flaw:** No key enumeration in Devvit Redis (`KEYS *` and `SCAN` are not
available [Source 2]). Listing all open alerts or all alertIds for a target is
**impossible** with this pattern.  
**Real app:** Used only as a presence-check cache (e.g., rate-limiting, deduplication),
never for enumerable collections.

**Not viable for Sentinel.** `sentinel:alerts:open` and `by_target` both require listing
all members on dashboard load.

---

### Recommended default

Use **hash-as-set** as the default set emulation. It is the closest to O(1) for all
common operations, memory-efficient, has a natural listing path (`hGetAll`), and `hDel`
provides O(1) removal by member. Use **sorted-set-as-set** (with score = creation
timestamp) specifically for collections that need time-ordering or range pruning —
notably `sentinel:alerts:open` and the audit log (since Devvit Redis has no native List
type; sorted-set with `zRemRangeByRank` gives a capped time-ordered list).

---

## Part B — Multi-key atomicity

### Pattern 1: WATCH-MULTI-EXEC (Optimistic Locking)

**Availability: Confirmed.** `watch()`, `multi()`, `exec()`, `discard()`, `unwatch()`
are present in both `RedisClient` and `TxClientLike`. Official docs provide three
working examples. [Source 1, 3]

**How it works:**
```
const txn = await redis.watch('key1', 'key2'); // watch 1–N keys for changes
await txn.multi();                              // begin queue
await txn.set('key1', newVal);                 // queued (not yet executed)
await txn.zAdd('key2', { member: id, score: ts });
await txn.hSet('key3', { [field]: val });
const result = await txn.exec();               // atomically execute all queued cmds
// result === null → concurrent write on a watched key → abort; retry
```

**Atomicity guarantee:** All queued ops execute in isolation as a single step. If any
watched key was modified between `watch()` and `exec()`, `exec()` aborts (returns null)
without executing any queued command. No partial writes.  
**Limits:** 20 concurrent transactions per installation; 5 s timeout per transaction.  
**Inside transactions:** `del`, `set`, `hSet`, `hDel`, `zAdd`, `zRem`, `incrBy`,
`expire`, `mSet`, range-delete ops — all available. `hSetNX` and `exists` are NOT on
`TxClientLike` (RedisClient only).  
**Retry loop required** when watched keys are highly contended.

---

### Pattern 2: Idempotent retry

Assign each write a unique idempotency token (UUID or `alertId`). Before executing a
multi-step operation, guard against duplicate execution:

```
const guard = await redis.hSetNX('sentinel:idempotency', opId, '1'); // 1=first, 0=dup
if (guard === 0) return; // already executed; skip
await redis.expire('sentinel:idempotency', 86400); // 24h TTL on guard hash
// now execute the full write
```

**Atomicity:** Does not replace WATCH-MULTI-EXEC. Guards against duplicate execution
across retries (e.g., after a handler crash mid-write). Used in combination with
WATCH-MULTI-EXEC to make the full pattern safe to retry.  
**Limitation:** `hSetNX` is NOT available inside `TxClientLike`, so the guard check and
the multi-key write must be separate steps with a narrow race window. For Sentinel's
low-contention writes this race is acceptable.

---

### Pattern 3: Version tagging

Store a monotonic version field alongside each data record:

```
const data = JSON.parse(await redis.hGet('sentinel:thread:X', 'state') ?? '{}');
const version = parseInt(data.version ?? '0');
// ... compute updates ...
const txn = await redis.watch('sentinel:thread:X');
await txn.multi();
await txn.hSet('sentinel:thread:X', { state: JSON.stringify({...data, version: version+1}) });
const ok = await txn.exec(); // null → concurrent write changed version; retry
```

**Use case:** Complex objects that are read-then-modified (e.g., `sentinel:baseline`,
`sentinel:thread:{postId}`). Ensures no silent overwrites when multiple event handlers
fire concurrently for the same thread.  
**Cost:** One extra `hGet` (or `get`) before every write; retry loop on conflict.

---

### Pattern 4: Compensating actions

Write A, then write B. If B fails, issue an inverse of A (rollback):

```
await redis.set('sentinel:alert:X', serialized);         // write A
try {
  await redis.zAdd('sentinel:alerts:open', { member: 'X', score: ts }); // write B
} catch {
  await redis.del('sentinel:alert:X');                   // compensate A
  throw;
}
```

**Atomicity:** Eventual only. There is a window between A and B where state is
inconsistent. Appropriate only for low-criticality appends (e.g., adding a mod-note
after the main action is committed) or when operations are individually idempotent.  
**Not appropriate** for `dispatchAlert` — a missed `zAdd` to `alerts:open` would make
the alert invisible in the dashboard with no recovery path.  
**No real Devvit app found** using explicit compensating writes; most apps simply accept
eventual inconsistency for non-critical secondary indices.

---

### Recommended default

Use **WATCH-MULTI-EXEC** for all multi-key writes in Sentinel. It is natively supported,
provides true atomicity (all-or-nothing), and handles every Sentinel write pattern within
the 5 s timeout (each transaction involves ≤6 small ops, well within budget). Combine
with **idempotent retry** (pre-transaction `hSetNX` guard) for operations that must be
safe against handler-crash reruns (particularly `dispatchAlert`). Compensating actions
are a fallback only for genuinely low-risk secondary writes where inconsistency is
tolerable and detectable.

---

## Recommendation per Sentinel use

| Use case | Set emulation | Atomicity strategy | Implementation cost |
|---|---|---|---|
| `sentinel:alerts:open` | Sorted-set (score = creation timestamp) | Writes via WATCH-MULTI-EXEC inside `dispatchAlert` | Low |
| `sentinel:alerts:by_target:{id}` | Hash as set (`hSet`/`hGet`/`hDel`) | Same WATCH-MULTI-EXEC block as alert dispatch | Low |
| `dispatchAlert` (multi-key write) | n/a | WATCH-MULTI-EXEC + idempotent guard (`hSetNX` pre-check); retry ≤3 | Medium |
| `performModAction` + audit | n/a | WATCH-MULTI-EXEC (watch action key; queue: hSet action record + zAdd audit entry) | Medium |
| `banned-index updates` | (already hash — `hSet` userId→fingerprint) | WATCH-MULTI-EXEC (watch fingerprint key; queue: hSet fingerprint + hSet banned_index) | Low |

**Side note:** Devvit Redis has no native List type (`LPUSH`/`LRANGE` absent). The spec's
`sentinel:audit_log` described as a "List" must be implemented as a sorted set
(score = timestamp; `zRemRangeByRank` trims to last 1 000 entries). This aligns with the
audit log atomicity row above.

---

## Sample TS pseudocode

```typescript
// Recommended atomic write pattern for dispatchAlert()
async function dispatchAlert(
  redis: RedisClient,
  alert: Alert,
  auditEntry: AuditEntry
): Promise<void> {
  const alertKey    = `sentinel:alert:${alert.id}`;
  const openKey     = 'sentinel:alerts:open';
  const byTargetKey = `sentinel:alerts:by_target:${alert.targetId}`;
  const auditKey    = 'sentinel:audit_log';
  const MAX_RETRIES = 3;

  // Idempotency guard: bail out if this alertId was already dispatched
  const isNew = await redis.hSetNX('sentinel:idempotency', alert.id, '1');
  if (isNew === 0) return; // duplicate dispatch; skip safely
  await redis.expire('sentinel:idempotency', 86400); // 24 h TTL

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Watch alertKey — abort if another handler races on the same alertId
    const txn = await redis.watch(alertKey);
    await txn.multi();

    // 1. Persist the alert record
    await txn.set(alertKey, JSON.stringify(alert));

    // 2. Add to open-alerts sorted set (score = creation ms for time ordering)
    await txn.zAdd(openKey, { member: alert.id, score: alert.createdAtMs });

    // 3. Add to by-target lookup hash
    await txn.hSet(byTargetKey, { [alert.id]: '1' });

    // 4. Append to audit log sorted set; trim to last 1000 entries
    await txn.zAdd(auditKey, { member: JSON.stringify(auditEntry), score: Date.now() });
    await txn.zRemRangeByRank(auditKey, 0, -1001);

    const result = await txn.exec();
    if (result !== null) return; // success — all 5 ops committed atomically
    // result === null: watched key changed (concurrent write); retry
  }

  // After MAX_RETRIES, clean up idempotency guard so caller can retry later
  await redis.hDel('sentinel:idempotency', [alert.id]);
  throw new Error(`dispatchAlert failed after ${MAX_RETRIES} retries: ${alert.id}`);
}
```

---

## Sources

1. `reddit/devvit-docs/docs/capabilities/server/redis.mdx` — Official Redis docs: all
   command examples (hash, sorted-set, transaction WATCH-MULTI-EXEC patterns), supported
   command list, transaction limits (20 concurrent, 5 s timeout).  
   https://raw.githubusercontent.com/reddit/devvit-docs/main/docs/capabilities/server/redis.mdx

2. `reddit/devvit/packages/public-api/src/types/redis.ts` — `RedisClient` and
   `TxClientLike` full interface definitions; confirms no list ops, no `setNX`,
   `del` in `TxClientLike`, `hSetNX`/`exists` on `RedisClient` only, `watch` accepts
   variadic keys.  
   https://raw.githubusercontent.com/reddit/devvit/main/packages/public-api/src/types/redis.ts

3. `reddit/devvit-docs` — Transaction examples confirming WATCH-MULTI-EXEC pattern and
   all queued command support; discard / unwatch examples.  
   (same URL as source 1)

4. `fsvreddit/hive-protect` — Confirmed no `zAdd`/`hSet` usage; uses KV via
   `context.redis.get/set` for simple key-value queues; confirms flat-key pattern is
   the fallback when set semantics aren't needed.  
   https://github.com/fsvreddit/hive-protect

5. "Understanding Memory Usage in Redis: SET vs HSET vs ZADD" (Milad Soli, Medium) —
   Memory-per-member comparison used for Pattern 1/2 estimates.  
   https://medium.com/@soleymani.milad72/understanding-memory-usage-in-redis-set-vs-hset-vs-zadd-5afb2c6ecd50

6. `sentinel-spec/research/06-devvit-caps-deepened.md` — Source for confirmed Devvit
   Redis constraints: no native Sets, no pipelining, no Lua, no key enum, 20 concurrent
   tx, 5 s timeout, LIMIT cap 1 000.  
   (local file)
