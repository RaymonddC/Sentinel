// Mod menu item registration. Defense in depth: every handler re-checks mod
// status via `requireMod` before acting.

import { Devvit } from '@devvit/public-api';
import type { Ctx } from '../types/ctx.js';
import { evaluateHealth } from '../engines/health-score/evaluate.js';
import { evaluateMemoryOnComment } from '../engines/memory/evaluate.js';
import { dispatchAlert } from '../alerts/dispatch.js';
import { performModAction, revertModAction } from '../alerts/mod-action.js';
import { newAlertId } from '../lib/id.js';
import { loadSettings, readAudit, saveSettings } from '../storage/redis.js';
import type { Alert } from '../types/graph.js';

async function requireMod(context: Ctx): Promise<boolean> {
  const subName = context.subredditName ?? '';
  const userId = context.userId ?? null;
  if (!subName || !userId) return false;
  try {
    const mods = await context.reddit.getModerators({ subredditName: subName }).all();
    return mods.some((m) => m.id === userId);
  } catch {
    return false;
  }
}

export function registerMenuItems(): void {
  // On a post: open the Health Score for this thread.
  Devvit.addMenuItem({
    location: 'post',
    label: '🛡️ Show Health Score',
    forUserType: 'moderator',
    onPress: async (event, context) => {
      if (!(await requireMod(context))) return;
      const result = await evaluateHealth(context, event.targetId);
      context.ui.showToast(result ? `Risk ${Math.round(result.score)} · ${result.severity}` : 'No data');
    },
  });

  // On a user: open in Sentinel + run on-demand evader check.
  Devvit.addMenuItem({
    location: 'subreddit',
    label: '🛡️ Open in Sentinel (user)',
    forUserType: 'moderator',
    onPress: async (_event, context) => {
      if (!(await requireMod(context))) return;
      context.ui.showToast('Open the Sentinel dashboard → Users tab to investigate.');
    },
  });

  // On a comment: re-run Memory evaluation against the author's fingerprint.
  Devvit.addMenuItem({
    location: 'comment',
    label: '🛡️ Check author in Sentinel',
    forUserType: 'moderator',
    onPress: async (event, context) => {
      if (!(await requireMod(context))) return;
      try {
        const comment = await context.reddit.getCommentById(event.targetId);
        const authorId = comment.authorId;
        const authorName = comment.authorName;
        if (!authorId || !authorName) return context.ui.showToast('Could not resolve author');
        await evaluateMemoryOnComment(context, {
          postId: comment.postId,
          subredditId: context.subredditId ?? '',
          subredditName: context.subredditName ?? '',
          commentId: comment.id,
          body: comment.body ?? '',
          authorId,
          authorName,
          authorCreatedAtMs: 0,
          createdAtMs: Date.now(),
        });
        context.ui.showToast('Memory check queued');
      } catch (err) {
        context.ui.showToast(`Error: ${String(err).slice(0, 80)}`);
      }
    },
  });

  // Inject test alert (mod-only) — useful for M3 verification + demo.
  Devvit.addMenuItem({
    location: 'subreddit',
    label: '🛡️ Inject test alert (Sentinel)',
    forUserType: 'moderator',
    onPress: async (_event, context) => {
      if (!(await requireMod(context))) return;
      const alert: Alert = {
        alertId: newAlertId(),
        subId: context.subredditId ?? '',
        engineName: 'raid_radar',
        severity: 'critical',
        triggeredAt: Date.now(),
        signals: [
          { signalId: 'raid-radar:influx-z', fired: true, strength: 0.92, details: 'test' },
          { signalId: 'raid-radar:age-cluster', fired: true, strength: 0.78, details: 'test' },
          { signalId: 'raid-radar:sub-overlap', fired: true, strength: 0.81, details: 'test' },
          { signalId: 'raid-radar:sync-timing', fired: false, strength: 0.2, details: 'test' },
        ],
        confidence: 0.89,
        targetType: 'thread',
        targetId: 'test_thread',
        title: 'Test brigade (injected)',
        evidence: 'Mod-injected test alert — verify dashboard rendering and audit flow.',
        payload: {
          cluster: Array.from({ length: 12 }, (_, i) => ({ userId: `u${i}`, username: `u/test_${i}` })),
          overflow: 0,
          topExternalSub: 'test_external',
        },
        status: 'open',
        revertibleUntil: 0,
        dispatchState: 'pending',
      };
      await dispatchAlert(context, alert);
      context.ui.showToast('Test alert injected');
    },
  });

  // Revert most-recent reversible action.
  Devvit.addMenuItem({
    location: 'subreddit',
    label: '🛡️ Sentinel: revert last action',
    forUserType: 'moderator',
    onPress: async (_event, context) => {
      if (!(await requireMod(context))) return;
      const audit = await readAudit(context.redis, 20);
      const reversible = audit.find((e) => !e.reverted && Date.now() < e.revertibleUntil && e.inverse);
      if (!reversible) return context.ui.showToast('Nothing to revert');
      const result = await revertModAction(context, reversible.entryId, context.userId ?? 'unknown');
      context.ui.showToast(result.ok ? 'Reverted' : `Revert failed: ${result.reason ?? ''}`);
    },
  });

  // Toggle master switch.
  Devvit.addMenuItem({
    location: 'subreddit',
    label: '🛡️ Sentinel: toggle master switch',
    forUserType: 'moderator',
    onPress: async (_event, context) => {
      if (!(await requireMod(context))) return;
      const settings = await loadSettings(context.redis);
      settings.enabled = !settings.enabled;
      await saveSettings(context.redis, settings);
      context.ui.showToast(`Sentinel is now ${settings.enabled ? 'ON' : 'OFF'}`);
    },
  });

  // Silence the linter on unused imports for symbols re-exported below.
  void performModAction;
}
