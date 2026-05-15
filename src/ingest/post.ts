// PostSubmit ingestion. Initializes ThreadState and bumps SubBaseline post rate.

import type { Ctx } from '../types/ctx.js';
import { saveBaseline, saveThread } from '../storage/redis.js';
import { TimeSeries } from '../storage/time-series.js';
import { RollingStat } from '../storage/rolling-stat.js';
import type { ThreadState } from '../types/graph.js';
import { nowMs } from '../lib/time.js';
import { ensureBaseline } from '../bootstrap/install.js';

export interface PostIngestEvent {
  postId: string;
  title: string;
  authorId: string;
  authorName: string;
  subredditId: string;
  subredditName: string;
  createdAtMs: number;
  flair?: string;
}

export async function ingestPost(context: Ctx, e: PostIngestEvent): Promise<void> {
  const subId = e.subredditId;
  const baseline = await ensureBaseline(context.redis, subId);
  const now = e.createdAtMs || nowMs();

  const thread: ThreadState = {
    postId: e.postId,
    subId,
    title: e.title,
    authorId: e.authorId,
    createdAt: now,
    commentCount: 0,
    uniqueCommenterIds: [],
    newAccountCommenters: 0,
    reportCount: 0,
    velocity: new TimeSeries('sum').toJSON(),
    sentiment: new TimeSeries('avg').toJSON(),
    reportRate: new TimeSeries('sum').toJSON(),
    currentRisk: 0,
    riskHistory: new TimeSeries('avg').toJSON(),
    isWatched: true,
    exempt: false,
    flair: e.flair,
    slowModeEnabled: false,
    newAccountFilterEnabled: false,
    lastUpdated: now,
  };
  await saveThread(context.redis, thread);

  const postsPerHour = RollingStat.fromJSON(baseline.postsPerHour, RollingStat.M_MAX_HOURLY);
  // We accumulate per-event; the hourly rollup job will smooth via push() of the hourly count.
  postsPerHour.push(1);
  baseline.postsPerHour = postsPerHour.toJSON();
  baseline.lastUpdated = now;
  await saveBaseline(context.redis, baseline);
}
