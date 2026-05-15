import { clamp } from '../../lib/math.js';
import { TimeSeries } from '../../storage/time-series.js';
import type { SubSettings } from '../../types/settings.js';
import type { ThreadState } from '../../types/graph.js';

export interface Forecast {
  in1Hour: { risk: number; commentsExpected: number };
  in2Hours: { risk: number; commentsExpected: number };
  ifMitigated: { risk1h: number; risk2h: number };
}

export function forecastThread(thread: ThreadState, currentRisk: number, settings: SubSettings, now: number): Forecast {
  const riskHistory = TimeSeries.fromJSON(thread.riskHistory, 'avg');
  const velocity = TimeSeries.fromJSON(thread.velocity, 'sum');
  const slope = riskHistory.slopeOverLastHour(now); // risk-units per bucket (5 min)
  const cpm = velocity.rate(30 * 60 * 1000, now, 60_000);

  const projected1h = clamp(currentRisk + slope * 12, 0, 100); // 12 buckets in 1h
  const projected2h = clamp(currentRisk + slope * 24, 0, 100);

  const slowModeImpact = settings.advanced.slowModeVelocityImpact ?? 0.7;
  const mitigatedSlope = slope * (1 - slowModeImpact);
  const mit1h = clamp(currentRisk + mitigatedSlope * 12, 0, 100);
  const mit2h = clamp(currentRisk + mitigatedSlope * 24, 0, 100);

  return {
    in1Hour: { risk: projected1h, commentsExpected: Math.round(cpm * 60) },
    in2Hours: { risk: projected2h, commentsExpected: Math.round(cpm * 120) },
    ifMitigated: { risk1h: mit1h, risk2h: mit2h },
  };
}
