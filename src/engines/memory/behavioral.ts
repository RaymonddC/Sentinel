// Behavioral similarity (Signal A) — postingTime + commentLength histograms,
// subOverlap Jaccard, postingFrequency delta. Per 04-engine-memory.md.

import { Histogram } from '../../storage/histogram.js';
import { RollingStat } from '../../storage/rolling-stat.js';
import { histogramIntersection, jaccard } from '../../lib/math.js';
import type { BehavioralProfile, BannedFingerprint } from '../../types/graph.js';

function normalize(buckets: number[]): number[] {
  let t = 0;
  for (const v of buckets) t += v;
  if (t === 0) return buckets.map(() => 0);
  return buckets.map((v) => v / t);
}

export function behavioralSimilarity(a: BehavioralProfile, b: BehavioralProfile): number {
  const timeOverlap = histogramIntersection(
    normalize(a.postingTimeHistogram.slice(0, 24)),
    normalize(b.postingTimeHistogram.slice(0, 24)),
  );

  const histA = Histogram.fromJSON(a.commentLengthDist, Histogram.commentLength5);
  const histB = Histogram.fromJSON(b.commentLengthDist, Histogram.commentLength5);
  const lenOverlap = histA.overlap(histB);

  const subOverlap = jaccard(Object.keys(a.subOverlap), Object.keys(b.subOverlap));

  const freqA = RollingStat.fromJSON(a.postingFrequency);
  const freqB = RollingStat.fromJSON(b.postingFrequency);
  const maxMean = Math.max(freqA.mean, freqB.mean, 1);
  const freqDelta = Math.abs(freqA.mean - freqB.mean) / maxMean;

  return clamp01(
    timeOverlap * 0.30 +
    lenOverlap * 0.20 +
    subOverlap * 0.35 +
    (1 - freqDelta) * 0.15,
  );
}

export function behavioralSimilarityVsBanned(a: BehavioralProfile, b: BannedFingerprint): number {
  const timeOverlap = histogramIntersection(
    normalize(a.postingTimeHistogram.slice(0, 24)),
    normalize(b.postingTimeHistogram.slice(0, 24)),
  );
  const subOverlap = jaccard(Object.keys(a.subOverlap), Object.keys(b.topSubs));
  // No length-hist on the BannedFingerprint summary; we use avg-len as a degenerate equality check.
  const lenSim = 0.5; // neutral when not directly comparable
  return clamp01(
    timeOverlap * 0.40 +
    lenSim * 0.15 +
    subOverlap * 0.45,
  );
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
