import { Devvit } from '@devvit/public-api';
import { Dashboard } from './ui/post.js';
import { onComment, onPost, onModAction, onReport } from './ingest/index.js';
import { runP1Bootstrap, ensureBaseline } from './bootstrap/install.js';
import { setDashboardPostId, getDashboardPostId, loadSettings, saveSettings } from './storage/redis.js';
import { refreshThreadHealth } from './scheduler/refresh-thread-health.js';
import { rollupBaseline } from './scheduler/rollup-baseline.js';
import { gcAuditLog } from './scheduler/gc-audit-log.js';
import { purgeInactiveUsers } from './scheduler/purge-inactive.js';
import { backfillJob } from './scheduler/backfill-job.js';
import { evaluateHealth } from './engines/health-score/evaluate.js';
import { evaluateMemoryOnComment } from './engines/memory/evaluate.js';
import { defaultSettings } from './types/settings.js';
import { performModAction, revertModAction } from './alerts/mod-action.js';
import { newAlertId } from './lib/id.js';
import { dispatchAlert } from './alerts/dispatch.js';
import type { Alert } from './types/graph.js';

Devvit.configure({ redis: true, redditAPI: true, modLog: true, http: false });

// Devvit-level app settings (the small set the install dialog needs).
Devvit.addSettings([
  {
    type: 'boolean',
    name: 'sentinel_enabled',
    label: 'Sentinel enabled',
    defaultValue: true,
  },
  {
    type: 'select',
    name: 'sentinel_sensitivity',
    label: 'Default engine sensitivity',
    options: [
      { label: 'Low — fewer alerts, higher precision', value: 'low' },
      { label: 'Medium — balanced (recommended)', value: 'medium' },
      { label: 'High — more alerts, higher recall', value: 'high' },
    ],
    defaultValue: ['medium'],
  },
  {
    type: 'boolean',
    name: 'sentinel_modmail_critical',
    label: 'Send modmail on critical alerts',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'sentinel_mod_notes_sync',
    label: 'Sync banned-index to Mod Notes',
    defaultValue: true,
  },
  {
    type: 'boolean',
    name: 'sentinel_auto_slow_mode',
    label: 'Allow auto slow-mode on critical Raid Radar alerts (opt-in)',
    defaultValue: false,
  },
  {
    type: 'boolean',
    name: 'sentinel_auto_filter_new',
    label: 'Allow auto filter-new-accounts on critical alerts (opt-in)',
    defaultValue: false,
  },
]);

// Custom post type — the pinned dashboard.
Devvit.addCustomPostType({
  name: 'Sentinel Dashboard',
  description: 'Moderation intelligence — pinned dashboard for the mod team.',
  render: Dashboard,
});

// Triggers — every Reddit event into a single ingestion module.
Devvit.addTrigger({
  event: 'CommentSubmit',
  onEvent: async (event, context) => {
    const c = event.comment;
    const a = event.author;
    if (!c || !a || !event.subreddit) return;
    await onComment(context, {
      postId: c.postId,
      postTitle: event.post?.title,
      subredditId: event.subreddit.id,
      subredditName: event.subreddit.name,
      commentId: c.id,
      body: c.body ?? '',
      authorId: a.id,
      authorName: a.name,
      // UserV2 has no createdAt — ingestComment resolves it lazily via getUserById.
      authorCreatedAtMs: 0,
      createdAtMs: c.createdAt ? new Date(c.createdAt as unknown as string).getTime() : Date.now(),
    });
  },
});

Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const p = event.post;
    const a = event.author;
    if (!p || !a || !event.subreddit) return;
    await onPost(context, {
      postId: p.id,
      title: p.title ?? '',
      authorId: a.id,
      authorName: a.name,
      subredditId: event.subreddit.id,
      subredditName: event.subreddit.name,
      createdAtMs: p.createdAt ? new Date(p.createdAt as unknown as string).getTime() : Date.now(),
      flair: p.linkFlair?.text ?? undefined,
    });
  },
});

Devvit.addTrigger({
  event: 'ModAction',
  onEvent: async (event, context) => {
    if (!event.action || !event.subreddit) return;
    await onModAction(context, {
      action: event.action,
      targetUserId: event.targetUser?.id,
      targetUserName: event.targetUser?.name,
      modName: event.moderator?.name ?? 'unknown',
      // Trigger payload doesn't expose description/details — those are on the model ModAction.
      reason: undefined,
      subredditName: event.subreddit.name,
      createdAtMs: event.actionedAt ? new Date(event.actionedAt as unknown as string).getTime() : Date.now(),
    });
  },
});

Devvit.addTrigger({
  event: 'PostReport',
  onEvent: async (event, context) => {
    if (!event.post || !event.subreddit) return;
    await onReport(context, {
      postId: event.post.id,
      subredditId: event.subreddit.id,
      createdAtMs: Date.now(),
    });
  },
});

Devvit.addTrigger({
  event: 'CommentReport',
  onEvent: async (event, context) => {
    if (!event.comment || !event.subreddit) return;
    await onReport(context, {
      postId: event.comment.postId,
      subredditId: event.subreddit.id,
      createdAtMs: Date.now(),
    });
  },
});

// App lifecycle.
Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: async (_event, context) => {
    const subName = context.subredditName ?? '';
    await ensureBaseline(context.redis, context.subredditId ?? subName);
    await saveSettings(context.redis, defaultSettings());

    // Create the pinned dashboard post.
    try {
      const post = await context.reddit.submitPost({
        subredditName: subName,
        title: '🛡️ Sentinel Dashboard — DO NOT REMOVE',
        preview: (
          <vstack height="100%" alignment="center middle" padding="large">
            <text size="medium" color="#aab2bd">Loading Sentinel…</text>
          </vstack>
        ),
      });
      try { await post.sticky(1); } catch (err) { console.warn('[sentinel] sticky failed', err); }
      await setDashboardPostId(context.redis, post.id);
    } catch (err) {
      console.warn('[sentinel] dashboard post creation failed', err);
    }

    // Schedule P1 bootstrap (non-blocking).
    try {
      await context.scheduler.runJob({ name: 'sentinel_p1_bootstrap', runAt: new Date(), data: { subredditName: subName } });
    } catch (err) {
      console.warn('[sentinel] P1 schedule failed', err);
    }
  },
});

Devvit.addTrigger({
  event: 'AppUpgrade',
  onEvent: async (_event, context) => {
    // No-op for v0.1 — settings shape stable. Keep all data intact.
    void context;
  },
});

// Scheduler jobs.
Devvit.addSchedulerJob({
  name: 'sentinel_p1_bootstrap',
  onRun: async (event, context) => {
    const subName = (event.data?.['subredditName'] as string) ?? context.subredditName ?? '';
    if (subName) {
      const stats = await runP1Bootstrap(context, subName);
      console.log('[sentinel] P1 bootstrap done', stats);
      try {
        await context.scheduler.runJob({ name: 'sentinel_backfill', cron: '0 * * * *', data: { subredditName: subName } });
      } catch (err) {
        console.warn('[sentinel] backfill schedule failed', err);
      }
    }
  },
});

Devvit.addSchedulerJob({
  name: 'sentinel_refresh_thread_health',
  onRun: async (_event, context) => { await refreshThreadHealth(context); },
});

Devvit.addSchedulerJob({
  name: 'sentinel_rollup_baseline',
  onRun: async (_event, context) => { await rollupBaseline(context); },
});

Devvit.addSchedulerJob({
  name: 'sentinel_gc_audit_log',
  onRun: async (_event, context) => { await gcAuditLog(context); },
});

Devvit.addSchedulerJob({
  name: 'sentinel_purge_inactive',
  onRun: async (_event, context) => { await purgeInactiveUsers(context); },
});

Devvit.addSchedulerJob({
  name: 'sentinel_backfill',
  onRun: async (event, context) => {
    const subName = (event.data?.['subredditName'] as string) ?? context.subredditName ?? '';
    await backfillJob(context, subName);
  },
});

// Mod menu items — defense in depth: every handler re-checks mod status.
async function requireMod(context: Devvit.Context): Promise<boolean> {
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

Devvit.addMenuItem({
  location: 'comment',
  label: '🛡️ Check author in Sentinel',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    if (!(await requireMod(context))) return;
    try {
      const comment = await context.reddit.getCommentById(event.targetId);
      const author = comment.authorId && comment.authorName ? { id: comment.authorId, name: comment.authorName } : null;
      if (!author) return context.ui.showToast('Could not resolve author');
      await evaluateMemoryOnComment(context, {
        postId: comment.postId,
        subredditId: context.subredditId ?? '',
        subredditName: context.subredditName ?? '',
        commentId: comment.id,
        body: comment.body ?? '',
        authorId: author.id,
        authorName: author.name,
        authorCreatedAtMs: 0,
        createdAtMs: Date.now(),
      });
      context.ui.showToast('Memory check queued');
    } catch (err) {
      context.ui.showToast(`Error: ${String(err).slice(0, 80)}`);
    }
  },
});

// Inject a test alert (mod-only) — useful for M3 verification.
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

// Undo last action (mod-only)
Devvit.addMenuItem({
  location: 'subreddit',
  label: '🛡️ Sentinel: revert last action',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    if (!(await requireMod(context))) return;
    const { readAudit } = await import('./storage/redis.js');
    const audit = await readAudit(context.redis, 20);
    const reversible = audit.find((e) => !e.reverted && Date.now() < e.revertibleUntil && e.inverse);
    if (!reversible) return context.ui.showToast('Nothing to revert');
    const result = await revertModAction(context, reversible.entryId, context.userId ?? 'unknown');
    context.ui.showToast(result.ok ? 'Reverted' : `Revert failed: ${result.reason ?? ''}`);
  },
});

// Settings-tab quick action: silence ourselves to fix anything broken.
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

// Boot scheduler cadences on first run via a one-off install hook? We do this
// inside AppInstall above for the backfill job; for the others we rely on the
// Devvit Studio "Scheduled jobs" UI to start the cron sequences. (Documented
// in research/09-runtime-probes.md.)

// Avoid TS unused warning on getDashboardPostId — exported for future use by
// custom-post-state propagation work.
void getDashboardPostId;

export default Devvit;
