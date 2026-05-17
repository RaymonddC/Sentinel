// ModAction ingestion — primarily for banuser → banned-fingerprint index.

import type { Ctx } from '../types/ctx.js';
import { loadUser, saveBanned, setBannedIndex, loadSettings, appendAudit } from '../storage/redis.js';
import { log } from '../lib/logger.js';
import type { BannedFingerprint, ModActionRecord } from '../types/graph.js';
import { newAuditEntryId } from '../lib/id.js';
import { nowMs } from '../lib/time.js';

export interface ModActionIngestEvent {
  action: string;             // 'banuser' | 'removelink' | 'removecomment' | ...
  targetUserId?: string;
  targetUserName?: string;
  modName: string;
  reason?: string;
  subredditName: string;
  createdAtMs: number;
}

export async function ingestModAction(context: Ctx, e: ModActionIngestEvent): Promise<void> {
  const settings = await loadSettings(context.redis);
  const now = e.createdAtMs || nowMs();

  // Audit-log every mod action.
  const auditEntry = {
    entryId: newAuditEntryId(),
    ts: now,
    modUsername: e.modName,
    action: e.action,
    target: { type: e.targetUserId ? 'user' as const : 'sub' as const, id: e.targetUserId ?? e.subredditName },
    reason: e.reason,
    reverted: false,
    revertibleUntil: 0,
  };
  await appendAudit(context.redis, auditEntry);

  // banuser: write BannedFingerprint summary + zAdd to enumeration index.
  if (e.action === 'banuser' && e.targetUserId) {
    const user = await loadUser(context.redis, e.targetUserId);
    if (user) {
      // Add the mod action record to the user's permanent history.
      const record: ModActionRecord = { ts: now, action: 'banuser', modId: e.modName, reason: e.reason };
      user.modActions.push(record);

      const fp: BannedFingerprint = {
        userId: user.userId,
        username: user.username,
        bannedAt: now,
        reason: e.reason,
        postingTimeHistogram: user.behavioral.postingTimeHistogram.slice(0, 24),
        topEmojis: topN(user.stylometry.emojiUsage, 10),
        topNgrams: topN(user.stylometry.topNgrams, 50),
        topSubs: topN(user.behavioral.subOverlap, 20),
        avgCommentLength: derive('avgLen', user),
        vocabularyDiversity: user.stylometry.vocabularyDiversity,
      };
      await saveBanned(context.redis, fp);
      await setBannedIndex(context.redis, user.userId, now);

      // Mod Notes sync — opt-in.
      if (settings.advanced.modNotesSync && e.targetUserName) {
        try {
          await context.reddit.addModNote({
            subreddit: e.subredditName,
            user: e.targetUserName,
            note: `Sentinel ban: ${e.reason ?? 'no reason given'} · fingerprint preserved (${Object.keys(fp.topNgrams).length} trigrams)`,
            label: 'BAN',
          });
        } catch (err) {
          await log(context, { level: 'warn', scope: 'ingest.mod_action', msg: 'addModNote failed', err });
        }
      }
    }
  }
}

function topN(rec: Record<string, number>, n: number): Record<string, number> {
  const entries = Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, n);
  return Object.fromEntries(entries);
}

function derive(kind: 'avgLen', user: { stylometry: { totalChars: number; totalWords: number } }): number {
  if (kind === 'avgLen') {
    return user.stylometry.totalWords === 0 ? 0 : user.stylometry.totalChars / user.stylometry.totalWords;
  }
  return 0;
}
