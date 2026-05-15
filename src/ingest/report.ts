// Report ingestion — bumps ThreadState.reportRate and SubBaseline.reportRatePerHour.

import type { Ctx } from '../types/ctx.js';
import { loadBaseline, loadThread, saveBaseline, saveThread } from '../storage/redis.js';
import { RollingStat } from '../storage/rolling-stat.js';
import { TimeSeries } from '../storage/time-series.js';
import { nowMs } from '../lib/time.js';
import { shouldEvaluate } from './debounce.js';
import { ensureBaseline } from '../bootstrap/install.js';

export interface ReportIngestEvent {
  postId: string;       // thread the reported item lives in
  subredditId: string;
  createdAtMs: number;
}

export async function ingestReport(context: Ctx, e: ReportIngestEvent): Promise<{ evaluated: boolean }> {
  const baseline = await ensureBaseline(context.redis, e.subredditId);
  const now = e.createdAtMs || nowMs();

  const thread = await loadThread(context.redis, e.postId);
  if (thread) {
    thread.reportCount += 1;
    const rate = TimeSeries.fromJSON(thread.reportRate, 'sum');
    rate.add(1, now);
    thread.reportRate = rate.toJSON();
    thread.lastUpdated = now;
    await saveThread(context.redis, thread);
  }

  const reportRate = RollingStat.fromJSON(baseline.reportRatePerHour, RollingStat.M_MAX_HOURLY);
  reportRate.push(1);
  baseline.reportRatePerHour = reportRate.toJSON();
  baseline.lastUpdated = now;
  await saveBaseline(context.redis, baseline);

  const should = await shouldEvaluate(context.redis, e.postId, now);
  return { evaluated: should };
}
