// Hourly: roll up hour-bucket counts into SubBaseline RollingStats.
// This smooths the per-event push() we do during ingestion by re-emitting an
// hourly aggregate observation.

import type { Ctx } from '../types/ctx.js';
import { loadBaseline, saveBaseline } from '../storage/redis.js';
import { nowMs } from '../lib/time.js';

export async function rollupBaseline(context: Ctx): Promise<void> {
  const baseline = await loadBaseline(context.redis);
  if (!baseline) return;
  baseline.lastUpdated = nowMs();
  // For v1 we let per-event push() drive the stats; this scheduler exists as a hook
  // for future Phase-0-driven refinements (e.g. denoising by re-emitting hourly totals).
  await saveBaseline(context.redis, baseline);
}
