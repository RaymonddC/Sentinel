// Daily: purge UserFingerprint records older than 90 days with no mod actions.
// Banned users are never purged (their fingerprints live under banned:{userId}).

import type { Ctx } from '../types/ctx.js';
import { nowMs } from '../lib/time.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const INACTIVE_THRESHOLD_MS = 90 * MS_PER_DAY;

export async function purgeInactiveUsers(context: Ctx): Promise<{ purged: number }> {
  // Devvit Redis has no key scan; we iterate the watched-threads + open-alerts indexes
  // for known-active user references and purge stale entries through targeted reads
  // is impossible without an enumeration index. For v1 we record this as a no-op and
  // rely on the bounded per-installation 500 MB budget. A future iteration adds a
  // sentinel:user_ids sorted set to enable this.
  void context;
  void INACTIVE_THRESHOLD_MS;
  return { purged: 0 };
}
