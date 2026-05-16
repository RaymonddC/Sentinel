// Typed wrappers around the Devvit Redis client. Every value is JSON-stringified
// once at the boundary; callers see real objects.
//
// Devvit Redis supports get/set/del, hSet/hGet/hGetAll/hKeys/hDel, zAdd/zRange/zRem,
// expire/expireTime. No list ops (LPUSH/RPUSH/LRANGE/LTRIM) — we encode lists as
// sorted-set-as-list (score = ts, member = entryId) plus a hash for bodies.

import type { RedisClient } from '@devvit/public-api';
import type {
  Alert, AuditEntry, BannedFingerprint, CalibrationData,
  SubBaseline, ThreadState, UserFingerprint,
} from '../types/graph.js';
import type { SubSettings } from '../types/settings.js';
import { defaultSettings } from '../types/settings.js';
import { k } from './keys.js';

async function getJson<T>(redis: RedisClient, key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJson(redis: RedisClient, key: string, value: unknown): Promise<void> {
  await redis.set(key, JSON.stringify(value));
}

export async function loadBaseline(redis: RedisClient): Promise<SubBaseline | null> {
  return getJson<SubBaseline>(redis, k.baseline());
}

export async function saveBaseline(redis: RedisClient, b: SubBaseline): Promise<void> {
  await setJson(redis, k.baseline(), b);
}

export async function loadUser(redis: RedisClient, userId: string): Promise<UserFingerprint | null> {
  return getJson<UserFingerprint>(redis, k.user(userId));
}

export async function saveUser(redis: RedisClient, fp: UserFingerprint): Promise<void> {
  await setJson(redis, k.user(fp.userId), fp);
}

export async function loadThread(redis: RedisClient, postId: string): Promise<ThreadState | null> {
  return getJson<ThreadState>(redis, k.thread(postId));
}

export async function saveThread(redis: RedisClient, t: ThreadState): Promise<void> {
  await setJson(redis, k.thread(t.postId), t);
}

export async function loadAlert(redis: RedisClient, alertId: string): Promise<Alert | null> {
  return getJson<Alert>(redis, k.alert(alertId));
}

export async function saveAlert(redis: RedisClient, a: Alert): Promise<void> {
  await setJson(redis, k.alert(a.alertId), a);
}

export async function loadSettings(redis: RedisClient): Promise<SubSettings> {
  const s = await getJson<SubSettings>(redis, k.settings());
  return s ?? defaultSettings();
}

export async function saveSettings(redis: RedisClient, s: SubSettings): Promise<void> {
  await setJson(redis, k.settings(), s);
}

export async function loadBanned(redis: RedisClient, userId: string): Promise<BannedFingerprint | null> {
  return getJson<BannedFingerprint>(redis, k.bannedUser(userId));
}

export async function saveBanned(redis: RedisClient, fp: BannedFingerprint): Promise<void> {
  await setJson(redis, k.bannedUser(fp.userId), fp);
}

export async function loadCalibration(redis: RedisClient): Promise<CalibrationData> {
  const c = await getJson<CalibrationData>(redis, k.calibration());
  return c ?? { perSignal: {}, totalDismissals: 0, totalAlerts: 0 };
}

export async function saveCalibration(redis: RedisClient, c: CalibrationData): Promise<void> {
  await setJson(redis, k.calibration(), c);
}

// --- Audit log: sorted-set-as-list (score=ts) + hash for entry bodies. ---

const AUDIT_BODIES_KEY = 'sentinel:audit:entries';
const AUDIT_INDEX_KEY = 'sentinel:audit_log';

export async function appendAudit(redis: RedisClient, entry: AuditEntry, cap = 1000): Promise<void> {
  await redis.hSet(AUDIT_BODIES_KEY, { [entry.entryId]: JSON.stringify(entry) });
  await redis.zAdd(AUDIT_INDEX_KEY, { member: entry.entryId, score: entry.ts });
  try {
    await redis.zRemRangeByRank(AUDIT_INDEX_KEY, 0, -(cap + 1));
  } catch {
    // ignore — index already small
  }
}

/**
 * Append an audit entry with a caller-provided deterministic entryId.
 * If the entryId already exists, this is a no-op — safe for crash-replay.
 * Use for `alert_raised:{alertId}` so dispatch replays don't duplicate.
 */
export async function appendAuditDeterministic(redis: RedisClient, entry: AuditEntry, cap = 1000): Promise<void> {
  return appendAudit(redis, entry, cap);
}

/** Returns true if an audit entry with this entryId has already been written. */
export async function hasAuditEntry(redis: RedisClient, entryId: string): Promise<boolean> {
  const raw = await redis.hGet(AUDIT_BODIES_KEY, entryId);
  return raw != null;
}

export async function readAudit(redis: RedisClient, max = 200): Promise<AuditEntry[]> {
  const members = await redis.zRange(AUDIT_INDEX_KEY, 0, max - 1, { reverse: true, by: 'rank' });
  if (members.length === 0) return [];
  const out: AuditEntry[] = [];
  // Devvit hGetAll returns all fields; for a small max we just hGet each.
  for (const m of members) {
    const raw = await redis.hGet(AUDIT_BODIES_KEY, m.member);
    if (raw == null) continue;
    try {
      out.push(JSON.parse(raw) as AuditEntry);
    } catch {
      // skip malformed
    }
  }
  return out;
}

export async function setBannedIndex(redis: RedisClient, userId: string, bannedAt: number): Promise<void> {
  await redis.zAdd(k.bannedIds(), { member: userId, score: bannedAt });
}

export async function listBanned(redis: RedisClient, limit = 200): Promise<string[]> {
  const members = await redis.zRange(k.bannedIds(), 0, limit - 1, { reverse: true, by: 'rank' });
  return members.map((m) => m.member);
}

export async function listOpenAlerts(redis: RedisClient, limit = 50): Promise<string[]> {
  const members = await redis.zRange(k.alertsOpen(), 0, limit - 1, { reverse: true, by: 'rank' });
  return members.map((m) => m.member);
}

export async function addOpenAlert(redis: RedisClient, alertId: string, ts: number): Promise<void> {
  await redis.zAdd(k.alertsOpen(), { member: alertId, score: ts });
}

export async function removeOpenAlert(redis: RedisClient, alertId: string): Promise<void> {
  await redis.zRem(k.alertsOpen(), [alertId]);
}

export async function addAlertByTarget(redis: RedisClient, targetId: string, alertId: string): Promise<void> {
  await redis.hSet(k.alertsByTarget(targetId), { [alertId]: '1' });
}

export async function listAlertsByTarget(redis: RedisClient, targetId: string): Promise<string[]> {
  const map = await redis.hGetAll(k.alertsByTarget(targetId));
  return Object.keys(map ?? {});
}

export async function getDashboardPostId(redis: RedisClient): Promise<string | undefined> {
  return redis.get(k.dashboardPostId());
}

export async function setDashboardPostId(redis: RedisClient, postId: string): Promise<void> {
  await redis.set(k.dashboardPostId(), postId);
}
