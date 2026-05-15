import type { Ctx } from '../../types/ctx.js';
import { HEALTH_SCORE_CUTOFFS } from '../../types/settings.js';
import { loadAlert, loadBaseline, loadCalibration, loadSettings, loadThread, saveCalibration, saveThread, listAlertsByTarget } from '../../storage/redis.js';
import { TimeSeries } from '../../storage/time-series.js';
import { calculateThreadRisk } from './risk.js';
import { forecastThread } from './forecast.js';
import { dispatchAlert } from '../../alerts/dispatch.js';
import { newAlertId } from '../../lib/id.js';
import { MS_PER_DAY, nowMs } from '../../lib/time.js';
import { RAMP_DAYS } from '../../bootstrap/backfill.js';
import type { Alert, Severity } from '../../types/graph.js';

const RECENT_DUPE_WINDOW_MS = 30 * 60 * 1000;

function severityForScore(score: number): Severity {
  if (score >= HEALTH_SCORE_CUTOFFS.critical) return 'critical';
  if (score >= HEALTH_SCORE_CUTOFFS.high) return 'high';
  if (score >= HEALTH_SCORE_CUTOFFS.medium) return 'medium';
  return 'healthy';
}

export async function evaluateHealth(context: Ctx, postId: string): Promise<{ score: number; severity: Severity } | null> {
  const [thread, baseline, settings, calibration] = await Promise.all([
    loadThread(context.redis, postId),
    loadBaseline(context.redis),
    loadSettings(context.redis),
    loadCalibration(context.redis),
  ]);
  if (!thread || !baseline) return null;
  if (!settings.enabled || !settings.engines.healthScore.enabled) return null;
  if (thread.exempt) return null;

  const now = nowMs();
  const breakdown = calculateThreadRisk(thread, baseline, now);

  // Persist current risk + append to risk history so trajectory amplifier learns.
  thread.currentRisk = breakdown.score;
  const history = TimeSeries.fromJSON(thread.riskHistory, 'avg');
  history.add(breakdown.score, now);
  thread.riskHistory = history.toJSON();
  thread.lastUpdated = now;
  await saveThread(context.redis, thread);

  const severity = severityForScore(breakdown.score);
  const inRamp = now - baseline.installedAt < RAMP_DAYS * MS_PER_DAY;

  // Only alert on upward transitions to High/Critical; suppress info/healthy/medium spam.
  if (severity !== 'high' && severity !== 'critical') return { score: breakdown.score, severity };

  // Dedup
  const existingIds = await listAlertsByTarget(context.redis, postId);
  for (const id of existingIds) {
    const a = await loadAlert(context.redis, id);
    if (a && a.engineName === 'health_score' && now - a.triggeredAt < RECENT_DUPE_WINDOW_MS) return { score: breakdown.score, severity };
  }

  const forecast = forecastThread(thread, breakdown.score, settings, now);
  const evidence = `Risk on "${thread.title || 'thread'}" is ${Math.round(breakdown.score)}. ` +
    `Trajectory: ${breakdown.trajectorySlope > 0 ? 'climbing' : 'stable'}. ` +
    `Forecast 1h: no-action ${Math.round(forecast.in1Hour.risk)} · with slow mode ${Math.round(forecast.ifMitigated.risk1h)}.`;

  const alert: Alert = {
    alertId: newAlertId(),
    subId: thread.subId,
    engineName: 'health_score',
    severity: inRamp && severity === 'critical' && breakdown.score < 92 ? 'high' : severity,
    triggeredAt: now,
    signals: breakdown.signals,
    confidence: breakdown.score / 100,
    targetType: 'thread',
    targetId: postId,
    title: 'Thread risk escalating',
    evidence,
    payload: {
      score: breakdown.score,
      forecast,
      breakdown: { base: breakdown.baseScore, amplifier: breakdown.amplifier, slope: breakdown.trajectorySlope },
    },
    status: 'open',
    revertibleUntil: 0,
    dispatchState: 'pending',
  };
  await dispatchAlert(context, alert);

  calibration.totalAlerts += 1;
  await saveCalibration(context.redis, calibration);
  return { score: breakdown.score, severity };
}
