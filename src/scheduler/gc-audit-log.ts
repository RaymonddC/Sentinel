// Every 6h: garbage-collect audit log entries older than 30 days.

import type { Ctx } from '../types/ctx.js';
import { nowMs } from '../lib/time.js';
import { log } from '../lib/logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * MS_PER_DAY;
const AUDIT_INDEX_KEY = 'sentinel:audit_log';
const AUDIT_BODIES_KEY = 'sentinel:audit:entries';

export async function gcAuditLog(context: Ctx): Promise<{ dropped: number }> {
  const threshold = nowMs() - RETENTION_MS;
  // zRangeByScore: members with score < threshold are too old. We collect their
  // ids, hDel the bodies, then zRemRangeByScore the index.
  const stale = await context.redis.zRange(AUDIT_INDEX_KEY, 0, threshold, { by: 'score' });
  if (stale.length === 0) return { dropped: 0 };
  const ids = stale.map((m) => m.member);
  // hDel takes (key, ...fields) as varargs
  try {
    await context.redis.hDel(AUDIT_BODIES_KEY, ids);
  } catch (err) {
    await log(context, { level: 'warn', scope: 'scheduler.gc_audit', msg: 'hDel audit bodies failed', err });
  }
  await context.redis.zRemRangeByScore(AUDIT_INDEX_KEY, 0, threshold);
  return { dropped: ids.length };
}

