// Banned-user index access. Per 04-engine-memory.md § Banned-user index.

import type { Ctx } from '../../types/ctx.js';
import { listBanned, loadBanned } from '../../storage/redis.js';
import type { BannedFingerprint } from '../../types/graph.js';

const CONCURRENCY = 20;

export async function iterateBanned(context: Ctx, limit = 200): Promise<BannedFingerprint[]> {
  const userIds = await listBanned(context.redis, limit);
  const out: BannedFingerprint[] = [];
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const chunk = userIds.slice(i, i + CONCURRENCY);
    const fps = await Promise.all(chunk.map((id) => loadBanned(context.redis, id)));
    for (const fp of fps) if (fp) out.push(fp);
  }
  return out;
}
