// P1 — at install: top-1000 hot posts → SubBaseline + initial UserFingerprint stubs.
// Per follow-up review: ≤50 API calls, < 2 min, non-blocking. P1 indexes
// post-level metadata only (one listing call; no per-author lookups).
// Account-creation dates are resolved lazily by ingestComment on first
// CommentSubmit from each author; P3 refines further during the 7-day ramp.

import type { Ctx } from '../types/ctx.js';
import { loadBaseline, saveBaseline, loadUser, saveUser } from '../storage/redis.js';
import { log } from '../lib/logger.js';
import { RollingStat } from '../storage/rolling-stat.js';
import { Histogram } from '../storage/histogram.js';
import { emptyStylometry } from '../engines/memory/stylometry.js';
import type { SubBaseline, UserFingerprint } from '../types/graph.js';
import { nowMs } from '../lib/time.js';

export async function ensureBaseline(redis: Ctx['redis'], subId: string): Promise<SubBaseline> {
  const existing = await loadBaseline(redis);
  if (existing) return existing;
  const fresh: SubBaseline = {
    subId,
    installedAt: nowMs(),
    bootstrapComplete: false,
    commentsPerHour: new RollingStat(RollingStat.M_MAX_HOURLY).toJSON(),
    postsPerHour: new RollingStat(RollingStat.M_MAX_HOURLY).toJSON(),
    uniqueCommentersPerHour: new RollingStat(RollingStat.M_MAX_HOURLY).toJSON(),
    newAccountsPerHour: new RollingStat().toJSON(),         // slow-changing → full-history Welford
    reportRatePerHour: new RollingStat(RollingStat.M_MAX_HOURLY).toJSON(),
    avgCommentLength: new RollingStat(RollingStat.M_MAX_HOURLY).toJSON(),
    avgSentiment: new RollingStat(RollingStat.M_MAX_HOURLY).toJSON(),
    accountAgeDistribution: Histogram.accountAge10().toJSON(),
    topOverlappingSubs: {},
    lastUpdated: nowMs(),
  };
  await saveBaseline(redis, fresh);
  return fresh;
}

export interface BootstrapStats {
  postsScanned: number;
  authorsIndexed: number;
  apiCalls: number;
  durationMs: number;
}

/**
 * P1 bootstrap. One listing API call. Folds post-level metadata into the
 * SubBaseline and creates skeleton UserFingerprint records for unique authors
 * (accountCreatedAt left at 0 — filled in lazily on first comment from that
 * user, or by P3 progressive backfill).
 */
export async function runP1Bootstrap(context: Ctx, subredditName: string): Promise<BootstrapStats> {
  const start = nowMs();
  let apiCalls = 0;
  let postsScanned = 0;
  let authorsIndexed = 0;

  const baseline = await ensureBaseline(context.redis, subredditName);

  try {
    // ONE listing call. Devvit's getHotPosts paginates internally.
    const listing = context.reddit.getHotPosts({ subredditName, limit: 1000 });
    apiCalls += 1;

    const postsPerHour = RollingStat.fromJSON(baseline.postsPerHour, RollingStat.M_MAX_HOURLY);

    for await (const post of listing) {
      postsScanned += 1;
      postsPerHour.push(1);

      const authorId = post.authorId ?? null;
      const authorName = post.authorName ?? null;
      if (authorId && authorName) {
        const existing = await loadUser(context.redis, authorId);
        if (!existing) {
          // accountCreatedAt unknown at this stage — filled in lazily by ingestComment.
          // No getUserById call here (would exceed the ≤50 API budget).
          const createdMs = post.createdAt instanceof Date ? post.createdAt.getTime() : nowMs();
          const fp: UserFingerprint = {
            userId: authorId,
            username: authorName,
            accountCreatedAt: 0,
            firstSeenInSub: createdMs,
            lastSeenInSub: createdMs,
            totalComments: 0,
            totalPosts: 1,
            behavioral: {
              postingTimeHistogram: new Array<number>(24).fill(0),
              commentLengthDist: Histogram.commentLength5().toJSON(),
              postingFrequency: new RollingStat().toJSON(),
              subOverlap: {},
              weekdayCount: 0,
              weekendCount: 0,
            },
            stylometry: emptyStylometry(),
            modActions: [],
            recentComments: [],
            lastUpdated: nowMs(),
          };
          await saveUser(context.redis, fp);
          authorsIndexed += 1;
        }
      }

      if (postsScanned >= 1000) break;
    }

    baseline.postsPerHour = postsPerHour.toJSON();
  } catch (err) {
    await log(context, { level: 'error', scope: 'bootstrap.p1', msg: 'P1 bootstrap error', err });
  }

  baseline.lastUpdated = nowMs();
  // P1 does not flip bootstrapComplete — that happens after the 7-day ramp completes (P3).
  await saveBaseline(context.redis, baseline);

  return {
    postsScanned,
    authorsIndexed,
    apiCalls,
    durationMs: nowMs() - start,
  };
}
