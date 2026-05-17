// Every-5m: replay pending dispatches + re-evaluate watched threads.

import type { Ctx } from '../types/ctx.js';
import { log } from '../lib/logger.js';
import { replayPendingAlerts } from '../alerts/replay.js';
import { evaluateHealth } from '../engines/health-score/evaluate.js';
import { listWatched } from '../engines/health-score/watched.js';

export async function refreshThreadHealth(context: Ctx): Promise<{ replayed: number; evaluated: number }> {
  const { replayed } = await replayPendingAlerts(context);
  const watched = await listWatched(context);
  let evaluated = 0;
  for (const postId of watched) {
    try {
      await evaluateHealth(context, postId);
      evaluated += 1;
    } catch (err) {
      await log(context, { level: 'warn', scope: 'scheduler.refresh_health', msg: 'health re-eval failed', ctx: { postId }, err });
    }
  }
  return { replayed, evaluated };
}
