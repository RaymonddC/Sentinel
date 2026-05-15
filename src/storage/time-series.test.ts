import { describe, it, expect } from 'vitest';
import { TimeSeries } from './time-series.js';
import { BUCKET_MS } from '../lib/time.js';

const BASE = 1_700_000_000_000; // arbitrary anchor

describe('TimeSeries', () => {
  it('sum mode accumulates counts within a window', () => {
    const ts = new TimeSeries('sum');
    for (let i = 0; i < 6; i++) ts.add(1, BASE + i * BUCKET_MS); // 6 events spaced one bucket apart
    const now = BASE + 5 * BUCKET_MS;
    expect(ts.sum(30 * 60 * 1000, now)).toBe(6); // last 30 min = 6 buckets
  });

  it('advance zeroes skipped buckets', () => {
    const ts = new TimeSeries('sum');
    ts.add(5, BASE);
    // Skip ahead a full day → ring resets
    const future = BASE + 24 * 60 * 60 * 1000;
    ts.add(1, future);
    expect(ts.sum(60 * 60 * 1000, future)).toBe(1);
  });

  it('avg mode is sample-weighted across buckets', () => {
    const ts = new TimeSeries('avg');
    ts.add(0.5, BASE);
    ts.add(0.7, BASE);
    ts.add(-0.2, BASE + BUCKET_MS);
    const now = BASE + BUCKET_MS;
    // bucket0 mean = 0.6 (2 samples), bucket1 mean = -0.2 (1 sample)
    // sample-weighted across the two: (0.5+0.7-0.2)/3 = 0.333…
    expect(ts.averageOver(15 * 60 * 1000, now)).toBeCloseTo(0.333, 3);
  });

  it('averageBetween picks the right window', () => {
    const ts = new TimeSeries('avg');
    ts.add(1.0, BASE);                       // bucket 0
    ts.add(0.5, BASE + BUCKET_MS);           // bucket 1
    ts.add(-0.5, BASE + 5 * BUCKET_MS);      // bucket 5
    const now = BASE + 5 * BUCKET_MS;
    // [BASE, BASE + 2*BUCKET_MS] → buckets 0,1
    expect(ts.averageBetween(BASE, BASE + 2 * BUCKET_MS, now)).toBeCloseTo(0.75, 3);
    // [BASE + 4*BUCKET_MS, now] → bucket 5
    expect(ts.averageBetween(BASE + 4 * BUCKET_MS, now, now)).toBeCloseTo(-0.5, 3);
  });

  it('JSON round-trip preserves state', () => {
    const ts = new TimeSeries('sum');
    for (let i = 0; i < 10; i++) ts.add(1, BASE + i * BUCKET_MS);
    const ts2 = TimeSeries.fromJSON(ts.toJSON(), 'sum');
    const now = BASE + 9 * BUCKET_MS;
    expect(ts2.sum(60 * 60 * 1000, now)).toBe(ts.sum(60 * 60 * 1000, now));
  });

  it('slopeOverLast is approx 1 for monotonic increase', () => {
    const ts = new TimeSeries('sum');
    for (let i = 0; i < 12; i++) ts.add(i + 1, BASE + i * BUCKET_MS); // 1..12
    const now = BASE + 11 * BUCKET_MS;
    const s = ts.slopeOverLast(60 * 60 * 1000, now);
    // Slope of [1..12] vs index [0..11] = 1 exactly
    expect(s).toBeCloseTo(1, 6);
  });
});
