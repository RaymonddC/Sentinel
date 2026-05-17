// performModAction / revertModAction — the Undo foundation. Per 02-architecture.md.
// Phase 0 probe E-SlowMode-API (RESOLVED static): Devvit has NO programmatic
// slow-mode API on RedditAPIClient, Subreddit, SubredditSettings, or anywhere else.
// This is the final implementation — no native API to wire in later:
//   - set a Redis flag for the thread (Sentinel's internal "recommended" state)
//   - submit a stickied mod-distinguished comment notifying the mod team
//   - capture inverse metadata so revert restores the prior state exactly.
// Mods MUST enable slow mode manually via Reddit's subreddit settings UI.

import type { Ctx } from '../types/ctx.js';
import { MS_PER_DAY, nowMs } from '../lib/time.js';
import { newAuditEntryId } from '../lib/id.js';
import { appendAudit, loadAlert, loadThread, readAudit, saveAlert, saveThread } from '../storage/redis.js';
import { log } from '../lib/logger.js';
import type { AuditEntry, ModActionInverse } from '../types/graph.js';

export interface PerformModActionParams {
  alertId?: string;
  modUsername: string;
  action: 'recommend_slow_mode' | 'filter_new_accts' | 'ban_user' | 'remove_post' | 'dismiss';
  target: { type: 'thread' | 'user' | 'sub'; id: string };
  parameters?: Record<string, unknown>;
  reason?: string;
}

export interface PerformResult {
  entryId: string;
  revertibleUntil: number;
}

const REVERT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function performModAction(context: Ctx, params: PerformModActionParams): Promise<PerformResult> {
  const now = nowMs();
  let inverse: ModActionInverse | undefined;

  if (params.action === 'recommend_slow_mode' && params.target.type === 'thread') {
    const thread = await loadThread(context.redis, params.target.id);
    if (thread) {
      inverse = {
        kind: 'slow_mode',
        threadId: params.target.id,
        previousSlowModeSeconds: thread.slowModeEnabled ? Number(params.parameters?.['intervalSeconds'] ?? 0) : 0,
      };
      await applySlowMode(context, params.target.id, Number(params.parameters?.['intervalSeconds'] ?? 300));
      thread.slowModeEnabled = true;
      thread.lastUpdated = now;
      await saveThread(context.redis, thread);
    }
  } else if (params.action === 'filter_new_accts' && params.target.type === 'thread') {
    const thread = await loadThread(context.redis, params.target.id);
    if (thread) {
      inverse = { kind: 'new_account_filter', threadId: params.target.id, previousFilterFlag: thread.newAccountFilterEnabled };
      thread.newAccountFilterEnabled = true;
      thread.lastUpdated = now;
      await saveThread(context.redis, thread);
    }
  } else if (params.action === 'ban_user' && params.target.type === 'user') {
    inverse = { kind: 'ban_user', bannedUserId: params.target.id, bannedDays: Number(params.parameters?.['days'] ?? 0) };
    try {
      const sub = await context.reddit.getCurrentSubreddit();
      const subName = sub?.name ?? '';
      await context.reddit.banUser({
        subredditName: subName,
        username: String(params.parameters?.['username'] ?? params.target.id),
        reason: params.reason ?? 'Sentinel-suggested ban (mod-confirmed)',
        duration: Number(params.parameters?.['days'] ?? 0) || undefined,
      });
    } catch (err) {
      await log(context, { level: 'warn', scope: 'mod_action', msg: 'banUser failed', err });
    }
  } else if (params.action === 'remove_post' && params.target.type === 'thread') {
    inverse = { kind: 'remove_post', removedItemId: params.target.id };
    try {
      await context.reddit.remove(params.target.id, false);
    } catch (err) {
      await log(context, { level: 'warn', scope: 'mod_action', msg: 'remove failed', err });
    }
  }

  const entry: AuditEntry = {
    entryId: newAuditEntryId(),
    ts: now,
    alertId: params.alertId,
    modUsername: params.modUsername,
    action: params.action,
    target: params.target,
    reason: params.reason,
    inverse,
    reverted: false,
    revertibleUntil: now + REVERT_WINDOW_MS,
  };
  await appendAudit(context.redis, entry);

  if (params.alertId) {
    const alert = await loadAlert(context.redis, params.alertId);
    if (alert) {
      alert.status = 'actioned';
      alert.resolvedAt = now;
      alert.resolvedBy = params.modUsername;
      alert.actionEntryId = entry.entryId;
      alert.revertibleUntil = entry.revertibleUntil;
      await saveAlert(context.redis, alert);
    }
  }

  return { entryId: entry.entryId, revertibleUntil: entry.revertibleUntil };
}

export async function revertModAction(context: Ctx, entryId: string, modUsername: string): Promise<{ ok: boolean; reason?: string }> {
  const entries = await readAudit(context.redis, 1000);
  const entry = entries.find((e) => e.entryId === entryId);
  if (!entry) return { ok: false, reason: 'not found' };
  if (entry.reverted) return { ok: false, reason: 'already reverted' };
  if (nowMs() > entry.revertibleUntil) return { ok: false, reason: 'revert window expired' };
  if (!entry.inverse) return { ok: false, reason: 'no inverse recorded' };

  try {
    switch (entry.inverse.kind) {
      case 'slow_mode': {
        if (entry.inverse.threadId) {
          await applySlowMode(context, entry.inverse.threadId, entry.inverse.previousSlowModeSeconds ?? 0);
          const thread = await loadThread(context.redis, entry.inverse.threadId);
          if (thread) {
            thread.slowModeEnabled = (entry.inverse.previousSlowModeSeconds ?? 0) > 0;
            thread.lastUpdated = nowMs();
            await saveThread(context.redis, thread);
          }
        }
        break;
      }
      case 'new_account_filter': {
        if (entry.inverse.threadId) {
          const thread = await loadThread(context.redis, entry.inverse.threadId);
          if (thread) {
            thread.newAccountFilterEnabled = entry.inverse.previousFilterFlag ?? false;
            thread.lastUpdated = nowMs();
            await saveThread(context.redis, thread);
          }
        }
        break;
      }
      case 'ban_user': {
        if (entry.inverse.bannedUserId) {
          try {
            const sub = await context.reddit.getCurrentSubreddit();
            const subName = sub?.name ?? '';
            await context.reddit.unbanUser(String(entry.inverse.bannedUserId), subName);
          } catch (err) {
            await log(context, { level: 'warn', scope: 'mod_action', msg: 'unbanUser failed', err });
          }
        }
        break;
      }
      case 'remove_post': {
        if (entry.inverse.removedItemId) {
          try {
            await context.reddit.approve(entry.inverse.removedItemId);
          } catch (err) {
            await log(context, { level: 'warn', scope: 'mod_action', msg: 'approve failed', err });
          }
        }
        break;
      }
    }
  } catch (err) {
    return { ok: false, reason: String(err) };
  }

  // We can't update the prior list entry in-place via the typical list API; append a
  // synthetic revert entry so the timeline is honest and the original is implicitly settled.
  const revertEntry: AuditEntry = {
    entryId: newAuditEntryId(),
    ts: nowMs(),
    alertId: entry.alertId,
    modUsername,
    action: `revert:${entry.action}`,
    target: entry.target,
    reason: `Reverted ${entry.entryId}`,
    reverted: false,
    revertibleUntil: 0,
  };
  await appendAudit(context.redis, revertEntry);

  if (entry.alertId) {
    const alert = await loadAlert(context.redis, entry.alertId);
    if (alert) {
      alert.status = 'open';
      alert.actionEntryId = undefined;
      alert.revertibleUntil = 0;
      await saveAlert(context.redis, alert);
    }
  }

  return { ok: true };
}

/**
 * Slow-mode recommendation: set a Redis flag and post a stickied mod-distinguished comment
 * so the mod team knows this thread is flagged. Devvit has no programmatic slow-mode API
 * (Phase 0 probe E-SlowMode-API, RESOLVED). A mod must manually enable slow mode via
 * Reddit's subreddit settings UI.
 */
async function applySlowMode(context: Ctx, postId: string, intervalSeconds: number): Promise<void> {
  if (intervalSeconds > 0) {
    await context.redis.set(`sentinel:thread:${postId}:slow_mode`, String(intervalSeconds), {
      expiration: new Date(nowMs() + MS_PER_DAY),
    });
    try {
      const post = await context.reddit.getPostById(postId);
      const comment = await post.addComment({
        text: `🛡️ Sentinel: slow mode recommended for this thread (${intervalSeconds}s interval). Sentinel cannot enable slow mode programmatically — a mod must enable it manually via subreddit settings. This recommendation can be cleared in the Sentinel dashboard within 24h.`,
      });
      try { await comment.distinguish(true); } catch {}
    } catch (err) {
      await log(context, { level: 'warn', scope: 'mod_action', msg: 'slow-mode marker comment failed', err });
    }
  } else {
    await context.redis.del(`sentinel:thread:${postId}:slow_mode`);
  }
}
