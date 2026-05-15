import { BUCKETS_PER_DAY, BUCKET_MS, MS_PER_HOUR } from '../lib/time.js';
import { slope } from '../lib/math.js';
import type { RollingStat } from './rolling-stat.js';

export interface TimeSeriesJSON {
  buckets: number[];
  counts: number[];        // sample count per bucket (so mode='avg' works)
  head: number;            // current bucket index in the ring
  headBucketTs: number;    // unix ms at start of current bucket
  mode: 'sum' | 'avg';
}

// Ring buffer of 288 5-minute buckets covering the last 24 h.
// 'sum' tracks total per bucket (used for velocity, report rate counts).
// 'avg' tracks mean per bucket (used for sentiment).
export class TimeSeries {
  static readonly LENGTH = BUCKETS_PER_DAY;

  private buckets: number[];
  private counts: number[];
  private head: number;
  private headBucketTs: number;
  private mode: 'sum' | 'avg';

  constructor(mode: 'sum' | 'avg' = 'sum') {
    this.buckets = new Array(TimeSeries.LENGTH).fill(0);
    this.counts = new Array(TimeSeries.LENGTH).fill(0);
    this.head = 0;
    this.headBucketTs = 0;
    this.mode = mode;
  }

  static fromJSON(json: TimeSeriesJSON | undefined, mode: 'sum' | 'avg' = 'sum'): TimeSeries {
    const ts = new TimeSeries(mode);
    if (!json) return ts;
    ts.buckets = json.buckets.slice(0, TimeSeries.LENGTH);
    while (ts.buckets.length < TimeSeries.LENGTH) ts.buckets.push(0);
    ts.counts = (json.counts ?? new Array(TimeSeries.LENGTH).fill(0)).slice(0, TimeSeries.LENGTH);
    while (ts.counts.length < TimeSeries.LENGTH) ts.counts.push(0);
    ts.head = json.head;
    ts.headBucketTs = json.headBucketTs;
    ts.mode = json.mode ?? mode;
    return ts;
  }

  toJSON(): TimeSeriesJSON {
    return {
      buckets: this.buckets.slice(),
      counts: this.counts.slice(),
      head: this.head,
      headBucketTs: this.headBucketTs,
      mode: this.mode,
    };
  }

  /** Advance the ring head to cover `timestamp`, zeroing any skipped buckets. */
  private advance(timestamp: number): void {
    const targetBucketTs = Math.floor(timestamp / BUCKET_MS) * BUCKET_MS;
    if (this.headBucketTs === 0) {
      this.headBucketTs = targetBucketTs;
      return;
    }
    let steps = Math.floor((targetBucketTs - this.headBucketTs) / BUCKET_MS);
    if (steps <= 0) return;
    if (steps >= TimeSeries.LENGTH) {
      this.buckets.fill(0);
      this.counts.fill(0);
      this.head = 0;
      this.headBucketTs = targetBucketTs;
      return;
    }
    while (steps-- > 0) {
      this.head = (this.head + 1) % TimeSeries.LENGTH;
      this.buckets[this.head] = 0;
      this.counts[this.head] = 0;
      this.headBucketTs += BUCKET_MS;
    }
  }

  add(value: number, timestamp: number): void {
    if (!Number.isFinite(value)) return;
    this.advance(timestamp);
    if (this.mode === 'sum') {
      this.buckets[this.head]! += value;
      this.counts[this.head]! += 1;
    } else {
      // running mean per bucket
      const n = this.counts[this.head]! + 1;
      const prev = this.buckets[this.head]!;
      this.buckets[this.head] = prev + (value - prev) / n;
      this.counts[this.head] = n;
    }
  }

  /** Return the most recent `windowMs` worth of buckets, oldest → newest. */
  private window(windowMs: number, nowMs: number): { values: number[]; counts: number[] } {
    this.advance(nowMs);
    const span = Math.min(TimeSeries.LENGTH, Math.max(1, Math.ceil(windowMs / BUCKET_MS)));
    const values: number[] = new Array(span);
    const counts: number[] = new Array(span);
    for (let i = 0; i < span; i++) {
      const idx = (this.head - (span - 1 - i) + TimeSeries.LENGTH) % TimeSeries.LENGTH;
      values[i] = this.buckets[idx]!;
      counts[i] = this.counts[idx]!;
    }
    return { values, counts };
  }

  /** Sum of bucket values within the trailing `windowMs`. */
  sum(windowMs: number, nowMs: number): number {
    const { values } = this.window(windowMs, nowMs);
    let s = 0;
    for (const v of values) s += v;
    return s;
  }

  /** Total events / unit time, where `perUnitMs` is the denominator (e.g. 60_000 = per minute). Sum mode only. */
  rate(windowMs: number, nowMs: number, perUnitMs: number): number {
    if (this.mode !== 'sum') return 0;
    const total = this.sum(windowMs, nowMs);
    return (total / windowMs) * perUnitMs;
  }

  /** Mean of bucket values within the trailing window. Sample-weighted in 'avg' mode. */
  averageOver(windowMs: number, nowMs: number): number {
    const { values, counts } = this.window(windowMs, nowMs);
    if (this.mode === 'avg') {
      let totalCount = 0;
      let sum = 0;
      for (let i = 0; i < values.length; i++) {
        const c = counts[i]!;
        if (c === 0) continue;
        sum += values[i]! * c;
        totalCount += c;
      }
      return totalCount === 0 ? 0 : sum / totalCount;
    }
    let s = 0;
    for (const v of values) s += v;
    return values.length === 0 ? 0 : s / values.length;
  }

  /**
   * Sample-weighted mean over an explicit time window `[fromMs, toMs]`.
   * For "first 30 minutes of thread", caller passes `[thread.createdAt, thread.createdAt + 30min]`.
   */
  averageBetween(fromMs: number, toMs: number, nowMs: number): number {
    this.advance(nowMs);
    const fromBucket = Math.floor(fromMs / BUCKET_MS) * BUCKET_MS;
    const toBucket = Math.floor(toMs / BUCKET_MS) * BUCKET_MS;
    let sum = 0;
    let n = 0;
    let weighted = 0;
    let count = 0;
    for (let offset = 0; offset < TimeSeries.LENGTH; offset++) {
      const bucketTs = this.headBucketTs - offset * BUCKET_MS;
      if (bucketTs < fromBucket) break;
      if (bucketTs > toBucket) continue;
      const idx = (this.head - offset + TimeSeries.LENGTH) % TimeSeries.LENGTH;
      const c = this.counts[idx]!;
      const v = this.buckets[idx]!;
      if (this.mode === 'avg') {
        if (c === 0) continue;
        weighted += v * c;
        count += c;
      } else {
        sum += v;
        n += 1;
      }
    }
    if (this.mode === 'avg') return count === 0 ? 0 : weighted / count;
    return n === 0 ? 0 : sum / n;
  }

  /** Linear regression slope of bucket values over the last `windowMs`. */
  slopeOverLast(windowMs: number, nowMs: number): number {
    const { values } = this.window(windowMs, nowMs);
    const xs = values.map((_, i) => i);
    return slope(xs, values);
  }

  slopeOverLastHour(nowMs: number): number {
    return this.slopeOverLast(MS_PER_HOUR, nowMs);
  }
}
