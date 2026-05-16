import { Devvit } from '@devvit/public-api';
import { Dashboard } from './ui/post.js';
import { onComment, onPost, onModAction, onReport } from './ingest/index.js';
import { runP1Bootstrap, ensureBaseline } from './bootstrap/install.js';
import { setDashboardPostId, saveSettings } from './storage/redis.js';
import { refreshThreadHealth } from './scheduler/refresh-thread-health.js';
import { rollupBaseline } from './scheduler/rollup-baseline.js';
import { gcAuditLog } from './scheduler/gc-audit-log.js';
import { purgeInactiveUsers } from './scheduler/purge-inactive.js';
import { backfillJob } from './scheduler/backfill-job.js';
import { defaultSettings } from './types/settings.js';
import { k } from './storage/keys.js';
import { registerMenuItems } from './menu/items.js';

Devvit.configure({ redis: true, redditAPI: true, modLog: true, http: false });

// Devvit-level app settings (the small set the install dialog needs).
Devvit.addSettings([
  { type: 'boolean', name: 'sentinel_enabled', label: 'Sentinel enabled', defaultValue: true },
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
  { type: 'boolean', name: 'sentinel_modmail_critical', label: 'Send modmail on critical alerts', defaultValue: true },
  { type: 'boolean', name: 'sentinel_mod_notes_sync', label: 'Sync banned-index to Mod Notes', defaultValue: true },
  { type: 'boolean', name: 'sentinel_auto_slow_mode', label: 'Allow auto slow-mode on critical Raid Radar alerts (opt-in)', defaultValue: false },
  { type: 'boolean', name: 'sentinel_auto_filter_new', label: 'Allow auto filter-new-accounts on critical alerts (opt-in)', defaultValue: false },
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
    // Flag the onboarding modal as unseen so the next mod that opens the
    // dashboard sees the welcome screen.
    await context.redis.del(k.installWelcomed());

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

// Mod menu items — extracted to src/menu/items.ts. Defense-in-depth mod check
// inside every handler.
registerMenuItems();

export default Devvit;
