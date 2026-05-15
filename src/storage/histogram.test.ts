import { describe, it, expect } from 'vitest';
import { Histogram } from './histogram.js';
import { MS_PER_DAY } from '../lib/time.js';

describe('Histogram', () => {
  it('posting-time bins by hour', () => {
    const h = Histogram.postingTime24();
    h.add(0); h.add(0); h.add(23); h.add(13);
    expect(h.buckets[0]).toBe(2);
    expect(h.buckets[13]).toBe(1);
    expect(h.buckets[23]).toBe(1);
  });

  it('account-age bins by day offset', () => {
    const h = Histogram.accountAge10();
    h.add(3 * MS_PER_DAY);    // 0-7d
    h.add(20 * MS_PER_DAY);   // 7-30d
    h.add(60 * MS_PER_DAY);   // 30-90d
    h.add(20 * 365 * MS_PER_DAY); // 10y+
    expect(h.buckets[0]).toBe(1);
    expect(h.buckets[1]).toBe(1);
    expect(h.buckets[2]).toBe(1);
    expect(h.buckets[8]).toBe(1);
  });

  it('comment-length bins', () => {
    const h = Histogram.commentLength5();
    h.add(10); h.add(100); h.add(300); h.add(2000);
    expect(h.buckets[0]).toBe(1);
    expect(h.buckets[1]).toBe(1);
    expect(h.buckets[2]).toBe(1);
    expect(h.buckets[4]).toBe(1);
  });

  it('overlap is 1 for identical, 0 for disjoint', () => {
    const a = Histogram.commentLength5();
    const b = Histogram.commentLength5();
    a.add(10); a.add(10); b.add(10); b.add(10);
    expect(a.overlap(b)).toBeCloseTo(1, 6);

    const c = Histogram.commentLength5();
    const d = Histogram.commentLength5();
    c.add(10);    // bucket 0
    d.add(2000);  // bucket 4
    expect(c.overlap(d)).toBeCloseTo(0, 6);
  });

  it('entropy is 0 for one bucket, log2(N) for uniform', () => {
    const h = Histogram.commentLength5();
    h.add(10); h.add(10); h.add(10);
    expect(h.entropy()).toBe(0);
    const u = Histogram.commentLength5();
    [10, 100, 300, 700, 2000].forEach((v) => u.add(v));
    expect(u.entropy()).toBeCloseTo(Math.log2(5), 6);
  });

  it('JSON round-trip', () => {
    const h = Histogram.postingTime24();
    [0, 5, 12, 12, 23].forEach((v) => h.add(v));
    const h2 = Histogram.fromJSON(h.toJSON(), Histogram.postingTime24);
    expect(h2.buckets).toEqual(h.buckets);
    expect(h2.kind).toBe('posting-time');
  });
});
