// Reactive ingestion for CommentSubmit. Updates: ThreadState, UserFingerprint, SubBaseline.
// Engines (raid radar, health score) are evaluated after debounce check.

import type { Ctx } from '../types/ctx.js';
import { loadBaseline, loadThread, loadUser, saveBaseline, saveThread, saveUser } from '../storage/redis.js';
import { RollingStat } from '../storage/rolling-stat.js';
import { TimeSeries } from '../storage/time-series.js';
import { Histogram } from '../storage/histogram.js';
import { Vocabulary } from '../engines/memory/vocabulary.js';
import { emptyStylometry, updateStylometry } from '../engines/memory/stylometry.js';
import { scoreText } from '../engines/health-score/sentiment.js';
import type { ThreadState, UserFingerprint } from '../types/graph.js';
import { MS_PER_DAY, nowMs } from '../lib/time.js';
import { ensureBaseline } from '../bootstrap/install.js';
import { shouldEvaluate } from './debounce.js';

export interface CommentIngestEvent {
  postId: string;
  postTitle?: string;
  subredditId: string;
  subredditName: string;
  commentId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorCreatedAtMs: number; // 0 if unknown
  createdAtMs: number;
}

export async function ingestComment(context: Ctx, e: CommentIngestEvent): Promise<{ evaluated: boolean }> {
  const subId = e.subredditId;
  const baseline = await ensureBaseline(context.redis, subId);
  const now = e.createdAtMs || nowMs();

  // ---- ThreadState ----
  let thread = await loadThread(context.redis, e.postId);
  if (!thread) {
    thread = {
      postId: e.postId,
      subId,
      title: e.postTitle ?? '',
      authorId: '',
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
      slowModeEnabled: false,
      newAccountFilterEnabled: false,
      lastUpdated: now,
    };
  }

  thread.commentCount += 1;
  if (!thread.uniqueCommenterIds.includes(e.authorId)) {
    thread.uniqueCommenterIds.push(e.authorId);
    if (thread.uniqueCommenterIds.length > 200) thread.uniqueCommenterIds.shift();
  }
  const isNewAccount = e.authorCreatedAtMs > 0 && now - e.authorCreatedAtMs < 30 * MS_PER_DAY;
  if (isNewAccount) thread.newAccountCommenters += 1;

  const velocity = TimeSeries.fromJSON(thread.velocity, 'sum');
  velocity.add(1, now);
  thread.velocity = velocity.toJSON();

  const sentimentScore = scoreText(e.body);
  const sentimentTs = TimeSeries.fromJSON(thread.sentiment, 'avg');
  sentimentTs.add(sentimentScore, now);
  thread.sentiment = sentimentTs.toJSON();
  thread.lastUpdated = now;

  // ---- SubBaseline ----
  const avgLen = RollingStat.fromJSON(baseline.avgCommentLength, RollingStat.M_MAX_HOURLY);
  avgLen.push(e.body.length);
  baseline.avgCommentLength = avgLen.toJSON();

  const avgSent = RollingStat.fromJSON(baseline.avgSentiment, RollingStat.M_MAX_HOURLY);
  avgSent.push(sentimentScore);
  baseline.avgSentiment = avgSent.toJSON();

  // Account age into running distribution + new-accounts ratio.
  if (e.authorCreatedAtMs > 0) {
    const ageHist = Histogram.fromJSON(baseline.accountAgeDistribution, Histogram.accountAge10);
    ageHist.add(now - e.authorCreatedAtMs);
    baseline.accountAgeDistribution = ageHist.toJSON();
  }
  baseline.lastUpdated = now;

  // ---- UserFingerprint ----
  let user = await loadUser(context.redis, e.authorId);
  let resolvedCreatedAt = e.authorCreatedAtMs;
  if (!user) {
    // First-time-seen author. Resolve account-creation date lazily — UserV2 from the
    // trigger payload doesn't include createdAt.
    if (resolvedCreatedAt === 0) {
      try {
        const u = await context.reddit.getUserById(e.authorId);
        const ca = u?.createdAt;
        if (ca instanceof Date) resolvedCreatedAt = ca.getTime();
      } catch {
        // ignore — proceed with 0 (unknown)
      }
    }
    user = {
      userId: e.authorId,
      username: e.authorName,
      accountCreatedAt: resolvedCreatedAt,
      firstSeenInSub: now,
      lastSeenInSub: now,
      totalComments: 0,
      totalPosts: 0,
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
      lastUpdated: now,
    };
  }

  // posting time histogram (UTC hour)
  const hour = new Date(now).getUTCHours();
  user.behavioral.postingTimeHistogram[hour] = (user.behavioral.postingTimeHistogram[hour] ?? 0) + 1;
  const dow = new Date(now).getUTCDay();
  if (dow === 0 || dow === 6) user.behavioral.weekendCount += 1; else user.behavioral.weekdayCount += 1;

  // comment-length histogram
  const lenHist = Histogram.fromJSON(user.behavioral.commentLengthDist, Histogram.commentLength5);
  lenHist.add(e.body.length);
  user.behavioral.commentLengthDist = lenHist.toJSON();

  // posting frequency (gap from previous comment)
  if (user.lastSeenInSub > 0 && now > user.lastSeenInSub) {
    const freq = RollingStat.fromJSON(user.behavioral.postingFrequency);
    freq.push((now - user.lastSeenInSub) / 1000); // seconds
    user.behavioral.postingFrequency = freq.toJSON();
  }

  // Stylometry incremental update
  updateStylometry(user.stylometry, e.body);
  // Vocabulary cap (drop-500 at 2500)
  if (Object.keys(user.stylometry.vocabulary).length > 2500) {
    const vocab = Vocabulary.fromRecord(user.stylometry.vocabulary, 2000, 500);
    vocab.prune();
    user.stylometry.vocabulary = vocab.toRecord();
  }

  user.totalComments += 1;
  user.lastSeenInSub = now;
  user.lastUpdated = now;

  // recentComments ring-buffer (FIFO, max 100)
  user.recentComments.push({ id: e.commentId, body: e.body.slice(0, 1000), createdAt: now });
  if (user.recentComments.length > 100) user.recentComments.shift();

  await saveThread(context.redis, thread);
  await saveUser(context.redis, user);
  await saveBaseline(context.redis, baseline);

  // ---- Engine eval (debounced) ----
  const should = await shouldEvaluate(context.redis, e.postId, now);
  return { evaluated: should };
}
