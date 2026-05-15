import { describe, it, expect } from 'vitest';
import {
  clamp, sigmoid, mean, median, stddev, entropy, jaccard,
  l2Normalize, cosineSimilarity, histogramIntersection, slope,
} from './math.js';

describe('math', () => {
  it('clamp', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('sigmoid', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 6);
    expect(sigmoid(100)).toBeCloseTo(1.0, 6);
    expect(sigmoid(-100)).toBeCloseTo(0.0, 6);
  });

  it('mean / median / stddev', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(stddev([1, 1, 1, 1])).toBe(0);
    expect(stddev([1, 2, 3, 4])).toBeCloseTo(1.118, 2);
  });

  it('entropy is 0 for one bucket, log2(n) for uniform', () => {
    expect(entropy([5, 0, 0])).toBe(0);
    expect(entropy([1, 1, 1, 1])).toBeCloseTo(2.0, 6); // log2(4)
  });

  it('jaccard', () => {
    expect(jaccard([1, 2, 3], [2, 3, 4])).toBeCloseTo(2 / 4, 6);
    expect(jaccard([], [])).toBe(0);
    expect(jaccard(['a'], ['a'])).toBe(1);
  });

  it('l2Normalize unit-length', () => {
    const v = l2Normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6, 6);
    expect(v[1]).toBeCloseTo(0.8, 6);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
  });

  it('cosineSimilarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(1 / Math.SQRT2, 6);
  });

  it('histogramIntersection', () => {
    expect(histogramIntersection([0.5, 0.5], [0.5, 0.5])).toBeCloseTo(1, 6);
    expect(histogramIntersection([1, 0], [0, 1])).toBeCloseTo(0, 6);
    expect(histogramIntersection([0.6, 0.4], [0.4, 0.6])).toBeCloseTo(0.8, 6);
  });

  it('slope', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [0, 2, 4, 6, 8];
    expect(slope(xs, ys)).toBeCloseTo(2, 6);
    expect(slope([0, 1], [5, 5])).toBeCloseTo(0, 6);
  });
});
