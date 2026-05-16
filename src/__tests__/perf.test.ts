// Performance budget tests — coarse, hardware-dependent, but useful to catch
// pathological regressions. Thresholds are deliberately generous (3x spec
// budgets) since CI machines vary; tighten once real Devvit runtime numbers
// are known (Phase 0 spike).

import { describe, it, expect } from 'vitest';
import { RollingStat } from '../storage/rolling-stat.js';
import { TimeSeries } from '../storage/time-series.js';
import { Histogram } from '../storage/histogram.js';
import { scoreText } from '../engines/health-score/sentiment.js';
import {
  extractTrigrams, emptyStylometry, updateStylometry, stylometrySimilarity,
} from '../engines/memory/stylometry.js';
import { calculateThreadRisk } from '../engines/health-score/risk.js';
import { combineConfidence } from '../engines/raid-radar/confidence.js';
import type { SubBaseline, ThreadState } from '../types/graph.js';

const BASE = 1_700_000_000_000;

function makeBaseline(): SubBaseline {
  const r = new RollingStat(RollingStat.M_MAX_HOURLY);
  for (let i = 0; i < 200; i++) r.push(Math.floor(Math.random() * 30));
  return {
    subId: 'sub',
    installedAt: BASE,
    bootstrapComplete: true,
    commentsPerHour: r.toJSON(),
    postsPerHour: r.toJSON(),
    uniqueCommentersPerHour: r.toJSON(),
    newAccountsPerHour: r.toJSON(),
    reportRatePerHour: r.toJSON(),
    avgCommentLength: r.toJSON(),
    avgSentiment: new RollingStat().toJSON(),
    accountAgeDistribution: Histogram.accountAge10().toJSON(),
    topOverlappingSubs: {},
    lastUpdated: BASE,
  };
}

function makeThread(): ThreadState {
  const v = new TimeSeries('sum');
  const s = new TimeSeries('avg');
  for (let i = 0; i < 100; i++) {
    v.add(1, BASE + i * 60_000);
    s.add(Math.random() * 2 - 1, BASE + i * 60_000);
  }
  return {
    postId: 'post',
    subId: 'sub',
    title: 't',
    authorId: 'u',
    createdAt: BASE,
    commentCount: 100,
    uniqueCommenterIds: Array.from({ length: 80 }, (_, i) => `u${i}`),
    newAccountCommenters: 12,
    reportCount: 5,
    velocity: v.toJSON(),
    sentiment: s.toJSON(),
    reportRate: v.toJSON(),
    currentRisk: 40,
    riskHistory: s.toJSON(),
    isWatched: true,
    exempt: false,
    slowModeEnabled: false,
    newAccountFilterEnabled: false,
    lastUpdated: BASE + 100 * 60_000,
  };
}

describe('perf budgets (coarse)', () => {
  it('calculateThreadRisk < 50ms per call (spec budget)', () => {
    const baseline = makeBaseline();
    const thread = makeThread();
    const N = 100;
    const start = performance.now();
    for (let i = 0; i < N; i++) calculateThreadRisk(thread, baseline, BASE + 100 * 60_000);
    const ms = performance.now() - start;
    // CI tolerance: spec is <50ms per eval. We assert avg <50ms with generous CI slack.
    expect(ms / N).toBeLessThan(50);
  });

  it('scoreText (sentiment) handles 500 comments < 100ms total', () => {
    const sample = 'tbh this is amazing but also kind of terrible 😡 💯';
    const start = performance.now();
    for (let i = 0; i < 500; i++) scoreText(sample);
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(100);
  });

  it('extractTrigrams + cosine for 500-comment fingerprint pair < 20ms (Phase 0 budget)', () => {
    const a = emptyStylometry();
    const b = emptyStylometry();
    const sample = 'tbh i dont even know why people bother lol ngl 🤡';
    for (let i = 0; i < 500; i++) updateStylometry(a, sample);
    for (let i = 0; i < 500; i++) updateStylometry(b, sample + ' ' + i.toString());
    // Now measure the comparison only.
    const start = performance.now();
    const sim = stylometrySimilarity(a, b);
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(20);
    expect(sim).toBeGreaterThan(0.5);
    expect(extractTrigrams('abcd').length).toBe(2);
  });

  it('combineConfidence (raid radar) is sub-millisecond', () => {
    const signals = [
      { signalId: 'raid-radar:influx-z' as const, fired: true, strength: 0.7, details: '' },
      { signalId: 'raid-radar:age-cluster' as const, fired: true, strength: 0.6, details: '' },
      { signalId: 'raid-radar:sub-overlap' as const, fired: false, strength: 0.2, details: '' },
      { signalId: 'raid-radar:sync-timing' as const, fired: true, strength: 0.5, details: '' },
    ];
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) combineConfidence(signals);
    const ms = performance.now() - start;
    expect(ms / 10_000).toBeLessThan(0.05);
  });
});
