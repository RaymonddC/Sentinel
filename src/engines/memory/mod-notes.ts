// Mod Notes integration — opt-in seeding from prior ban history.

import type { Ctx } from '../../types/ctx.js';
import { loadSettings, saveBanned, setBannedIndex } from '../../storage/redis.js';
import { log } from '../../lib/logger.js';
import { Histogram } from '../../storage/histogram.js';
import type { BannedFingerprint } from '../../types/graph.js';
import { nowMs } from '../../lib/time.js';

export async function seedBannedFromModNotes(context: Ctx, subredditName: string): Promise<{ seeded: number }> {
  const settings = await loadSettings(context.redis);
  if (!settings.advanced.modNotesSync) return { seeded: 0 };

  let seeded = 0;
  try {
    // getModNotes signature: { subreddit, user, filter }. Without a target user we walk
    // the modlog for ban actions instead.
    const log = context.reddit.getModerationLog({ subredditName, type: 'banuser', limit: 500 });
    for await (const entry of log) {
      // ModerationLog entries expose `target` (id + optional author/permalink/title), not targetUser.
      const username = entry.target?.author ?? null;
      const userId = entry.target?.id ?? null;
      if (!userId || !username) continue;

      // Skeleton fingerprint — we don't have the user's stylometry; this acts as a
      // marker so Memory can do a partial behavioral-only comparison on next interaction.
      const fp: BannedFingerprint = {
        userId,
        username,
        bannedAt: entry.createdAt instanceof Date ? entry.createdAt.getTime() : nowMs(),
        reason: entry.description ?? entry.details ?? undefined,
        postingTimeHistogram: new Array<number>(24).fill(0),
        topEmojis: {},
        topNgrams: {},
        topSubs: {},
        avgCommentLength: 0,
        vocabularyDiversity: 0,
      };
      await saveBanned(context.redis, fp);
      await setBannedIndex(context.redis, userId, fp.bannedAt);
      seeded += 1;
    }
  } catch (err) {
    await log(context, { level: 'warn', scope: 'engine.memory', msg: 'mod-notes seeding failed', err });
  }
  return { seeded };
  void Histogram;
}
