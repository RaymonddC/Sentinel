import { RollingStat } from '../../storage/rolling-stat.js';
import { TimeSeries } from '../../storage/time-series.js';
import type { SubBaseline, ThreadState } from '../../types/graph.js';
import type { SignalSnapshot } from '../../types/signals.js';

const MS_PER_HOUR = 60 * 60 * 1000;

export function velocityZ(thread: ThreadState, baseline: SubBaseline, now: number): { z: number; signal: SignalSnapshot } {
  const stat = RollingStat.fromJSON(baseline.commentsPerHour, RollingStat.M_MAX_HOURLY);
  const velocity = TimeSeries.fromJSON(thread.velocity, 'sum');
  const cpm = velocity.rate(30 * 60 * 1000, now, 60 * 1000); // comments per minute (last 30 min)
  const subTypical = stat.mean / 60; // cph → cpm
  const sigma = stat.stddev || 1;
  const z = (cpm * 60 - stat.mean) / sigma;
  return {
    z,
    signal: {
      signalId: 'health-score:velocity',
      fired: z > 3,
      strength: clamp01(z / 6),
      details: `${cpm.toFixed(1)} cpm vs sub typical ${subTypical.toFixed(1)} cpm · z=${z.toFixed(1)}σ`,
    },
  };
}

export function sentimentSwing(thread: ThreadState, now: number): { swing: number; signal: SignalSnapshot } {
  const sent = TimeSeries.fromJSON(thread.sentiment, 'avg');
  const initial = sent.averageBetween(thread.createdAt, thread.createdAt + 30 * 60 * 1000, now);
  const recent = sent.averageBetween(now - 30 * 60 * 1000, now, now);
  const swing = Math.max(0, initial - recent);
  return {
    swing,
    signal: {
      signalId: 'health-score:sentiment',
      fired: swing > 0.6,
      strength: clamp01(swing / 1.5),
      details: `swing ${swing.toFixed(2)} (init ${initial.toFixed(2)} → recent ${recent.toFixed(2)})`,
    },
  };
}

export function newAccountRatio(thread: ThreadState): { ratio: number; signal: SignalSnapshot } {
  const total = thread.uniqueCommenterIds.length;
  const ratio = total === 0 ? 0 : thread.newAccountCommenters / total;
  return {
    ratio,
    signal: {
      signalId: 'health-score:new-accounts',
      fired: ratio > 0.30,
      strength: clamp01(ratio / 0.5),
      details: `${(ratio * 100).toFixed(0)}% of commenters are new accounts`,
    },
  };
}

export function reportRateZ(thread: ThreadState, baseline: SubBaseline, now: number): { z: number; signal: SignalSnapshot } {
  const stat = RollingStat.fromJSON(baseline.reportRatePerHour, RollingStat.M_MAX_HOURLY);
  const rate = TimeSeries.fromJSON(thread.reportRate, 'sum');
  const recent = rate.rate(15 * 60 * 1000, now, MS_PER_HOUR);
  const sigma = stat.stddev || 1;
  const z = (recent - stat.mean) / sigma;
  return {
    z,
    signal: {
      signalId: 'health-score:report-rate',
      fired: z > 5,
      strength: clamp01(z / 8),
      details: `${recent.toFixed(1)} reports/h · z=${z.toFixed(1)}σ`,
    },
  };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
