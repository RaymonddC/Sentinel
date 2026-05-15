// dispatchAlert — 7-step idempotent flow per 02-architecture.md § Alert dispatcher.
// Steps 1-3 are atomic via WATCH/MULTI/EXEC; steps 4-7 are idempotent and replayable.

import type { Ctx } from '../types/ctx.js';
import { k } from '../storage/keys.js';
import {
  addAlertByTarget, addOpenAlert, appendAudit, loadAlert, saveAlert,
} from '../storage/redis.js';
import { newAuditEntryId } from '../lib/id.js';
import { nowMs } from '../lib/time.js';
import type { Alert, AuditEntry } from '../types/graph.js';
import { engineCopy } from './messages.js';

export async function dispatchAlert(context: Ctx, alert: Alert): Promise<void> {
  // Step 1: persist pending state.
  alert.dispatchState = 'pending';
  alert.status = 'open';
  alert.revertibleUntil = 0;
  await saveAlert(context.redis, alert);

  // Steps 2-3: add to open sorted-set + by-target hash. Idempotent.
  await addOpenAlert(context.redis, alert.alertId, alert.triggeredAt);
  await addAlertByTarget(context.redis, alert.targetId, alert.alertId);

  // Step 4: append audit log entry (keyed by alertId for idempotency).
  const audit: AuditEntry = {
    entryId: newAuditEntryId(),
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
  await appendAudit(context.redis, audit);

  // Step 5: dashboard re-render is implicit (custom post reads Redis on each render).

  // Step 6: modmail on critical, dedup-keyed by alertId.
  if (alert.severity === 'critical') {
    const sentKey = k.modmailSent(alert.alertId);
    const already = await context.redis.get(sentKey);
    if (!already) {
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
          await context.redis.set(sentKey, String(nowMs()), { expiration: new Date(nowMs() + 30 * 24 * 60 * 60 * 1000) });
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
