import type { Ctx } from '../types/ctx.js';
import { runP3BackfillTick } from '../bootstrap/backfill.js';

export async function backfillJob(context: Ctx, subredditName: string): Promise<void> {
  await runP3BackfillTick(context, subredditName);
}
