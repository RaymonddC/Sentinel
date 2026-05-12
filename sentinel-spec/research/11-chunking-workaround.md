# Large-Value Chunking Workaround (R-5MB-Chunking)

## Summary

Of Sentinel's five identified oversize-risk writes, only **`sentinel:memory:banned_index`** is a genuine threat to the 5 MB per-write cap. The other four writes (cluster state, audit log entries, per-user fingerprint, per-thread state) top out at 30–150 KB when stored under their natural per-entity keys and are safe without any workaround. The `banned_index` risk is architectural: it stores ALL banned-user summary fingerprints as a single serialized blob, which breaks at roughly 7,000–10,000 bans (full summaries) or 15,000+ bans (compact stats-only summaries). The default recommendation for Sentinel is **avoidance / re-architect as the primary fix** — split the index into per-user keys plus an enumeration sorted set. Reserve compression as a secondary defense for any value that unexpectedly approaches the limit before restructuring. Hybrid (compressed shards) is a fallback of last resort, never a first choice for new writes.

---

## Per-Approach Evaluation

### 1. Compression

**Pattern:** Serialize value to JSON string → compress with gzip/deflate → encode as base64 string (if binary storage is not supported) → write single string to Redis. On read: reverse the pipeline.

**Compression ratios for Sentinel-style JSON:**
- General-purpose JSON: 5:1 to 10:1 with gzip for repetitive data (arrays of similar objects)
- Numeric-heavy data (histogram arrays, float arrays): 3:1 to 5:1
- Mixed object maps (the `banned_index` structure): 4:1 to 7:1 realistic estimate
- After base64 re-expansion (+33%): effective ratio drops to ~3:1 to 5:1 net

**API availability:** The Web Streams `CompressionStream` / `DecompressionStream` API is part of the WHATWG Streams Standard and is available in Deno (added in Deno 1.19) and all modern browsers. Devvit's runtime (V8 isolate) is expected to support this API, but it is **not explicitly confirmed** in `devvit-docs`. A pure-JS fallback (`pako` npm package) works universally but adds bundle size (~50 KB minified).

**Speed cost:**
- Compressing 1–5 MB of JSON in V8: ~10–80 ms synchronous (negligible vs. 5s transaction timeout)
- No threading needed; compression is synchronous in this size range

**When this alone suffices:** When raw size is 5–20 MB and structural re-architecture is not yet feasible. A 10 MB blob compresses to ~2–3 MB; a 20 MB blob may not compress below 5 MB at typical Sentinel data density.

**Real Devvit app citation:** No known production Devvit apps found using explicit compression as of research date. Pattern is inferred from Web API availability.

**Verdict:** Valid fallback, but not a first-line defense. Runtime availability needs verification before relying on `CompressionStream` in Devvit.

---

### 2. Multi-Key Splitting

**Pattern:** Serialize full value → split into N chunks of ≤4 MB each → write `key:chunk:0` … `key:chunk:N-1` → write `key:manifest` = `{chunks: N, version: v, totalSize: S}`. Read by fetching manifest, then fetching all chunks, then reassembling.

**Reconstruction cost:**
- Devvit Redis has no pipelining → chunk reads are sequential (confirmed in `06-devvit-caps-deepened.md`)
- 3 chunks × 1 round-trip each = ~3 Redis operations for read, plus 1 manifest read = 4 ops total
- Acceptable within a single scheduler job context; not great for latency-sensitive hot paths

**Concurrency hazard:**
- Partial write scenario: old manifest says 2 chunks, writer is mid-update adding chunk 3 — reader sees stale manifest and misses data
- Mitigation: write all chunks first with new `version` suffix (`key:chunk:0:vN`) before atomically updating manifest. Reader sees either old or new complete version, never a partial state.
- Alternative: wrap chunk writes + manifest update in a single Devvit Redis transaction (20 concurrent tx, 5s timeout — feasible for ≤3 chunks)

**Pros:** No external libraries; deterministic read cost; works for arbitrarily large payloads (within 500 MB total cap).  
**Cons:** Increases Redis command count; manifest adds a critical-path read; stale-manifest bugs are subtle.

**Real Devvit app citation:** None found. Pattern is standard Redis practice for "big key" mitigation (see Redis blog [1]).

**Verdict:** Good last-resort approach when avoidance is impossible. Not recommended as a primary design choice because it obscures what should be a structural problem.

---

### 3. Versioning

**Pattern:** Each write appends a monotonic version number: `key:v1`, `key:v2`, etc. A pointer `key:latest` holds the current version number. Atomic update: write new full value to `key:vN+1`, then write `key:latest = N+1`.

**Atomic update guarantee:**
- Writing `key:latest` is a single atomic string set; readers see either old or new version, never partial
- No transaction needed for the pointer update (single-op atomicity)

**Storage cost:**
- Old versions accumulate until cleaned up
- Cleanup requires explicit `del(key:vN)` calls; without SCAN/KEYS in Devvit, must track version numbers in a side list to know what to delete
- At a 5 MB value updated every 5 seconds: ~60 MB/minute of stale version accumulation — exceeds 500 MB total cap in minutes without aggressive cleanup

**When useful:** Immutable snapshots with explicit retention (e.g., audit trail of cluster states). Not useful for high-frequency live state where old versions must be immediately deleted.

**Verdict:** Niche use only. Stale-version accumulation is fatal for any frequently-updated key. Not recommended for any Sentinel oversize-risk write.

---

### 4. Avoidance / Re-architect

**Pattern:** Restructure the data model so no single write can exceed 5 MB. Split logical collections into per-entity keys. Use a sorted set or list as an enumeration index instead of a monolithic map.

**Applied to `banned_index`:**
- Instead of: `sentinel:memory:banned_index` → `{t2_abc: {summary…}, t2_def: {summary…}, …}` (one blob, grows unboundedly)
- Use: `sentinel:memory:banned:{userId}` → `{summary}` (one key per user, ~750 bytes each, never hits 5 MB)
- Plus: `sentinel:memory:banned_ids` sorted set (score = bannedAt timestamp, member = userId) for enumeration
- Fetch sequence: `zRange('banned_ids', 0, -1)` → up to 1,000 IDs per call (Devvit sorted set BYSCORE limit) → batch-fetch individual summaries

**Key constraint:** Devvit Redis has no `KEYS *` / `SCAN`, so enumeration of per-entity keys requires an explicit index. The sorted set serves as that index. Writing a new ban requires two operations: `set(banned:{userId}, summary)` + `zAdd(banned_ids, {score: timestamp, member: userId})`. Both can be wrapped in a transaction for atomicity.

**Per-user fingerprint (`sentinel:user:{userId}`):**  
Already per-entity keyed in the spec schema. No structural change needed. The 100-comment FIFO and vocabulary set are bounded per user at ~30–40 KB, well under the cap.

**Audit log (`sentinel:audit_log`):**  
Already a Redis List in the spec. Each `lPush` writes a single entry (~400 bytes). No structural change needed.

**Cluster state (`sentinel:thread:{postId}` or equivalent raid cluster key):**  
Per-thread or per-cluster keyed at ~15–150 KB. No structural change needed.

**Pros:** Eliminates the root cause; no compression library needed; each write is provably bounded.  
**Cons:** Requires N reads to reconstruct a full collection; matching algorithms must adapt to iteration patterns.

**Real Devvit app citation:** `fsvreddit/hive-protect` uses per-item queue entries rather than one large queue blob, demonstrating the avoidance pattern in practice [2].

**Verdict:** **Primary recommendation** for `banned_index`. Eliminates the risk entirely with minimal complexity.

---

### 5. Hybrid (Compressed Shards)

**Pattern:** Serialize the logical collection → compress first → if compressed size > 4 MB, split into shards → write shards + manifest. Reads: fetch manifest, fetch shards, decompress each, reassemble.

**When justified:** When re-architecting is not feasible (legacy data structure, migration risk) AND compression alone does not bring size below 5 MB. This is a last-resort pattern for values that are genuinely unavoidable as blobs.

**Time/memory cost:**  
- Write: compress (~20–80 ms) + N shard writes (sequential, ~N × round-trip latency)  
- Read: manifest read + N shard reads (sequential) + decompression (~20–80 ms) — meaningful latency for hot paths  
- Memory: must hold full decompressed value in memory (~2× the compressed size during reconstruction)

**Pros:** Handles any size; compression usually reduces shard count to 1 (single write path most of the time).  
**Cons:** Most complex implementation; worst-case read latency; requires testing compression API availability in Devvit runtime.

**Verdict:** Do not start here. Use avoidance first; add compression as defense-in-depth; escalate to hybrid only if both are insufficient.

---

## Recommendation per Sentinel Oversize-Risk Write

| Write | Estimated raw size | Recommended approach | Reason |
|---|---|---|---|
| Raid Radar cluster state | ~15–150 KB (38 accounts × ~250 B + edges; ≤10 concurrent clusters) | **No workaround needed** | Well under 5 MB even at maximum cluster count; already per-cluster-keyed |
| Memory banned-index | ~400–750 bytes/user → **exceeds 5 MB at 7K–15K bans** | **Avoidance: per-user keys + sorted set index** | Only structural fix eliminates unbounded growth; compression buys time, not safety |
| Audit-log | ~400 bytes/entry × 1,000 = **~400 KB max** (as Redis List, per-entry writes) | **No workaround needed** | Redis List entries are individual writes; no single write exceeds a few KB |
| UserFingerprint per user | ~25–40 KB (100-comment FIFO + vocab + histograms; per-user key) | **No workaround needed** | Already per-entity keyed; bounded by 100-comment cap and 90-day expiry |
| ThreadState per thread | ~30–40 KB (4 × 288-bucket TimeSeries + counters + risk history; per-thread key) | **No workaround needed** | Already per-entity keyed; bounded by 50-thread max and ring-buffer design |

**Critical takeaway:** Four of five risk candidates are safe as specified. Only `banned_index` requires action, and avoidance (not compression) is the right fix.

---

## Sample TS Pseudocode

Worst-case pattern: `banned_index` re-architected to per-user keys with sorted-set enumeration.

```typescript
// --- WRITE: record a new ban ---
async function recordBannedFingerprint(
  redis: RedisClient,
  userId: string,
  summary: BannedFingerprintSummary,
  bannedAt: number  // Unix ms
): Promise<void> {
  const summaryKey = `sentinel:memory:banned:${userId}`;
  const indexKey   = `sentinel:memory:banned_ids`;

  // Serialize summary — expected ~400-750 bytes, never near 5 MB per write
  const summaryJson = JSON.stringify(summary);

  // Transaction: both writes succeed or both fail
  await redis.multi([
    ["set", summaryKey, summaryJson],
    ["zadd", indexKey, bannedAt, userId]
  ]);
  // Each individual write: <1 KB — no chunking needed
}

// --- READ: fetch all summaries for batch comparison ---
// NOTE: sorted set zRange returns max 1,000 results per call (Devvit cap)
async function loadBannedSummariesPage(
  redis: RedisClient,
  pageStart: number,  // 0-based index
  pageSize: number    // ≤1000
): Promise<Map<string, BannedFingerprintSummary>> {
  const indexKey = `sentinel:memory:banned_ids`;

  // Step 1: get a page of banned userIds from the sorted set
  const userIds = await redis.zRange(indexKey, pageStart, pageStart + pageSize - 1);
  if (userIds.length === 0) return new Map();

  // Step 2: fetch each summary individually (no pipelining in Devvit)
  // For large bans, this is N sequential reads — acceptable in background job,
  // NOT suitable for real-time per-comment trigger (pre-filter with sub-overlap first)
  const results = new Map<string, BannedFingerprintSummary>();
  for (const userId of userIds) {
    const raw = await redis.get(`sentinel:memory:banned:${userId}`);
    if (raw) results.set(userId, JSON.parse(raw) as BannedFingerprintSummary);
  }
  return results;
}

// --- COMPRESSION FALLBACK (if a write unexpectedly approaches 5 MB) ---
// Only use if CompressionStream is confirmed available in Devvit runtime
async function compressedWrite(
  redis: RedisClient,
  key: string,
  value: unknown
): Promise<void> {
  const json = JSON.stringify(value);
  const inputBytes = new TextEncoder().encode(json);

  // CompressionStream: Web Streams API (available in Deno, modern V8 isolates)
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(inputBytes);
  writer.close();

  const compressedBuffer = await new Response(cs.readable).arrayBuffer();
  // base64-encode for string storage in Redis (if binary not supported)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(compressedBuffer)));

  // Sanity check — abort rather than silently exceed limit
  if (b64.length > 4_500_000) {
    throw new Error(`Value too large even after compression: ${b64.length} bytes. Consider sharding.`);
  }

  await redis.set(key, b64);
}

// Decompression counterpart omitted for brevity — reverses encode→decode→decompress pipeline
```

---

## Sources

1. Redis blog — "Redis Clustering Best Practices With Multiple Keys"  
   https://redis.io/blog/redis-clustering-best-practices-with-keys/

2. `fsvreddit/hive-protect` — per-item scheduler queue pattern (avoidance of large blobs)  
   https://github.com/fsvreddit/hive-protect

3. MDN — Compression Streams API (CompressionStream, DecompressionStream)  
   https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API

4. Deno docs — CompressionStream API support (Deno 1.19+)  
   https://docs.deno.com/api/web/~/CompressionStream

5. web.dev — "Compression Streams are now supported on all browsers"  
   https://web.dev/blog/compressionstreams

6. DEV Community — "Optimize It or Crash: The Big Key Problem in Redis"  
   https://dev.to/leapcell/optimize-it-or-crash-the-big-key-problem-in-redis-36n2

7. `reddit/devvit-docs` — Redis quota numbers (5 MB cap, 500 MB total, no SCAN/KEYS)  
   https://raw.githubusercontent.com/reddit/devvit-docs/main/docs/capabilities/server/redis.mdx

8. DEV Community — "JSON compression in the browser, with gzip and the Compression Streams API"  
   https://dev.to/ternentdotdev/json-compression-in-the-browser-with-gzip-and-the-compression-streams-api-4135
