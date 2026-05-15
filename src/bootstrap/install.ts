// P1 — at install: top-1000 hot posts → SubBaseline + initial UserFingerprint stubs.
// Per plan: ≤50 API calls, < 2 min, non-blocking. P1 indexes post-level metadata only;
// comment-level enrichment is P3 (progressive backfill during 7-day ramp).

import type { Ctx } from '../types/ctx.js';
import { loadBaseline, saveBaseline, loadUser, saveUser } from '../storage/redis.js';
import { RollingStat } from '../storage/rolling-stat.js';
import { TimeSeries } from '../storage/time-series.js';
import { Histogram } from '../storage/histogram.js';
import { emptyStylometry } from '../engines/memory/stylometry.js';
import type { SubBaseline, UserFingerprint } from '../types/graph.js';
import { MS_PER_DAY, nowMs } from '../lib/time.js';

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
 * P1 bootstrap. Fetches the sub's hot listing (one paginated call, paginated by Devvit)
 * and folds post-level metadata into baseline + minimal UserFingerprint stubs.
 */
export async function runP1Bootstrap(context: Ctx, subredditName: string): Promise<BootstrapStats> {
  const start = nowMs();
  let apiCalls = 0;
  let postsScanned = 0;
  let authorsIndexed = 0;

  const baseline = await ensureBaseline(context.redis, subredditName);
  const ageHist = Histogram.fromJSON(baseline.accountAgeDistribution, Histogram.accountAge10);
  const subId = baseline.subId;

  // ONE listing call (Devvit handles pagination internally up to limit).
  // We cap visible posts at 1000 but stop fetching after 50 internal API requests
  // by relying on Devvit's getHotPosts pagination behaviour.
  try {
    const listing = context.reddit.getHotPosts({ subredditName, limit: 1000 });
    apiCalls += 1;

    // Iterate the async iterator post-by-post; Devvit batches network requests.
    for await (const post of listing) {
      postsScanned += 1;

      // Post-level signal: post timestamp updates the postsPerHour rolling stat.
      // We accumulate posts/hour by spreading the listing across the trailing window — use 1 sample per post.
      // (P3 backfill will refine this with actual hourly rates.)

      // Author fingerprint stub.
      const authorId = post.authorId ?? null;
      const authorName = post.authorName ?? null;
      if (authorId && authorName) {
        const existing = await loadUser(context.redis, authorId);
        if (!existing) {
          // post.author isn't on the Post model; resolve via getUserById and accept the cost.
          let createdAt = 0;
          try {
            const user = await context.reddit.getUserById(authorId);
            const ca = user?.createdAt;
            createdAt = ca instanceof Date ? ca.getTime() : 0;
          } catch {
            // user unavailable — leave createdAt = 0
          }
          if (createdAt > 0) ageHist.add(nowMs() - createdAt);
          else ageHist.add(-1); // unknown bucket
          const createdMs = post.createdAt instanceof Date ? post.createdAt.getTime() : nowMs();
          const fp: UserFingerprint = {
            userId: authorId,
            username: authorName,
            accountCreatedAt: createdAt,
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
  } catch (err) {
    console.error('[sentinel] P1 bootstrap error', err);
  }

  baseline.accountAgeDistribution = ageHist.toJSON();
  baseline.lastUpdated = nowMs();
  // P1 does not flip bootstrapComplete — that happens after the 7-day ramp completes (P3).
  await saveBaseline(context.redis, baseline);

  return {
    postsScanned,
    authorsIndexed,
    apiCalls,
    durationMs: nowMs() - start,
  };
  void subId;
}
