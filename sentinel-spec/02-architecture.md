# 02 · Architecture

## Changelog

### 2026-05-12 — Phase 2 spec revisions applied (per `00-plan-review.md` v4)
- R-Bootstrap: Replace infeasible 14-day fetch with three-pattern hybrid (P1 hot-1000 + P2 reactive + P3 progressive); update `bootstrapBaseline()` comments (see plan-review § R-Bootstrap)
- R-Welford: Pin Welford-with-decay for volatile signals, full-history for slow-changing; remove "rolling window" annotation on `SubBaseline`; add `M_MAX` constants to `RollingStat`; drop `baselineWindowDays` from advanced settings (see plan-review § R-Welford)
- R-NoSets: Re-encode `alerts:open` as SortedSet, `alerts:by_target` as Hash; add Devvit Redis primitive note (see plan-review § R-NoSets)
- R-5MB-Chunking: Add 5 MB cap note; add `sentinel:memory:banned:{userId}` + `sentinel:memory:banned_ids` per-user key pattern to schema (see plan-review § R-5MB-Chunking)
- R-ModNotes-Now: Add Mod Notes integration note to `ModAction` trigger row (see plan-review § R-ModNotes-Now)
- R-Dispatch-Idempotent: Replace "atomic persistence" framing with 7-step idempotent retry + WATCH/MULTI/EXEC + crash recovery (see plan-review § R-Dispatch-Idempotent)
- R-Debounce-CAS: Document KV compare-and-set pattern for 5 s debounce (see plan-review § R-Debounce-CAS)
- R-Stylometry-Norm: Change `vocabulary` type to `Map<string, number>` with frequency cap; pin `Histogram` bucket schemas + histogram-intersection overlap formula (see plan-review § R-Stylometry-Norm)

> The shared infrastructure that all three engines build on. Read this before reading any individual engine spec.

---

## Mental model

Sentinel is structured in three layers:

```
Layer 1: EVENT INGESTION
  └── Receives Reddit events via Devvit triggers
  └── Updates the behavioral graph
  └── Maintains rolling baselines

Layer 2: ENGINE LOGIC
  └── Raid Radar reads the graph, detects brigades
  └── Memory reads the graph, detects evaders
  └── Health Score reads the graph, predicts escalation
  └── Each engine emits Alerts to Layer 3

Layer 3: ACTION + UI
  └── Alert dispatcher routes alerts to dashboard / modmail
  └── Dashboard renders threat feed, user spotlight, watched threads
  └── Audit log records every Sentinel-triggered action
  └── Revert mechanism allows 24h undo
```

**Engines never talk to each other directly.** They all read from the shared graph. This is the architectural keystone — it's what makes Sentinel a platform instead of three apps.

---

## The behavioral graph

The graph is a set of records living in Devvit's Redis storage. There are four primary record types:

### 1. Sub baseline (one per sub)

Tracks "what's normal" for the installed subreddit.

```typescript
type SubBaseline = {
  subId: string;
  // Online stats — seeded by top-1000 hot-post bootstrap, accumulated continuously
  commentsPerHour: RollingStat;        // mean, stddev, count
  postsPerHour: RollingStat;
  uniqueCommentersPerHour: RollingStat;
  newAccountsPerHour: RollingStat;     // accts <30d old
  reportRatePerHour: RollingStat;
  avgCommentLength: RollingStat;
  avgSentiment: RollingStat;           // -1 to +1
  // Distribution stats
  accountAgeDistribution: Histogram;   // age buckets
  topOverlappingSubs: Map<string, number>;  // which other subs members frequent
  // Metadata
  lastUpdated: number;                 // unix ms
  bootstrapComplete: boolean;          // false during first 7 days
};
```

### 2. User fingerprint (one per user who has interacted with the sub)

Tracks behavior + writing style for ban-evader detection.

```typescript
type UserFingerprint = {
  userId: string;
  username: string;
  accountCreatedAt: number;
  // Activity in this sub
  firstSeenInSub: number;
  lastSeenInSub: number;
  totalComments: number;
  totalPosts: number;
  // Behavior fingerprint
  postingTimeHistogram: number[24];    // hours of day, 24 buckets
  commentLengthDist: Histogram;
  postingFrequency: RollingStat;       // gaps between comments
  // Stylometry fingerprint (see 04-engine-memory.md for details)
  stylometry: {
    avgSentenceLength: number;
    punctuationProfile: Map<string, number>;  // freq of !,?,.,...
    capitalization: { allCaps: number; properCase: number; lowercase: number };
    emojiUsage: Map<string, number>;
    topNgrams: Map<string, number>;    // top 50 trigrams
    vocabulary: Map<string, number>;    // word → frequency; capped at top-2000 (drop lowest-freq 500 when map exceeds 2500)
  };
  // Cross-sub graph
  otherSubs: Map<string, number>;      // sub → comment count
  // Mod history in THIS sub
  modActions: ModActionRecord[];       // bans, warnings, removals
  // Sliding window of raw comments (for fingerprint refinement)
  recentComments: CommentSample[];     // max 100, FIFO
  // Metadata
  lastUpdated: number;
};
```

### 3. Thread state (one per thread being watched)

Tracks live state for Health Score predictions.

```typescript
type ThreadState = {
  postId: string;
  subId: string;
  createdAt: number;
  authorId: string;
  // Live counters (updated on each event)
  commentCount: number;
  uniqueCommenters: Set<string>;
  newAccountCommenters: number;        // accts <30d
  reportCount: number;
  // Time-series data (5-min buckets, last 24h)
  velocity: TimeSeries;                // comments/min over time
  sentiment: TimeSeries;               // avg sentiment over time
  reportRate: TimeSeries;
  // Risk score (computed by Health Score engine)
  currentRisk: number;                 // 0-100
  riskHistory: TimeSeries;             // risk score over time
  // Metadata
  isWatched: boolean;
  lastUpdated: number;
};
```

### 4. Alert record (one per fired alert)

Tracks every Sentinel detection for audit + feedback loop.

```typescript
type Alert = {
  alertId: string;
  subId: string;
  engineName: 'raid_radar' | 'memory' | 'health_score';
  severity: 'info' | 'medium' | 'high' | 'critical';
  triggeredAt: number;
  // What fired
  signals: SignalSnapshot[];
  confidence: number;                  // 0-1
  // What it relates to
  targetType: 'thread' | 'user' | 'sub';
  targetId: string;
  // Mod response
  status: 'open' | 'actioned' | 'dismissed' | 'false_positive';
  resolvedAt?: number;
  resolvedBy?: string;                 // username
  actionTaken?: ModAction;
  // For revert
  revertibleUntil: number;             // unix ms, 24h after action
};
```

---

## Devvit Redis schema

Use namespaced keys. Devvit's storage is per-app-installation (per-sub).

```
sentinel:baseline                     → SubBaseline
sentinel:user:{userId}                → UserFingerprint
sentinel:thread:{postId}              → ThreadState
sentinel:alert:{alertId}              → Alert
sentinel:alerts:open                  → SortedSet<alertId>      (score = createdAtMs; zAdd/zRange)
sentinel:alerts:by_target:{targetId}  → Hash<alertId, '1'>      (hash-as-set; hSet/hGet/hGetAll)
sentinel:settings                     → SubSettings
sentinel:memory:banned:{userId}       → BannedUserSummary       (~400–750 bytes; per-user key)
sentinel:memory:banned_ids            → SortedSet<userId>       (score = bannedAt; enumeration index)
sentinel:audit_log                    → List<AuditEntry>        (capped, last 1000)
sentinel:calibration                  → CalibrationData          (false positive tracking)
```

> **Devvit Redis primitive note:** Devvit Redis does not support standard Redis Sets (`SADD`/`SMEMBERS`/`SISMEMBER`), key enumeration (`KEYS`/`SCAN`), pipelining, or Lua scripts. Set-like structures use sorted-set-as-set (score = timestamp, when ordering matters) or hash-as-set (value = `'1'`, when unordered O(1) lookup suffices).

> **5 MB write cap:** Devvit Redis enforces a 5 MB maximum per request. All schema keys above are bounded per entity (30–150 KB per key); no single write exceeds 1 MB by design. The sole structural exception is the banned-user index — restructured to per-user keys (see `sentinel:memory:banned:{userId}` below).

**Storage budget per sub:** roughly 500MB upper bound for ~10K active commenters. Aging policy keeps it bounded indefinitely.

---

## Event ingestion

Every Devvit trigger writes to the graph through a single ingestion module. This guarantees consistency.

### Triggers used

| Devvit Trigger | What it updates |
|---|---|
| `PostSubmit` | Thread state (new), sub baseline (post rate) |
| `CommentSubmit` | Thread state (velocity, sentiment), user fingerprint (behavior + style), sub baseline |
| `ModAction` | User fingerprint (mod actions), audit log; on `banuser` event, optionally write Mod Note (`addModNote`) summarising signals; at install, optionally seed banned-index from prior ban history via `getModNotes({filter:'BAN'})` |
| `PostReport` / `CommentReport` | Thread state (report rate), alert severity bumps |
| `AppInstall` | Onboarding flow trigger |
| `AppUpgrade` | Settings migration |

### Ingestion module API

```typescript
// All engines and triggers go through these functions
async function ingestComment(event: CommentSubmitEvent): Promise<void> {
  // 1. Update thread state
  // 2. Update user fingerprint
  // 3. Update sub baseline
  // 4. Notify each engine to re-evaluate (debounced)
}

async function ingestPost(event: PostSubmitEvent): Promise<void> { ... }
async function ingestModAction(event: ModActionEvent): Promise<void> { ... }
async function ingestReport(event: ReportEvent): Promise<void> { ... }
```

**Debouncing matters:** A brigade fires 50 comments in 10 seconds. Don't re-evaluate Raid Radar on every single comment — debounce engine evaluations to once per 5 seconds per thread. Devvit triggers have no built-in debounce; implement via KV compare-and-set:

```typescript
// Before engine evaluation in ingestComment / ingestPost:
const key = `sentinel:thread:${postId}:lastEval`;  // TTL ~60 s
const last = await redis.get(key);
if (last && Date.now() - parseInt(last) < 5000) return;  // within window — skip
await redis.set(key, String(Date.now()), { expiration: 60 });
// proceed with engine evaluation
```

*Approximate debounce — concurrent handlers may race; the 5 s budget is a soft floor.*

---

## Statistical primitives (shared by all engines)

These are the building blocks the engines use. Implement once, reuse everywhere.

### RollingStat (running mean + stddev)

Two modes per signal type (research/09):
- **Welford-with-decay** (volatile signals: comments/h, velocity/min, report-rate, sentiment swing): standard Welford update with capped count — `if (n > M_MAX) n = M_MAX`. Warm-up is identical to full-history Welford; saturated phase is EWMA-equivalent with α = 1/M_MAX. Constants: `M_MAX_HOURLY = 336` (14d × 24h); `M_MAX_5MIN = 4032` (14d × 288).
- **Full-history Welford** (slow-changing signals: account-age distribution, new-account ratio): unbounded accumulation is the correct baseline; no cap applied.

EWMA rejected: warm-up underestimates variance for first 7–14 days. Sliding-window Welford rejected: O(N) recompute exceeds ≤20 ms per-comment budget at sub-minute rates.

```typescript
class RollingStat {
  static readonly M_MAX_HOURLY = 336;   // 14d × 24h  — volatile hourly signals
  static readonly M_MAX_5MIN   = 4032;  // 14d × 288  — volatile 5-min signals

  private n = 0;
  private mean = 0;
  private m2 = 0;

  /**
   * @param mMax  Pass RollingStat.M_MAX_HOURLY or M_MAX_5MIN for volatile signals;
   *              omit (or pass Infinity) for slow-changing signals (full-history Welford).
   */
  push(value: number, mMax = Infinity): void {
    this.n++;
    if (this.n > mMax) this.n = mMax;   // decay cap — one extra line; see research/09
    /* Welford's update: mean, m2 */
  }
  get stddev(): number { /* sqrt(m2 / n) */ }
  zScore(value: number): number {
    return (value - this.mean) / (this.stddev || 1);
  }
}
```

### TimeSeries (5-minute buckets, 24-hour window)

Bounded ring buffer of 288 5-min buckets.

```typescript
class TimeSeries {
  private buckets: number[] = new Array(288).fill(0);
  private currentBucketIdx = 0;
  private lastBucketTime = 0;

  add(value: number, timestamp: number): void { ... }
  velocity(): number {       // current rate
  trend(): number {          // slope over last hour
  zScoreAgainst(baseline: RollingStat): number;
}
```

### Histogram

For account-age distributions, comment-length distributions, etc. Bucket schemas are pinned to prevent implementer divergence:

- **posting-time histogram** — 24 buckets (one per UTC hour 0–23)
- **account-age histogram** — 10 buckets: 0–7d, 7–30d, 30–90d, 90–180d, 180d–1y, 1–2y, 2–5y, 5–10y, 10y+, unknown
- **comment-length histogram** — 5 buckets: 0–50, 50–200, 200–500, 500–1500, 1500+ chars

Overlap formula: **histogram intersection** — `Σ min(a[i], b[i])` over normalized buckets (each bucket count ÷ total, so vectors sum to 1.0; intersection returns similarity ∈ [0, 1]).

```typescript
class Histogram {
  private buckets: Map<number, number>;
  add(value: number): void;
  percentile(p: number): number;
  entropy(): number;                      // how diverse is this distribution
  overlap(other: Histogram): number;      // histogram intersection ∈ [0, 1]
}
```

### Bootstrap (history backfill on install)

```typescript
async function bootstrapBaseline(subId: string): Promise<void> {
  // P1 — on install: fetch top-1000 hot posts + their top comments;
  //       index into SubBaseline and initial UserFingerprint records.
  //       (<50 API calls; completes in <2 minutes; non-blocking)
  // P2 — from t=0: all engines run reactively on every incoming event;
  //       no historical data required for live detection.
  // P3 — progressive backfill: hourly scheduled job fills the 3–14d gap
  //       in rate-limit-safe batches (≤50 API calls per job run,
  //       within the 60 runJob/min ceiling).
  //       bootstrapComplete flips to true after the 7-day ramp.
}
```

> Welcome modal copy: "Scanning your sub's recent activity to seed your baseline. Detection is active immediately; accuracy improves over the next 7 days."

---

## Alert dispatcher

Single point of truth for "an engine fired an alert."

```typescript
async function dispatchAlert(alert: Alert): Promise<void> {
  // Steps are idempotent and keyed by alertId — safe to replay on crash.
  // Primary: WATCH/MULTI/EXEC transaction for steps 1–3 (atomic multi-key write,
  //   confirmed available via TxClientLike in @devvit/public-api; research/10).
  // 1. Persist sentinel:alert:{alertId} with dispatchState: 'pending'
  // 2. zAdd sentinel:alerts:open  (score = createdAtMs)
  // 3. hSet sentinel:alerts:by_target:{targetId}  (alertId → '1')
  // 4. Append sentinel:audit_log entry  (keyed by alertId; idempotent)
  // 5. Update dashboard pinned post  (debounced)
  // 6. If severity === 'critical', send modmail  (dedup-keyed by alertId)
  // 7. Set dispatchState: 'complete' on alert record
  //
  // Crash recovery: sentinel.every_5m.refresh_thread_health scans alerts
  //   where dispatchState === 'pending' and replays steps 2–6.
}
```

### Severity routing

| Severity | Dashboard | Modmail |
|---|---|---|
| `info` | ✅ silent log | ❌ |
| `medium` | ✅ live | ❌ |
| `high` | ✅ live + bumped | ❌ |
| `critical` | ✅ live + bumped + visual flash | ✅ modmail to mod team |

---

## Mod action API (the "Undo" foundation)

Every mod action triggered through Sentinel uses this wrapper.

```typescript
async function performModAction(params: {
  alertId: string;
  modUsername: string;
  action: 'lock_thread' | 'enable_slow_mode' | 'filter_new_accts' | 'remove_post' | 'ban_user';
  target: { type: 'thread' | 'user'; id: string };
  parameters: Record<string, any>;
}): Promise<{ auditEntryId: string; revertibleUntil: number }> {
  // 1. Apply the action via Devvit API
  // 2. Write to audit log with full reversal metadata
  // 3. Set revertibleUntil = now + 24h
  // 4. Update alert.status to 'actioned'
  // 5. Return audit entry ID for the Undo button
}

async function revertModAction(auditEntryId: string, modUsername: string): Promise<void> {
  // 1. Look up audit entry
  // 2. Verify revertibleUntil > now
  // 3. Apply inverse action via Devvit API
  // 4. Mark audit entry as reverted
  // 5. Update alert.status back to 'open'
}
```

**Reminder per Q9:** `remove_post` and `ban_user` are NEVER triggered automatically. They're available for mods to invoke from the dashboard, but only by direct mod click — never by Sentinel auto-action. Slow-mode and new-account filtering are the only auto-action capabilities, and only when mods opt in.

---

## Settings (tiered config)

```typescript
type SubSettings = {
  enabled: boolean;
  engines: {
    raidRadar: EngineSettings;
    memory: EngineSettings;
    healthScore: EngineSettings;
  };
  alertChannels: {
    dashboardPost: boolean;
    modmailCritical: boolean;
  };
  // Advanced (collapsible UI section)
  advanced?: {
    // baselineWindowDays removed — M_max is a per-signal constant (see RollingStat)
    quietHours?: { start: number; end: number; timezone: string };
    exemptUsers: string[];
    exemptFlairs: string[];
    customThresholds?: PerSignalThresholds;
  };
};

type EngineSettings = {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  autoActions: {
    enableSlowMode: boolean;            // default false
    filterNewAccounts: boolean;         // default false
  };
};
```

Defaults on first install:
- `enabled: true`
- All engines `enabled: true`, `sensitivity: 'medium'`
- All `autoActions: false`
- Both alert channels on

---

## Scheduler jobs

```typescript
// Daily: prune aged data
sentinel.daily.purge_inactive_users();   // remove fingerprints with lastSeen > 90d AND no mod actions

// Hourly: rollup baselines
sentinel.hourly.rollup_baseline();

// Every 5 min: re-evaluate watched threads
sentinel.every_5m.refresh_thread_health();

// Every 6h: garbage collect expired audit log entries (>30 days)
sentinel.every_6h.gc_audit_log();
```

---

## What's NOT in the architecture

For clarity, things deliberately excluded:
- ❌ External database connections
- ❌ External API calls (no third-party APIs needed)
- ❌ Worker queues / job systems beyond Devvit's scheduler
- ❌ Streaming pipelines (Kafka, etc.)
- ❌ ML model serving
- ❌ Auth systems (Devvit handles mod auth)
- ❌ Multi-tenant logic (each Devvit install is its own tenant by design)

Sentinel runs entirely inside Devvit. That's the whole point.
