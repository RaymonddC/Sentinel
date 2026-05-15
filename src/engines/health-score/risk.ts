import { clamp, sigmoid } from '../../lib/math.js';
import { TimeSeries } from '../../storage/time-series.js';
import type { SubBaseline, ThreadState } from '../../types/graph.js';
import type { SignalSnapshot } from '../../types/signals.js';
import { newAccountRatio, reportRateZ, sentimentSwing, velocityZ } from './signals.js';

export interface RiskBreakdown {
  score: number; // 0..100
  baseScore: number;
  trajectorySlope: number;
  amplifier: number;
  signals: SignalSnapshot[];
}

export function calculateThreadRisk(thread: ThreadState, baseline: SubBaseline, now: number): RiskBreakdown {
  const v = velocityZ(thread, baseline, now);
  const s = sentimentSwing(thread, now);
  const n = newAccountRatio(thread);
  const r = reportRateZ(thread, baseline, now);

  const sigVel = sigmoid(v.z - 3);
  const sigSent = clamp(s.swing / 1.5, 0, 1);
  const sigNew = clamp(n.ratio / 0.5, 0, 1);
  const sigRep = sigmoid(r.z - 4);

  const baseScore = sigVel * 0.30 + sigSent * 0.25 + sigNew * 0.20 + sigRep * 0.25;

  const traj = TimeSeries.fromJSON(thread.riskHistory, 'avg');
  const slopeRaw = traj.slopeOverLastHour(now);
  const amplifier = slopeRaw > 0 ? 1 + Math.min(slopeRaw, 0.3) : 1;

  const score = clamp(baseScore * amplifier * 100, 0, 100);
  return {
    score,
    baseScore,
    trajectorySlope: slopeRaw,
    amplifier,
    signals: [v.signal, s.signal, n.signal, r.signal],
  };
}
