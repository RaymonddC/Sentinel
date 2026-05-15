// Memory engine — on every new commenter, scan the banned-user index for matches.

import type { Ctx } from '../../types/ctx.js';
import { listAlertsByTarget, loadAlert, loadCalibration, loadSettings, loadUser, saveCalibration } from '../../storage/redis.js';
import { iterateBanned } from './banned-index.js';
import { behavioralSimilarityVsBanned } from './behavioral.js';
import { stylometrySimilarity } from './stylometry.js';
import { dispatchAlert } from '../../alerts/dispatch.js';
import { newAlertId } from '../../lib/id.js';
import { MS_PER_DAY, nowMs } from '../../lib/time.js';
import type { CommentIngestEvent } from '../../ingest/comment.js';
import type { Alert, BannedFingerprint, UserFingerprint, StylometryProfile } from '../../types/graph.js';
import { emptyStylometry } from './stylometry.js';

const TWELVE_MONTHS_MS = 365 * MS_PER_DAY;
const RECENT_DUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function evaluateMemoryOnComment(context: Ctx, e: CommentIngestEvent): Promise<void> {
  const settings = await loadSettings(context.redis);
  if (!settings.enabled || !settings.engines.memory.enabled) return;
  if (settings.advanced.exemptUsers.includes(e.authorName) || settings.advanced.exemptUsers.includes(`u/${e.authorName}`)) return;

  const suspect = await loadUser(context.redis, e.authorId);
  if (!suspect) return;

  // Guards: account age <12mo and ≥ memoryMinComments samples.
  const now = nowMs();
  if (suspect.accountCreatedAt > 0 && now - suspect.accountCreatedAt > TWELVE_MONTHS_MS) return;
  if (suspect.recentComments.length < settings.advanced.memoryMinComments) return;

  // Dedup — don't repeat a Memory alert on this user within 24h.
  const existingIds = await listAlertsByTarget(context.redis, e.authorId);
  for (const id of existingIds) {
    const a = await loadAlert(context.redis, id);
    if (a && a.engineName === 'memory' && now - a.triggeredAt < RECENT_DUPE_WINDOW_MS) return;
  }

  const banned = await iterateBanned(context, 200);
  if (banned.length === 0) return;

  let best: { fp: BannedFingerprint; behSim: number; styleSim: number; combined: number } | null = null;
  for (const b of banned) {
    const behSim = behavioralSimilarityVsBanned(suspect.behavioral, b);
    // Style sim — need a StylometryProfile derived from the banned summary.
    const bannedStyleProfile = bannedStylometryFromSummary(b);
    const styleSim = stylometrySimilarity(suspect.stylometry, bannedStyleProfile);
    const combined = 0.4 * behSim + 0.6 * styleSim;
    if (!best || combined > best.combined) best = { fp: b, behSim, styleSim, combined };
  }
  if (!best) return;
  if (best.behSim < 0.65 || best.styleSim < 0.75 || best.combined < 0.78) return;

  const calibration = await loadCalibration(context.redis);
  const evidence = `Possible match to u/${best.fp.username} (banned ${new Date(best.fp.bannedAt).toISOString().slice(0, 10)}${best.fp.reason ? ` — ${best.fp.reason}` : ''}). Behavioral ${(best.behSim * 100).toFixed(0)}% · Stylometry ${(best.styleSim * 100).toFixed(0)}% · Combined ${(best.combined * 100).toFixed(0)}%.`;

  const alert: Alert = {
    alertId: newAlertId(),
    subId: e.subredditId,
    engineName: 'memory',
    severity: best.combined > 0.9 ? 'critical' : 'high',
    triggeredAt: now,
    signals: [
      { signalId: 'memory:behavioral', fired: best.behSim > 0.65, strength: best.behSim, details: `${(best.behSim * 100).toFixed(0)}%` },
      { signalId: 'memory:stylometry', fired: best.styleSim > 0.75, strength: best.styleSim, details: `${(best.styleSim * 100).toFixed(0)}%` },
    ],
    confidence: best.combined,
    targetType: 'user',
    targetId: e.authorId,
    title: 'Possible ban evader',
    evidence,
    payload: {
      suspect: { username: suspect.username, accountAgeDays: Math.floor((now - suspect.accountCreatedAt) / MS_PER_DAY), commentCount: suspect.totalComments },
      bannedMatch: { username: best.fp.username, bannedAt: best.fp.bannedAt, reason: best.fp.reason },
      behavioral: best.behSim,
      stylometry: best.styleSim,
      combined: best.combined,
      comparison: buildComparison(suspect, best.fp),
    },
    status: 'open',
    revertibleUntil: 0,
    dispatchState: 'pending',
  };
  await dispatchAlert(context, alert);

  calibration.totalAlerts += 1;
  await saveCalibration(context.redis, calibration);
}

function bannedStylometryFromSummary(b: BannedFingerprint): StylometryProfile {
  const p = emptyStylometry();
  p.topNgrams = { ...b.topNgrams };
  p.emojiUsage = { ...b.topEmojis };
  p.vocabularyDiversity = b.vocabularyDiversity;
  // We don't have punctuation/cap counts on the summary — that's an accepted approximation.
  return p;
}

function buildComparison(suspect: UserFingerprint, banned: BannedFingerprint): Record<string, unknown> {
  const topEmojis = (rec: Record<string, number>) =>
    Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k).join(' ');
  return {
    then: {
      label: `u/${banned.username} · banned ${new Date(banned.bannedAt).toISOString().slice(0, 10)}`,
      postingHours: peakHours(banned.postingTimeHistogram),
      topEmojis: topEmojis(banned.topEmojis),
      avgLen: Math.round(banned.avgCommentLength),
    },
    now: {
      label: `u/${suspect.username} · active in last hour`,
      postingHours: peakHours(suspect.behavioral.postingTimeHistogram),
      topEmojis: topEmojis(suspect.stylometry.emojiUsage),
      avgLen: suspect.stylometry.totalWords === 0 ? 0 : Math.round(suspect.stylometry.totalChars / suspect.stylometry.totalWords),
    },
  };
}

function peakHours(hist: number[]): string {
  if (hist.length === 0) return '—';
  let topHour = 0;
  let topCount = 0;
  for (let i = 0; i < hist.length; i++) {
    if ((hist[i] ?? 0) > topCount) { topCount = hist[i]!; topHour = i; }
  }
  return `${topHour}-${(topHour + 3) % 24} UTC peak`;
}
