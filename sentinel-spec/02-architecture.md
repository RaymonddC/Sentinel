# 02 · Architecture

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
  // Rolling window stats (last 14 days)
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
    vocabulary: Set<string>;            // distinct words seen
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
sentinel:alerts:open                  → Set<alertId>            (sorted by time)
sentinel:alerts:by_target:{targetId}  → Set<alertId>
sentinel:settings                     → SubSettings
sentinel:audit_log                    → List<AuditEntry>        (capped, last 1000)
sentinel:calibration                  → CalibrationData          (false positive tracking)
```

**Storage budget per sub:** roughly 500MB upper bound for ~10K active commenters. Aging policy keeps it bounded indefinitely.

---

## Event ingestion

Every Devvit trigger writes to the graph through a single ingestion module. This guarantees consistency.

### Triggers used

| Devvit Trigger | What it updates |
|---|---|
| `PostSubmit` | Thread state (new), sub baseline (post rate) |
| `CommentSubmit` | Thread state (velocity, sentiment), user fingerprint (behavior + style), sub baseline |
| `ModAction` | User fingerprint (mod actions), audit log |
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

**Debouncing matters:** A brigade fires 50 comments in 10 seconds. Don't re-evaluate Raid Radar on every single comment — debounce engine evaluations to once per 5 seconds per thread.

---

## Statistical primitives (shared by all engines)

These are the building blocks the engines use. Implement once, reuse everywhere.

### RollingStat (running mean + stddev)

Welford's online algorithm. Memory-efficient. Updates in O(1).

```typescript
class RollingStat {
  private count = 0;
  private mean = 0;
  private m2 = 0;

  push(value: number): void { /* Welford's */ }
  get stddev(): number { /* sqrt(m2 / count) */ }
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

For account-age distributions, comment-length distributions, etc.

```typescript
class Histogram {
  private buckets: Map<number, number>;
  add(value: number): void;
  percentile(p: number): number;
  entropy(): number;          // for "how diverse is this distribution"
}
```

### Bootstrap (history backfill on install)

```typescript
async function bootstrapBaseline(subId: string): Promise<void> {
  // Fetch last 14 days of posts/comments via Devvit API
  // Run them through ingestComment / ingestPost
  // Mark baseline.bootstrapComplete = true at the end
}
```

---

## Alert dispatcher

Single point of truth for "an engine fired an alert."

```typescript
async function dispatchAlert(alert: Alert): Promise<void> {
  // 1. Persist alert to KV
  // 2. Update sentinel:alerts:open set
  // 3. Update dashboard pinned post (debounced)
  // 4. If severity === 'critical', send modmail
  // 5. Add audit log entry
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
    baselineWindowDays: number;          // default 14
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
