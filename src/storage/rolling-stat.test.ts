import { describe, it, expect } from 'vitest';
import { RollingStat } from './rolling-stat.js';

describe('RollingStat', () => {
  it('matches full Welford during warm-up', () => {
    const r = new RollingStat();
    const vals = [2, 4, 4, 4, 5, 5, 7, 9];
    vals.forEach((v) => r.push(v));
    expect(r.mean).toBeCloseTo(5, 6);
    // Population stddev = 2; sample (n-1) ≈ 2.138
    expect(r.stddev).toBeCloseTo(2.138, 2);
  });

  it('zScore returns (value - mean) / (stddev || 1)', () => {
    const r = new RollingStat();
    [10, 10, 10, 10].forEach((v) => r.push(v));
    // All same → stddev = 0; zScore = (value - mean) / 1
    expect(r.zScore(13)).toBe(3);
  });

  it('cap mMax saturates the count (decay phase)', () => {
    const r = new RollingStat(5);
    for (let i = 0; i < 100; i++) r.push(1);
    expect(r.n).toBe(5);
    // Pushing a new value at saturation: mean updates with α = 1/5
    r.push(6);
    // Expected: mean = old + (6 - old) / 5 = 1 + 5/5 = 2
    expect(r.mean).toBeCloseTo(2, 6);
  });

  it('survives JSON round-trip', () => {
    const r = new RollingStat(RollingStat.M_MAX_HOURLY);
    [1, 2, 3, 4, 5].forEach((v) => r.push(v));
    const j = r.toJSON();
    const r2 = RollingStat.fromJSON(j);
    expect(r2.mean).toBe(r.mean);
    expect(r2.stddev).toBe(r.stddev);
    expect(r2.mMax).toBe(r.mMax);
    expect(r2.n).toBe(r.n);
  });

  it('rejects non-finite values', () => {
    const r = new RollingStat();
    r.push(NaN);
    r.push(Infinity);
    expect(r.n).toBe(0);
  });
});
