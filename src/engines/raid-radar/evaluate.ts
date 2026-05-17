// Raid Radar engine evaluation. Called from ingestComment after debounce.

import type { Ctx } from '../../types/ctx.js';
import { loadAlert, loadBaseline, loadCalibration, loadSettings, loadThread, saveCalibration } from '../../storage/redis.js';
import { dispatchAlert } from '../../alerts/dispatch.js';
import { performModAction } from '../../alerts/mod-action.js';
import { RAID_RADAR_THRESHOLDS } from '../../types/settings.js';
import { newAlertId } from '../../lib/id.js';
import { MS_PER_DAY, nowMs } from '../../lib/time.js';
import type { Alert } from '../../types/graph.js';
import {
  buildRaidContext, signalAgeCluster, signalInfluxZ, signalSubOverlap, signalSyncTiming,
} from './signals.js';
import { combineConfidence } from './confidence.js';
import { RAMP_DAYS } from '../../bootstrap/backfill.js';
import { listAlertsByTarget } from '../../storage/redis.js';

const RECENT_DUPE_WINDOW_MS = 15 * 60 * 1000;

export async function evaluateRaidRadar(context: Ctx, postId: string): Promise<void> {
  const [thread, baseline, settings, calibration] = await Promise.all([
    loadThread(context.redis, postId),
    loadBaseline(context.redis),
    loadSettings(context.redis),
    loadCalibration(context.redis),
  ]);
  if (!thread || !baseline) return;
  if (!settings.enabled || !settings.engines.raidRadar.enabled) return;
  if (thread.exempt) return;

  const now = nowMs();
  const ctx = await buildRaidContext(context, thread, now);

  const signals = [
    signalInfluxZ(ctx, baseline),
    signalAgeCluster(ctx),
    signalSubOverlap(ctx),
    signalSyncTiming(ctx, thread),
  ];

  // Per-signal threshold multipliers from calibration.
  for (const s of signals) {
    const m = calibration.perSignal[s.signalId]?.thresholdMultiplier ?? 1.0;
    s.strength = s.strength / m;
  }

  const sensitivity = settings.engines.raidRadar.sensitivity;
  let { fire: fireThreshold, autoAction: autoActionThreshold } = RAID_RADAR_THRESHOLDS[sensitivity];

  // Calibration ramp: conservative confidence + raise critical floor.
  const inRamp = now - baseline.installedAt < RAMP_DAYS * MS_PER_DAY;

  const breakdown = combineConfidence(signals);
  let confidence = breakdown.confidence;
  if (inRamp) confidence *= 0.85;
  if (confidence < fireThreshold) return;

  // Dedup: skip if we already raised an alert for this thread in the last 15 min.
  const existingIds = await listAlertsByTarget(context.redis, postId);
  for (const id of existingIds) {
    const a = await loadAlert(context.redis, id);
    if (a && a.engineName === 'raid_radar' && now - a.triggeredAt < RECENT_DUPE_WINDOW_MS) return;
  }

  const severity = (confidence > 0.9 && !inRamp) || (confidence > 0.92 && inRamp) ? 'critical' : 'high';
  const top = ctx.externalSubCounts.size > 0
    ? [...ctx.externalSubCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    : null;
  const evidence = top
    ? `${ctx.newArrivalsIds.length} new accounts overlap with r/${top[0]} on "${thread.title}".`
    : `${ctx.newArrivalsIds.length} new accounts arrived in 5 minutes on "${thread.title}".`;

  const alert: Alert = {
    alertId: newAlertId(),
    subId: thread.subId,
    engineName: 'raid_radar',
    severity,
    triggeredAt: now,
    signals,
    confidence,
    targetType: 'thread',
    targetId: postId,
    title: 'Coordinated brigade detected',
    evidence,
    payload: {
      cluster: ctx.cluster.slice(0, 20),
      overflow: Math.max(0, ctx.cluster.length - 20),
      topExternalSub: top?.[0] ?? null,
    },
    status: 'open',
    revertibleUntil: 0,
    dispatchState: 'pending',
  };
  await dispatchAlert(context, alert);

  // Auto-action (opt-in, suppressed during ramp).
  if (!inRamp &&
      settings.engines.raidRadar.autoActions.enableSlowMode &&
      confidence > autoActionThreshold) {
    await performModAction(context, {
      alertId: alert.alertId,
      modUsername: 'sentinel',
      action: 'recommend_slow_mode',
      target: { type: 'thread', id: postId },
      parameters: { intervalSeconds: 300 },
      reason: `Raid Radar auto-recommendation at ${(confidence * 100).toFixed(0)}% confidence — mod must enable slow mode manually in subreddit settings`,
    });
  }

  // Calibration bookkeeping (alerts emitted total — dismissal counters incremented elsewhere)
  calibration.totalAlerts += 1;
  await saveCalibration(context.redis, calibration);
}
