// dispatchAlert — 7-step idempotent flow per 02-architecture.md § Alert dispatcher.
// Steps 1-3 are atomic via WATCH/MULTI/EXEC. Steps 4-7 are idempotent and
// safe to replay on crash recovery (refresh-thread-health every-5m tick).

import type { Ctx } from '../types/ctx.js';
import { k } from '../storage/keys.js';
import { loadAlert, saveAlert, appendAuditDeterministic, hasAuditEntry } from '../storage/redis.js';
import { runTx } from '../storage/transactions.js';
import { nowMs } from '../lib/time.js';
import type { Alert, AuditEntry } from '../types/graph.js';
import { engineCopy } from './messages.js';
import { withinQuietHours } from './quiet-hours.js';
import { loadSettings } from '../storage/redis.js';

/** Deterministic audit-entry id for the "alert raised" record. Replays no-op. */
function alertRaisedEntryId(alertId: string): string {
  return `audit:alert_raised:${alertId}`;
}

export async function dispatchAlert(context: Ctx, alert: Alert): Promise<void> {
  alert.dispatchState = 'pending';
  alert.status = 'open';
  alert.revertibleUntil = 0;

  // Steps 1-3: atomic multi-key write — persist alert + zAdd open + hSet by-target.
  // On WATCH conflict (concurrent dispatch for the same target), retry up to 3x.
  const txResult = await runTx(
    context.redis,
    [k.alert(alert.alertId), k.alertsOpen(), k.alertsByTarget(alert.targetId)],
    async (tx) => {
      await tx.set(k.alert(alert.alertId), JSON.stringify(alert));
      await tx.zAdd(k.alertsOpen(), { member: alert.alertId, score: alert.triggeredAt });
      await tx.hSet(k.alertsByTarget(alert.targetId), { [alert.alertId]: '1' });
    },
  );
  if (!txResult.ok) {
    console.warn('[sentinel] dispatch tx failed for', alert.alertId, txResult.failure);
    // Fall through — idempotent steps 4-7 will pick up where we left off on replay.
    return;
  }

  // Step 4: append audit-log entry with a deterministic id so replays are no-ops.
  const entryId = alertRaisedEntryId(alert.alertId);
  if (!(await hasAuditEntry(context.redis, entryId))) {
    const audit: AuditEntry = {
      entryId,
      ts: alert.triggeredAt,
      alertId: alert.alertId,
      modUsername: 'sentinel',
      engineName: alert.engineName,
      action: `alert_raised:${alert.engineName}:${alert.severity}`,
      target: { type: alert.targetType, id: alert.targetId },
      reason: alert.evidence,
      reverted: false,
      revertibleUntil: 0,
    };
    await appendAuditDeterministic(context.redis, audit);
  }

  // Step 5: dashboard re-render is implicit (custom post reads Redis on render).

  // Step 6: modmail on critical, dedup-keyed by alertId. Respect quiet hours.
  if (alert.severity === 'critical') {
    const settings = await loadSettings(context.redis);
    const sentKey = k.modmailSent(alert.alertId);
    const already = await context.redis.get(sentKey);
    const quiet = withinQuietHours(settings, nowMs());
    if (!already && settings.alertChannels.modmailCritical && !quiet) {
      try {
        const sub = await context.reddit.getSubredditById(alert.subId);
        if (sub) {
          const { subject, body } = engineCopy(alert);
          await context.reddit.modMail.createConversation({
            subredditName: sub.name,
            subject,
            body,
            to: undefined,
            isAuthorHidden: false,
          });
          await context.redis.set(sentKey, String(nowMs()), {
            expiration: new Date(nowMs() + 30 * 24 * 60 * 60 * 1000),
          });
        }
      } catch (err) {
        console.warn('[sentinel] modmail send failed', err);
      }
    }
  }

  // Step 7: mark dispatch complete.
  const fresh = await loadAlert(context.redis, alert.alertId);
  if (fresh) {
    fresh.dispatchState = 'complete';
    await saveAlert(context.redis, fresh);
  }
}
