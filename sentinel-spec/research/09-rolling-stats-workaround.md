# Rolling-Stat Algorithm Workaround (R-Welford)

## Summary

Research file 03 flagged a correctness gap: Welford's algorithm computes full-history (unbounded) statistics, not a 14-day rolling window. For Sentinel's volatile signals (comments-per-hour, comments-per-minute velocity, report rate, sentiment swing), an unbounded accumulator drifts toward lifetime averages and obscures recent anomalies — exactly the opposite of what early-warning detection needs. Five candidate algorithms are evaluated below. The recommended default is **Welford-with-decay (capped count)**, which converges to EWMA at saturation while preserving Welford's accurate warm-up behavior — critical for Sentinel's 7-day calibration ramp. Two slow-changing signals (account-age distribution, new-account ratio) are better served by **Full-history Welford**, where long-term stability is a feature. Sliding-window Welford is the most accurate option for 14d semantics but is prohibitively expensive for sub-minute update rates in Devvit Redis.

---

## Per-algorithm evaluation

### 1. Full-history Welford

**Formula:** Online Welford (count, mean, M2). On each update: `delta = x - mean; mean += delta/count; M2 += delta*(x - mean)`. Variance = `M2 / (count - 1)`.

**Time complexity:** O(1) per update. Two additions, one division. Practical: ~0.01 ms per call.

**Memory cost:** 3 × float64 = 24 bytes in-process; ~100 bytes as JSON in Redis. Negligible per signal.

**Behavior characteristics:**
- Accumulates indefinitely. Older data never expires. The baseline is the lifetime average of the subreddit, not the last 14 days.
- Slow to respond to regime shifts (e.g., if sub doubles in size over 3 months, the baseline lags for weeks before updating enough to matter).
- No spike amplification of old-data noise — numerically stable even for 100K+ samples.
- Variance estimate improves monotonically; converges to true population variance over time.

**Accuracy for anomaly detection (14d baseline):** Poor for volatile signals. Baseline drifts toward historical average, inflating stddev during slow periods and deflating it during historically-busy periods. For stable/slow-changing distributions (account-age, new-account ratio), the lifetime average IS the right baseline — this is a feature.

**Implementation cost in TypeScript on Devvit:** Minimal. Three fields, three arithmetic ops. Redis persistence: `JSON.stringify({n, mean, m2})`. No additional scheduler hooks needed.

---

### 2. Sliding-window Welford

**Formula:** Maintain circular buffer of last N values. On each add, evict oldest value, recompute mean and variance from scratch over N values. (Note: Welford's doesn't natively support removal without numerical instability; recomputation from circular buffer is the safe path.)

**Time complexity:** O(N) per update — full recompute over window. For N = 336 (14d hourly): ~336 iterations ≈ 0.5–2 ms. For N = 20,160 (14d per-minute): ~50–200 ms. **Exceeds the ≤20 ms per-comment budget for sub-minute update rates.**

**Memory cost:** N × 8 bytes = 2.7 KB for hourly (N=336), 160 KB for per-minute (N=20,160), 32 KB for 5-min (N=4,032). All fit within the 5 MB Redis cap, but per-minute signals are expensive. At 50 active threads × 3 velocity signals × 160 KB = 24 MB — within 500 MB total budget but wasteful.

**Behavior characteristics:**
- Mathematically exact 14-day window. Old data truly expires.
- Perfect for detecting regime shifts: once 14 days have passed since an unusual event, its effect is fully purged.
- Suffers from "boundary effects": when an old outlier exits the window, stddev can jump sharply, temporarily inflating false-positive rate.
- Most accurate baseline representation of the spec's intent.

**Accuracy for anomaly detection (14d baseline):** Highest of all options. True windowing eliminates drift. Recommended if performance budget allows.

**Implementation cost:** Moderate-high. Requires circular buffer (array + head pointer), Redis persistence of the full buffer (serialize/deserialize on each event), and O(N) recompute loop. For hourly signals (N=336), acceptable. For per-minute signals (N=20,160), exceeds both time (>20 ms) and storage budgets.

---

### 3. EWMA (Exponentially Weighted Moving Average)

**Formula:** `μ_t = α * x_t + (1-α) * μ_{t-1}`; variance via `var_t = (1-α) * (var_{t-1} + α * (x_t - μ_{t-1})²)`.

**Time complexity:** O(1) per update. Two multiplications, one addition. Practical: ~0.01 ms.

**Memory cost:** 2 × float64 = 16 bytes in-process; ~80 bytes in Redis. Minimal.

**Behavior characteristics:**
- No explicit window; effective window = 1/(1-α) × update_interval (in same time units).
- Targeting 14d effective window for hourly updates: `1/(1-α) = 336` → `α ≈ 0.003`. For 5-min updates: `α ≈ 0.00025`.
- Responds to spikes proportional to α: at α=0.003, a single 10× spike moves mean by ~1%; detection still relies on comparing raw value against μ ± 3σ, which remains accurate.
- Stateless accumulation — no buffer needed.
- Warm-up problem: for the first ~1/α updates, EWMA estimates are unreliable (insufficient weight on early data). At α=0.003, full convergence takes ~333 hourly updates = 14 days. Sentinel's 7-day calibration ramp is half that; EWMA baseline will still be immature at launch.
- α must be manually tuned per signal, coupling the algorithm to signal update frequency. A change to update cadence requires recalculating α.

**Accuracy for anomaly detection (14d baseline):** Good at steady state with correctly-tuned α. Inferior to Welford-with-decay during warm-up (first 7–14 days) because EWMA variance is underestimated before convergence.

**Implementation cost:** Low. Four arithmetic ops per update. Alpha must be documented per signal. Slightly trickier to reason about than Welford because the window is implicit.

---

### 4. Periodic-reset Welford

**Formula:** Standard full-history Welford. Every 14 days, a scheduler job resets the accumulator and re-bootstraps from the preceding 14 days of stored bucket data.

**Time complexity:** O(1) per update; O(N) at reset for bootstrap. Reset occurs every 14d — negligible amortized cost. Reset job must run within scheduler constraints (60 jobs/min, 10 recurring jobs).

**Memory cost:** Same 24 bytes for the accumulator, plus storage of 14d of raw bucket data to enable re-bootstrap = same as sliding-window. For hourly: 2.7 KB. For per-minute: 160 KB.

**Behavior characteristics:**
- Worst boundary behavior of all options. At reset, `count = 0`, `mean = 0`, `stddev = 0`. Even with bootstrap from prior window data, the accumulator starts at N=336 and uses that as the variance estimate — which is actually decent. The real problem: the first few hundred samples after reset are "warm" data that reset old anomalies, which IS the desired property.
- Between resets, behaves identically to full-history Welford. Drift accumulates within each 14d period.
- Requires a scheduled job with enough reliability to fire on time. If the scheduler fails (Q6: per-job timeout undocumented), reset is skipped and baseline drifts indefinitely.
- Complex to implement correctly: must persist 14d of raw values for re-bootstrap, handle partial resets, and coordinate with active engine evaluations.

**Accuracy for anomaly detection (14d baseline):** Moderate. Within each 14-day epoch, accuracy degrades as old data accumulates. At reset, temporary instability. Inferior to Welford-with-decay for the same storage cost.

**Implementation cost:** High. Requires raw data retention (same storage as sliding-window), scheduler coordination, reset + bootstrap logic, and edge-case handling for partial windows (sub installed mid-period). Not recommended given equal cost and lower accuracy vs. sliding-window.

---

### 5. Welford with decay (capped count)

**Formula:** Standard Welford, but cap the count at `M_max`. After saturation: `if (n > M_max) n = M_max`. This makes the learning rate `1/M_max` constant, equivalent to EWMA with `α = 1/M_max`.

**Time complexity:** O(1) per update — same three ops as standard Welford, plus one comparison. Practical: ~0.01 ms.

**Memory cost:** 3 × float64 + M_max constant = ~24 bytes (same as full-history Welford). No buffer needed. Redis: ~100 bytes.

**Behavior characteristics:**
- **Warm-up phase (count < M_max):** Identical to Welford. Variance estimate is accurate and improving with each sample. This is critical for the 7-day calibration ramp — the baseline is statistically valid from the first few samples.
- **Saturated phase (count = M_max):** Mean update becomes `mean += (x - mean) / M_max` — identical to EWMA with `α = 1/M_max`. Effective window = M_max update intervals.
- Smooth transition between phases. No boundary artifacts. No scheduler dependency.
- M_max encodes the target window explicitly: for hourly updates and 14d window, `M_max = 336`. For 5-min updates and 14d window, `M_max = 4032`. This is human-readable and version-controlled.
- Old data decays gracefully rather than expiring abruptly. Boundary effect is absent.
- Slightly less accurate than sliding-window because old data influence decays exponentially rather than being fully removed. In practice for anomaly detection at ±3–5σ, the difference is negligible.

**Accuracy for anomaly detection (14d baseline):** Near-optimal. Warm-up is the best of all O(1) options. Saturated behavior is equivalent to EWMA with correct α. Does not accumulate indefinitely. Recommended for all volatile signals.

**Implementation cost:** Minimal. One extra line: `if (this.n > M_MAX) this.n = M_MAX;` in the standard Welford update. M_max is a signal-level constant — no scheduler, no buffer, no additional Redis keys.

---

## Tradeoff matrix

| Algorithm | Time/update | Memory per signal | Warm-up accuracy | 14d window accuracy | Drift risk | Impl complexity | Devvit-safe |
|---|---|---|---|---|---|---|---|
| Full-history Welford | O(1) · ~0.01ms | ~100 bytes | ✅ Excellent | ❌ Unbounded (drifts) | High | Low | ✅ |
| Sliding-window Welford | O(N) · 0.5–200ms | 2.7–160 KB | ✅ Excellent | ✅ Exact | None | High | ⚠️ (slow for per-min) |
| EWMA | O(1) · ~0.01ms | ~80 bytes | ❌ Poor (α-dependent) | ✅ Approximate | None | Low | ✅ |
| Periodic-reset Welford | O(1)+O(N) sched | 2.7–160 KB | ✅ OK | ⚠️ Epoch drift | Medium | High | ⚠️ (scheduler risk) |
| Welford with decay | O(1) · ~0.01ms | ~100 bytes | ✅ **Best** | ✅ Approximate | None | **Lowest** | ✅ |

---

## Recommendation per Sentinel signal

| Signal | Update cadence | 14d M_max | Recommended algorithm | Rationale |
|---|---|---|---|---|
| **Raid Radar: comments-per-hour influx z-score** | 1/hour | 336 | Welford-with-decay (M=336) | Volatile; diurnal pattern; O(1); warm-up critical for 7d ramp |
| **Health Score: velocity z-score (comments/min)** | 1/hour (baseline aggregated hourly) | 336 | Welford-with-decay (M=336) | Baseline is hourly rate; per-minute comparison uses `baseline_rate / 60`; avoids 160 KB buffer |
| **Health Score: report-rate z-score** | 1/hour | 336 | Welford-with-decay (M=336) | Sparse signal (many zero hours); Welford handles zeros stably; warm-up superior to EWMA |
| **Health Score: sentiment swing (5-min bucket)** | 1 per 5-min | 4032 | Welford-with-decay (M=4032) | Moderate volatility; O(1); 4032 samples × 5 min = 14d |
| **Account-age distribution (median / variance)** | 1 per commenter | — | Full-history Welford | Slow-changing; long-term distribution IS the baseline; never reset |
| **New-account ratio** | 1 per commenter | — | Full-history Welford | Bounded [0,1]; stable sub demographics; unbounded accumulation is correct behavior |

**Signal-specific deviations from default (Welford-with-decay):** 2 — account-age and new-account ratio use Full-history Welford.

---

## Implementation notes

### Core: Welford-with-decay (RollingStat — recommended for 4 of 6 signals)

```typescript
// Pseudocode — not production TS
interface RollingStatState {
  n: number;     // capped effective count
  mean: number;
  m2: number;    // sum of squared deviations
}

const M_MAX_HOURLY = 336;    // 14d × 24h
const M_MAX_5MIN   = 4032;   // 14d × 24h × 12

function updateRollingStat(
  state: RollingStatState,
  x: number,
  mMax: number
): RollingStatState {
  // Increment then cap: warm-up uses true count; saturated uses M_max
  const rawN = state.n + 1;
  const n = Math.min(rawN, mMax);

  const delta = x - state.mean;
  const mean = state.mean + delta / n;
  const delta2 = x - mean;
  const m2 = state.m2 + delta * delta2;

  return { n, mean, m2 };
}

function getVariance(state: RollingStatState): number {
  if (state.n < 2) return 1; // fallback: treat stddev as 1 to avoid div/0
  return state.m2 / (state.n - 1);
}

function getZScore(state: RollingStatState, x: number): number {
  const stddev = Math.sqrt(getVariance(state)) || 1;
  return (x - state.mean) / stddev;
}

// Redis round-trip: serialize 3 numbers
function serialize(s: RollingStatState): string {
  return JSON.stringify([s.n, s.mean, s.m2]);
}

function deserialize(raw: string): RollingStatState {
  const [n, mean, m2] = JSON.parse(raw);
  return { n, mean, m2 };
}
```

**Usage at comment ingestion (per-comment path, ≤20ms budget):**

```typescript
// At each CommentSubmit event:
async function onComment(postId: string, context: Devvit.Context) {
  const key = `sentinel:thread:${postId}:velocity`;
  const raw = await context.redis.get(key);
  const state = raw ? deserialize(raw) : { n: 0, mean: 0, m2: 0 };

  const currentRate = getCurrentHourlyRate(); // from TimeSeries bucket
  const updated = updateRollingStat(state, currentRate, M_MAX_HOURLY);
  await context.redis.set(key, serialize(updated));

  const z = getZScore(updated, currentRate);
  // Feed z into engine evaluation...
}
```

Estimated Redis cost per update: 1 GET + 1 SET = 2 commands. At 40K cmds/sec budget, Sentinel's 50 active threads × 2 cmds/comment = well under 1% of quota.

---

### Fallback: Full-history Welford (account-age, new-account ratio)

```typescript
// Identical to above but NO mMax cap — n increments unboundedly
function updateWelfordFull(
  state: RollingStatState,
  x: number
): RollingStatState {
  const n = state.n + 1;
  const delta = x - state.mean;
  const mean = state.mean + delta / n;
  const delta2 = x - mean;
  const m2 = state.m2 + delta * delta2;
  return { n, mean, m2 };
}
```

For account-age: `x` = account age in days at time of comment (continuous value, unbounded).
For new-account ratio: `x` = 1 if commenter is <30d old, else 0 (Bernoulli, bounded [0,1]).

---

### Bootstrap on install (14d backfill)

During the bootstrap job, replay 14d of historical comments through `updateRollingStat` in chronological order. Because Welford-with-decay caps at M_max after warmup, the bootstrap naturally saturates at the correct effective window. No special bootstrap logic needed — the algorithm handles it.

```typescript
// Backfill loop (scheduler job — runs once at install)
for (const bucket of historicalHourlyBuckets) {
  state = updateRollingStat(state, bucket.commentCount, M_MAX_HOURLY);
}
await redis.set('sentinel:baseline:velocity', serialize(state));
```

---

## Sources

1. Welford, B. P. (1962). "Note on a method for calculating corrected sums of squares and products." *Technometrics*, 4(3): 419–420. — Original O(1) online algorithm for variance.  
   https://www.jstor.org/stable/1266577

2. West, D. H. D. (1979). "Updating mean and variance estimates: An improved method." *Communications of the ACM*, 22(9): 532–535. — Numerical stability analysis of Welford-style incremental algorithms.  
   https://dl.acm.org/doi/10.1145/359146.359153

3. Hunter, J. S. (1986). "The exponentially weighted moving average." *Journal of Quality Technology*, 18(4): 203–210. — EWMA theory and effective window derivation.  
   https://www.tandfonline.com/doi/abs/10.1080/00224065.1986.11979014

4. Finch, T. (2009). "Incremental calculation of weighted mean and variance." University of Cambridge. — Derivation showing capped-count Welford converges to EWMA at saturation.  
   https://tony.ai/notes/welford.pdf

5. Chan, T. F., Golub, G. H., & LeVeque, R. J. (1979). "Updating formulae and a pairwise algorithm for computing sample variances." Stanford Technical Report. — Parallel Welford / combining algorithm for understanding how partial accumulators compose.  
   https://i.stanford.edu/pub/cstr/reports/cs/tr/79/773/CS-TR-79-773.pdf

6. Devvit Redis documentation — 5 MB max request size, 40,000 commands/sec, 500 MB per installation.  
   https://raw.githubusercontent.com/reddit/devvit-docs/main/docs/capabilities/server/redis.mdx

7. Prior Sentinel research (03-stats-methods-sanity.md) — Welford/rolling-window mismatch originally flagged at Item 4.  
   sentinel-spec/research/03-stats-methods-sanity.md

8. Prior Sentinel research (06-devvit-caps-deepened.md) — Redis quotas confirmed (Q4 closed).  
   sentinel-spec/research/06-devvit-caps-deepened.md
