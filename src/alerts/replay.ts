// Crash-recovery replay — invoked from the every-5m scheduler.
// Re-runs idempotent steps 2-6 for any alert where dispatchState === 'pending'.

import type { Ctx } from '../types/ctx.js';
import { listOpenAlerts, loadAlert } from '../storage/redis.js';
import { dispatchAlert } from './dispatch.js';

export async function replayPendingAlerts(context: Ctx): Promise<{ replayed: number }> {
  const ids = await listOpenAlerts(context.redis, 200);
  let replayed = 0;
  for (const id of ids) {
    const a = await loadAlert(context.redis, id);
    if (a && a.dispatchState === 'pending') {
      try {
        await dispatchAlert(context, a);
        replayed += 1;
      } catch (err) {
        console.warn('[sentinel] replay failed for', id, err);
      }
    }
  }
  return { replayed };
}
