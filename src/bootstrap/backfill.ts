// P3 progressive backfill — hourly scheduled job during 7-day ramp.
// Per plan: ≤ 50 API calls per tick; flips bootstrapComplete after 7d.

import type { Ctx } from '../types/ctx.js';
import { loadBaseline, saveBaseline } from '../storage/redis.js';
import { MS_PER_DAY, nowMs } from '../lib/time.js';

export const RAMP_DAYS = 7;

export async function runP3BackfillTick(context: Ctx, subredditName: string): Promise<void> {
  const baseline = await loadBaseline(context.redis);
  if (!baseline) return;

  // Flip bootstrapComplete after 7-day timer.
  if (!baseline.bootstrapComplete && nowMs() - baseline.installedAt >= RAMP_DAYS * MS_PER_DAY) {
    baseline.bootstrapComplete = true;
    baseline.lastUpdated = nowMs();
    await saveBaseline(context.redis, baseline);
  }

  // The actual progressive fetch is intentionally a stub: per Phase 0 outcome, the team
  // tunes the chunk size. For v1 we rely on P2 (reactive ingestion) for live data; P3
  // simply ensures the bootstrap flag flips on time and gives a hook to widen later.
  void context;
  void subredditName;
}
