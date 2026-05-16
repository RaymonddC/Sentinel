// Sentinel Dashboard — the one and only Devvit custom post.
// Mod-gated content; non-mods see a neutral placeholder.

import { Devvit, useState, useAsync, useInterval, type JSONValue } from '@devvit/public-api';
import { COLOR, FONT, RADIUS, ROW, SPACE } from './tokens.js';
import { loadSettings, loadAlert, listOpenAlerts, readAudit } from '../storage/redis.js';
import { listWatched } from '../engines/health-score/watched.js';
import { formatDuration, nowMs } from '../lib/time.js';
import { severityConfig } from './severity.js';
import { riskGaugeDataUrl } from './svg/risk-gauge.js';
import { clusterGraphDataUrl } from './svg/cluster-graph.js';
import { RAMP_DAYS } from '../bootstrap/backfill.js';
import { MS_PER_DAY } from '../lib/time.js';
import type { Alert, AuditEntry } from '../types/graph.js';

type TabId = 'threats' | 'users' | 'threads' | 'activity' | 'settings';

interface DashboardData {
  isMod: boolean;
  openAlertIds: string[];
  alerts: Alert[];
  audit: AuditEntry[];
  watchedCount: number;
  installedAt: number;
  bootstrapComplete: boolean;
  welcomed: boolean;
  settings: Awaited<ReturnType<typeof loadSettings>>;
  actionsToday: number;
}

async function loadDashboardData(context: Devvit.Context): Promise<DashboardData> {
  const subName = context.subredditName ?? '';
  const userId = context.userId ?? null;

  let isMod = false;
  if (userId && subName) {
    try {
      const mods = await context.reddit.getModerators({ subredditName: subName }).all();
      isMod = mods.some((m) => m.id === userId);
    } catch {
      isMod = false;
    }
  }

  if (!isMod) {
    return {
      isMod: false,
      openAlertIds: [],
      alerts: [],
      audit: [],
      watchedCount: 0,
      installedAt: 0,
      bootstrapComplete: false,
      welcomed: true,
      settings: await loadSettings(context.redis),
      actionsToday: 0,
    };
  }

  const welcomedRaw = await context.redis.get('sentinel:install:welcomed');
  const welcomed = welcomedRaw === '1';

  const [openIds, audit, settings, watched] = await Promise.all([
    listOpenAlerts(context.redis, 50),
    readAudit(context.redis, 100),
    loadSettings(context.redis),
    listWatched(context),
  ]);
  const alerts: Alert[] = [];
  for (const id of openIds) {
    const a = await loadAlert(context.redis, id);
    if (a) alerts.push(a);
  }
  // Count actions taken today (rough — UTC day boundary)
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const actionsToday = audit.filter((e) => e.ts >= startOfDay.getTime() && e.modUsername !== '' && !e.action.startsWith('alert_raised:')).length;

  // Pull installedAt from the baseline JSON via a single get (avoids loading the whole record again).
  const rawBaseline = await context.redis.get('sentinel:baseline');
  let installedAt = 0;
  let bootstrapComplete = false;
  if (rawBaseline) {
    try {
      const parsed = JSON.parse(rawBaseline) as { installedAt?: number; bootstrapComplete?: boolean };
      installedAt = parsed.installedAt ?? 0;
      bootstrapComplete = parsed.bootstrapComplete ?? false;
    } catch {
      // ignore
    }
  }

  return { isMod: true, openAlertIds: openIds, alerts, audit, watchedCount: watched.length, installedAt, bootstrapComplete, welcomed, settings, actionsToday };
}

export const Dashboard: Devvit.CustomPostComponent = (context) => {
  const [tab, setTab] = useState<TabId>('threats');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [tick, setTick] = useState<number>(0);
  const [welcomedThisSession, setWelcomedThisSession] = useState<boolean>(false);

  // 30-second live polling: incrementing tick triggers useAsync to re-fetch.
  const interval = useInterval(() => { setTick((t) => t + 1); }, 30_000);

  // The loaded data is JSON-shaped at runtime but TypeScript can't infer the index
  // signature from our nominal type. Cast through unknown at the boundary.
  const { data, loading } = useAsync(async () => (await loadDashboardData(context)) as unknown as JSONValue, { depends: [tab, tick] });
  const dash = data as unknown as DashboardData | null;

  if (loading || !dash) {
    return (
      <vstack height="100%" padding="medium" backgroundColor={COLOR.bgPanel} gap="small">
        <text size="small" color={COLOR.fg2}>Loading Sentinel…</text>
      </vstack>
    );
  }

  if (!dash.isMod) {
    return (
      <vstack height="100%" padding="large" backgroundColor={COLOR.bgPanel} gap="small" alignment="center middle">
        <text size="xlarge" weight="bold" color={COLOR.fg0}>🛡 Sentinel</text>
        <text size="medium" color={COLOR.fg1}>Moderation intelligence is active on this subreddit.</text>
        <text size="xsmall" color={COLOR.fg2}>Visible to mods only. Updated automatically.</text>
      </vstack>
    );
  }

  // First-run onboarding modal. Flips the welcomed flag and falls through to the
  // normal dashboard on press. Gated by sentinel:install:welcomed key per the
  // ultraplan; same key is cleared on every AppInstall trigger.
  // welcomedThisSession lets the UI flip immediately on button press without a
  // full round-trip back to Redis.
  if (!dash.welcomed && !welcomedThisSession) {
    return (
      <WelcomeScreen
        onGetStarted={async () => {
          await context.redis.set('sentinel:install:welcomed', '1');
          setWelcomedThisSession(true);
        }}
      />
    );
  }

  // Past the welcome screen — start live 30-second polling.
  interval.start();

  const showBanner = !dash.bootstrapComplete && !bannerDismissed && dash.installedAt > 0 && nowMs() - dash.installedAt < RAMP_DAYS * MS_PER_DAY;
  const openCount = dash.alerts.filter((a) => a.status === 'open').length;
  const criticalCount = dash.alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length;
  const timeSavedMinutes = dash.actionsToday * dash.settings.advanced.timeSavedPerAction;

  return (
    <vstack height="100%" backgroundColor={COLOR.bgPanel}>
      <Header openCount={openCount} criticalCount={criticalCount} />
      <TabBar active={tab} onChange={setTab} openCount={openCount} criticalCount={criticalCount} />
      {showBanner && <CalibrationBanner onDismiss={() => setBannerDismissed(true)} />}
      <vstack padding="medium" gap="small" grow>
        {tab === 'threats' && <ThreatsTab alerts={dash.alerts} expandedId={expandedId} onToggle={(id) => setExpandedId(expandedId === id ? null : id)} />}
        {tab === 'users' && <UsersTab alerts={dash.alerts} />}
        {tab === 'threads' && <ThreadsTab watchedCount={dash.watchedCount} />}
        {tab === 'activity' && <ActivityTab audit={dash.audit} />}
        {tab === 'settings' && <SettingsTab settings={dash.settings} />}
      </vstack>
      <Kpis activeCount={openCount} watchedCount={dash.watchedCount} actionsToday={dash.actionsToday} timeSavedMinutes={timeSavedMinutes} />
    </vstack>
  );
};

const Header = ({ openCount, criticalCount }: { openCount: number; criticalCount: number }) => (
  <hstack padding="small" gap="small" backgroundColor={COLOR.bgPanel} alignment="middle">
    <text size="medium" weight="bold" color={COLOR.fg0}>🛡 Sentinel · moderation intelligence</text>
    <spacer grow />
    <text size="small" color={COLOR.fg2}>{openCount} alerts</text>
    {criticalCount > 0 && <text size="small" color={COLOR.sevCritical}>· {criticalCount} critical</text>}
  </hstack>
);

const TabBar = ({ active, onChange, openCount, criticalCount }: { active: TabId; onChange: (id: TabId) => void; openCount: number; criticalCount: number }) => {
  const tabs: Array<{ id: TabId; label: string; count?: number; severity?: 'critical' | 'high' }> = [
    { id: 'threats', label: 'THREATS', count: openCount, severity: criticalCount > 0 ? 'critical' : (openCount > 0 ? 'high' : undefined) },
    { id: 'users', label: 'USERS' },
    { id: 'threads', label: 'THREADS' },
    { id: 'activity', label: 'ACTIVITY' },
    { id: 'settings', label: 'SETTINGS' },
  ];
  return (
    <hstack height={`${ROW.tab}px`} backgroundColor={COLOR.bgPanel} borderColor={COLOR.border}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <hstack
           
            grow
            alignment="center middle"
            backgroundColor={isActive ? COLOR.bgRaised : COLOR.bgPanel}
            onPress={() => onChange(t.id)}
            padding="small"
          >
            <text size="xsmall" weight={isActive ? 'bold' : 'regular'} color={isActive ? COLOR.fg0 : COLOR.fg1}>{t.label}</text>
            {t.count != null && t.count > 0 && (
              <>
                <spacer size="small" />
                <text size="xsmall" color={t.severity === 'critical' ? COLOR.sevCritical : t.severity === 'high' ? COLOR.sevHigh : COLOR.fg1}>{t.count}</text>
              </>
            )}
          </hstack>
        );
      })}
    </hstack>
  );
};

const CalibrationBanner = ({ onDismiss }: { onDismiss: () => void }) => (
  <hstack padding="small" backgroundColor={COLOR.bgRaised} gap="small" alignment="middle" minHeight={`${ROW.touchMin}px`}>
    <text size="small" color={COLOR.fg1}>ℹ Sentinel is calibrating to your sub. Detection is active, accuracy improves over the next 7 days.</text>
    <spacer grow />
    <hstack onPress={onDismiss} minWidth={`${ROW.touchMin}px`} minHeight={`${ROW.touchMin}px`} alignment="center middle">
      <text size="small" color={COLOR.fg2}>✕</text>
    </hstack>
  </hstack>
);

const WelcomeScreen = ({ onGetStarted }: { onGetStarted: () => Promise<void> | void }) => (
  <vstack height="100%" padding="large" backgroundColor={COLOR.bgPanel} gap="medium">
    <text size="xxlarge" weight="bold" color={COLOR.fg0}>👋 Welcome to Sentinel</text>
    <text size="medium" color={COLOR.fg1}>
      Scanning your sub's recent activity to seed your baseline. Detection is active immediately;
      accuracy improves over the next 7 days.
    </text>
    <text size="small" color={COLOR.fg2}>
      Memory activates the first time you ban a user; accuracy improves as your ban history grows.
    </text>
    <vstack
      backgroundColor={COLOR.bgRaised}
      cornerRadius="medium"
      padding="medium"
      gap="small"
    >
      <text size="small" color={COLOR.fg1}>You'll see in this dashboard:</text>
      <text size="small" color={COLOR.fg0}>🚨 Coordinated brigades and raid attacks</text>
      <text size="small" color={COLOR.fg0}>🔍 Possible ban evaders (returning banned users)</text>
      <text size="small" color={COLOR.fg0}>📊 Threads escalating toward needing intervention</text>
    </vstack>
    <text size="xsmall" color={COLOR.fg2}>
      Settings (sensitivity, auto-actions, modmail) live in the app's install dialog
      under r/yoursub → Mod Tools → Sentinel.
    </text>
    <spacer grow />
    <hstack
      backgroundColor={COLOR.accent}
      cornerRadius="medium"
      alignment="center middle"
      minHeight={`${ROW.touchMin}px`}
      onPress={onGetStarted}
    >
      <text size="medium" weight="bold" color={COLOR.fgInv}>Get started</text>
    </hstack>
  </vstack>
);

const Kpis = ({ activeCount, watchedCount, actionsToday, timeSavedMinutes }: { activeCount: number; watchedCount: number; actionsToday: number; timeSavedMinutes: number }) => (
  <hstack padding="small" gap="small" backgroundColor={COLOR.bgPanel} borderColor={COLOR.border}>
    <Kpi label="Active threats" value={String(activeCount)} alarm={activeCount > 0} />
    <Kpi label="Threads watched" value={String(watchedCount)} />
    <Kpi label="Actions today" value={String(actionsToday)} />
    <Kpi label="Time saved" value={formatDuration(timeSavedMinutes)} />
  </hstack>
);

const Kpi = ({ label, value, alarm }: { label: string; value: string; alarm?: boolean }) => (
  <vstack grow padding="small" backgroundColor={COLOR.bgRaised} cornerRadius="small" gap="none">
    <text size="medium" weight="bold" color={alarm ? COLOR.sevCritical : COLOR.fg0}>{value}</text>
    <text size="xsmall" color={COLOR.fg2}>{label}</text>
  </vstack>
);

const ThreatsTab = ({ alerts, expandedId, onToggle }: { alerts: Alert[]; expandedId: string | null; onToggle: (id: string) => void }) => {
  if (alerts.length === 0) {
    return (
      <vstack padding="medium" alignment="center middle" gap="small">
        <text size="xlarge">✅</text>
        <text size="medium" color={COLOR.fg1}>No active threats.</text>
        <text size="small" color={COLOR.fg2}>All engines are monitoring.</text>
      </vstack>
    );
  }
  return (
    <vstack gap="small">
      {alerts.map((a) => <AlertCard alert={a} expanded={expandedId === a.alertId} onToggle={() => onToggle(a.alertId)} />)}
    </vstack>
  );
};

const AlertCard = ({ alert, expanded, onToggle }: { alert: Alert; expanded: boolean; onToggle: () => void }) => {
  const cfg = severityConfig(alert.severity);
  return (
    <vstack backgroundColor={COLOR.bgPanel} cornerRadius="medium" border="thin" borderColor={COLOR.border}>
      <hstack padding="small" gap="small" alignment="top" onPress={onToggle} minHeight={`${ROW.touchMin}px`}>
        <vstack width="4px" backgroundColor={cfg.color} grow={false} />
        <vstack grow gap="small">
          <hstack gap="small">
            <text size="xsmall" weight="bold" color={cfg.color}>{cfg.label}</text>
            <text size="xsmall" color={COLOR.fg2}>· {alert.engineName.replace('_', ' ').toUpperCase()}</text>
            <text size="xsmall" color={COLOR.fg2}>· {alert.alertId.slice(0, 8)}</text>
          </hstack>
          <text size="medium" weight="bold" color={COLOR.fg0}>{alert.title}</text>
          <text size="small" color={COLOR.fg1}>{alert.evidence}</text>
          <hstack gap="small">
            {alert.signals.map((s) => (
              <text size="xsmall" color={s.fired ? COLOR.fg0 : COLOR.fg3}>{s.fired ? '✓' : '·'} {s.signalId.split(':')[1] ?? s.signalId}</text>
            ))}
          </hstack>
        </vstack>
        <text size="small" color={COLOR.fg2}>{expanded ? '▴' : '▾'}</text>
      </hstack>
      {expanded && <AlertDetail alert={alert} />}
    </vstack>
  );
};

const AlertDetail = ({ alert }: { alert: Alert }) => {
  if (alert.engineName === 'raid_radar') {
    const cluster = (alert.payload?.['cluster'] as Array<{ userId: string; username: string }>) ?? [];
    return (
      <vstack padding="small" gap="small" backgroundColor={COLOR.bgCanvas}>
        <image url={clusterGraphDataUrl(cluster, alert.severity)} imageWidth={560} imageHeight={320} description="Cluster graph" />
        <text size="xsmall" color={COLOR.fg2}>Lazy-loaded. Cached by alert id.</text>
      </vstack>
    );
  }
  if (alert.engineName === 'health_score') {
    const score = Math.round((alert.payload?.['score'] as number) ?? alert.confidence * 100);
    return (
      <vstack padding="small" gap="small" backgroundColor={COLOR.bgCanvas} alignment="center middle">
        <image url={riskGaugeDataUrl(score, alert.severity, 180)} imageWidth={180} imageHeight={155} description="Risk gauge" />
      </vstack>
    );
  }
  if (alert.engineName === 'memory') {
    const cmp = (alert.payload?.['comparison'] as { then?: Record<string, unknown>; now?: Record<string, unknown> } | undefined);
    return (
      <vstack padding="small" gap="small" backgroundColor={COLOR.bgCanvas}>
        {cmp && (
          <hstack gap="small">
            <ComparisonSide title={String(cmp.then?.['label'] ?? 'then')} hours={String(cmp.then?.['postingHours'] ?? '—')} emojis={String(cmp.then?.['topEmojis'] ?? '—')} avgLen={String(cmp.then?.['avgLen'] ?? '—')} />
            <ComparisonSide title={String(cmp.now?.['label'] ?? 'now')} hours={String(cmp.now?.['postingHours'] ?? '—')} emojis={String(cmp.now?.['topEmojis'] ?? '—')} avgLen={String(cmp.now?.['avgLen'] ?? '—')} />
          </hstack>
        )}
      </vstack>
    );
  }
  return null;
};

const ComparisonSide = ({ title, hours, emojis, avgLen }: { title: string; hours: string; emojis: string; avgLen: string }) => (
  <vstack grow padding="small" backgroundColor={COLOR.bgPanel} border="thin" borderColor={COLOR.border} cornerRadius="small" gap="small">
    <text size="xsmall" color={COLOR.fg1}>{title}</text>
    <text size="small" color={COLOR.fg0}>Hours: {hours}</text>
    <text size="small" color={COLOR.fg0}>Emojis: {emojis}</text>
    <text size="small" color={COLOR.fg0}>Avg len: {avgLen}</text>
  </vstack>
);

const UsersTab = ({ alerts }: { alerts: Alert[] }) => {
  const memory = alerts.filter((a) => a.engineName === 'memory');
  if (memory.length === 0) {
    return (
      <vstack alignment="center middle" gap="small" padding="medium">
        <text size="medium" color={COLOR.fg1}>No high-risk users detected right now.</text>
        <text size="small" color={COLOR.fg2}>Memory activates the first time you ban a user.</text>
      </vstack>
    );
  }
  return (
    <vstack gap="small">
      {memory.map((a) => (
        <hstack padding="small" backgroundColor={COLOR.bgPanel} border="thin" borderColor={COLOR.border} cornerRadius="small" gap="small">
          <text size="small" color={severityConfig(a.severity).color}>{severityConfig(a.severity).label}</text>
          <text size="small" color={COLOR.fg0} grow>{a.evidence}</text>
        </hstack>
      ))}
    </vstack>
  );
};

const ThreadsTab = ({ watchedCount }: { watchedCount: number }) => (
  <vstack alignment="center middle" gap="small" padding="medium">
    <text size="medium" color={COLOR.fg1}>{watchedCount} thread{watchedCount === 1 ? '' : 's'} being watched.</text>
    <text size="small" color={COLOR.fg2}>Use the post menu to open Health Score detail.</text>
  </vstack>
);

const ActivityTab = ({ audit }: { audit: AuditEntry[] }) => {
  if (audit.length === 0) {
    return (
      <vstack alignment="center middle" gap="small" padding="medium">
        <text size="medium" color={COLOR.fg1}>No actions recorded yet.</text>
      </vstack>
    );
  }
  return (
    <vstack gap="small">
      {audit.slice(0, 20).map((e) => (
        <hstack padding="small" backgroundColor={COLOR.bgPanel} border="thin" borderColor={COLOR.border} cornerRadius="small" gap="small">
          <text size="xsmall" color={COLOR.fg2}>{new Date(e.ts).toISOString().slice(11, 16)}</text>
          <text size="small" color={COLOR.fg0}>{e.modUsername === 'sentinel' ? '🛡' : 'u/' + e.modUsername} · {e.action}</text>
          {e.reverted && <text size="xsmall" color={COLOR.sevHealthy}>· reverted</text>}
        </hstack>
      ))}
    </vstack>
  );
};

const SettingsTab = ({ settings }: { settings: Awaited<ReturnType<typeof loadSettings>> }) => (
  <vstack gap="small">
    <text size="small" color={COLOR.fg1}>Master: {settings.enabled ? 'ON' : 'OFF'}</text>
    <text size="small" color={COLOR.fg1}>Raid Radar: {settings.engines.raidRadar.sensitivity}</text>
    <text size="small" color={COLOR.fg1}>Memory: {settings.engines.memory.sensitivity}</text>
    <text size="small" color={COLOR.fg1}>Health Score: {settings.engines.healthScore.sensitivity}</text>
    <text size="small" color={COLOR.fg1}>Mod Notes sync: {settings.advanced.modNotesSync ? 'on' : 'off'}</text>
    <text size="xsmall" color={COLOR.fg2}>Edit via the app settings (Reddit mod tools → Sentinel).</text>
  </vstack>
);
