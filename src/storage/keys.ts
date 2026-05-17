// All Devvit Redis key builders. Never compose key strings inline.

export const k = {
  baseline: () => 'sentinel:baseline',
  user: (userId: string) => `sentinel:user:${userId}`,
  thread: (postId: string) => `sentinel:thread:${postId}`,
  threadLastEval: (postId: string) => `sentinel:thread:${postId}:lastEval`,
  alert: (alertId: string) => `sentinel:alert:${alertId}`,
  alertsOpen: () => 'sentinel:alerts:open',
  alertsByTarget: (targetId: string) => `sentinel:alerts:by_target:${targetId}`,
  settings: () => 'sentinel:settings',
  bannedUser: (userId: string) => `sentinel:memory:banned:${userId}`,
  bannedIds: () => 'sentinel:memory:banned_ids',
  auditLog: () => 'sentinel:audit_log',
  calibration: () => 'sentinel:calibration',
  cluster: (alertId: string) => `sentinel:cluster:${alertId}`,
  installState: () => 'sentinel:install:state',
  installWelcomed: () => 'sentinel:install:welcomed',
  watchedThreads: () => 'sentinel:watched_threads',
  modmailSent: (alertId: string) => `sentinel:dispatch:modmail:${alertId}`,
  // Running totals for KPI tiles (avoid full key scans):
  countersActiveAlerts: () => 'sentinel:counters:active_alerts',
  countersActionsToday: (yyyymmdd: string) => `sentinel:counters:actions:${yyyymmdd}`,
  // Pinned post id stored once at install.
  dashboardPostId: () => 'sentinel:dashboard_post_id',
  // Probe: tracks the last scheduler-timeout target so each press bumps +30s.
  probeSchedulerLastTarget: () => 'sentinel:probe:scheduler:last_target',
};
