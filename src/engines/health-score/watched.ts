// Watched-thread set management. Maintains a sorted set of postIds by lastUpdated
// timestamp, capped at 50 (most-recent kept).

import type { Ctx } from '../../types/ctx.js';
import { k } from '../../storage/keys.js';

export const WATCHED_CAP = 50;

export async function trackThread(context: Ctx, postId: string, lastUpdated: number): Promise<void> {
  await context.redis.zAdd(k.watchedThreads(), { member: postId, score: lastUpdated });
  // Trim to the most-recent N.
  const all = await context.redis.zRange(k.watchedThreads(), 0, -1, { by: 'rank' });
  if (all.length > WATCHED_CAP) {
    const drop = all.slice(0, all.length - WATCHED_CAP).map((m) => m.member);
    if (drop.length > 0) await context.redis.zRem(k.watchedThreads(), drop);
  }
}

export async function listWatched(context: Ctx): Promise<string[]> {
  const members = await context.redis.zRange(k.watchedThreads(), 0, WATCHED_CAP - 1, { reverse: true, by: 'rank' });
  return members.map((m) => m.member);
}

export async function untrackThread(context: Ctx, postId: string): Promise<void> {
  await context.redis.zRem(k.watchedThreads(), [postId]);
}
