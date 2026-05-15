// Raid Radar's 4 statistical signals. Each returns strength ∈ [0,1] + a `fired` bool.

import type { Ctx } from '../../types/ctx.js';
import type { SubBaseline, ThreadState, UserFingerprint } from '../../types/graph.js';
import type { SignalSnapshot } from '../../types/signals.js';
import { RollingStat } from '../../storage/rolling-stat.js';
import { Histogram } from '../../storage/histogram.js';
import { loadUser } from '../../storage/redis.js';
import { clamp, median, mean, stddev } from '../../lib/math.js';
import { MS_PER_DAY, nowMs } from '../../lib/time.js';

const FIVE_MIN_MS = 5 * 60 * 1000;

export interface RaidContext {
  newArrivalsIds: string[];        // commenters in last 5min who are new to sub
  newArrivalsAgesMs: number[];     // account ages for the new arrivals
  recentCommentsTimestamps: number[]; // last 5min comment ts in this thread
  externalSubCounts: Map<string, number>;
  cluster: { userId: string; username: string }[]; // for cluster graph rendering
}

export async function buildRaidContext(
  context: Ctx,
  thread: ThreadState,
  now: number = nowMs(),
): Promise<RaidContext> {
  // Resolve recent (last-5min) comments — we approximate from uniqueCommenterIds since
  // velocity TimeSeries tracks counts not author identities. The ingestion path stamps
  // `firstSeenInSub` on user fingerprints; we use that to detect new arrivals.
  // For a small thread the set of commenter ids is bounded; we filter to those whose
  // firstSeenInSub > now-5min (newly arrived) by reading each UserFingerprint.
  const newArrivalsIds: string[] = [];
  const newArrivalsAgesMs: number[] = [];
  const cluster: { userId: string; username: string }[] = [];

  for (const userId of thread.uniqueCommenterIds) {
    const fp = await loadUser(context.redis, userId);
    if (!fp) continue;
    const arrived = fp.firstSeenInSub;
    if (arrived > now - FIVE_MIN_MS) {
      newArrivalsIds.push(userId);
      if (fp.accountCreatedAt > 0) newArrivalsAgesMs.push(now - fp.accountCreatedAt);
      cluster.push({ userId, username: fp.username });
    }
  }

  // External sub overlap — read each new arrival's subOverlap map.
  const externalSubCounts = new Map<string, number>();
  for (const userId of newArrivalsIds) {
    const fp = await loadUser(context.redis, userId);
    if (!fp) continue;
    for (const [sub, count] of Object.entries(fp.behavioral.subOverlap)) {
      // Ignore the home sub itself.
      if (sub === thread.subId || sub === '') continue;
      externalSubCounts.set(sub, (externalSubCounts.get(sub) ?? 0) + count);
    }
  }

  return {
    newArrivalsIds,
    newArrivalsAgesMs,
    recentCommentsTimestamps: [],
    externalSubCounts,
    cluster,
  };
}

export function signalInfluxZ(ctx: RaidContext, baseline: SubBaseline): SignalSnapshot {
  const incoming = ctx.newArrivalsIds.length;
  const stat = RollingStat.fromJSON(baseline.uniqueCommentersPerHour, RollingStat.M_MAX_HOURLY);
  const z = stat.zScore(incoming * 12);
  // strength: linear in [0,1] over z=2..8 (z>=8 saturates).
  const strength = clamp((z - 2) / 6, 0, 1);
  return {
    signalId: 'raid-radar:influx-z',
    fired: z > 4,
    strength,
    details: `${incoming} new arrivals · z=${z.toFixed(1)}σ vs hourly baseline`,
  };
}

export function signalAgeCluster(ctx: RaidContext): SignalSnapshot {
  if (ctx.newArrivalsAgesMs.length < 3) {
    return { signalId: 'raid-radar:age-cluster', fired: false, strength: 0, details: 'too few arrivals' };
  }
  const medAge = median(ctx.newArrivalsAgesMs);
  const hist = Histogram.accountAge10();
  for (const a of ctx.newArrivalsAgesMs) hist.add(a);
  const ent = hist.entropy();
  const lowDiversity = ent < 0.5;
  const young = medAge < 30 * MS_PER_DAY;
  const fired = young && lowDiversity;
  // Strength: 1 when median is well under 7d AND entropy near 0, scaled.
  const youngScore = clamp(1 - medAge / (30 * MS_PER_DAY), 0, 1);
  const divScore = clamp(1 - ent / 0.5, 0, 1);
  const strength = (youngScore + divScore) / 2;
  return {
    signalId: 'raid-radar:age-cluster',
    fired,
    strength: fired ? strength : strength * 0.3,
    details: `median age ${Math.floor(medAge / MS_PER_DAY)}d · entropy ${ent.toFixed(2)}`,
  };
}

export function signalSubOverlap(ctx: RaidContext): SignalSnapshot {
  if (ctx.newArrivalsIds.length === 0 || ctx.externalSubCounts.size === 0) {
    return { signalId: 'raid-radar:sub-overlap', fired: false, strength: 0, details: 'no overlap data' };
  }
  let total = 0;
  let topSub = '';
  let topCount = 0;
  for (const [sub, c] of ctx.externalSubCounts) {
    total += c;
    if (c > topCount) { topCount = c; topSub = sub; }
  }
  const share = total === 0 ? 0 : topCount / total;
  const fired = share > 0.70;
  const strength = clamp((share - 0.50) / 0.50, 0, 1);
  return {
    signalId: 'raid-radar:sub-overlap',
    fired,
    strength: fired ? strength : strength * 0.5,
    details: `${(share * 100).toFixed(0)}% of new arrivals share r/${topSub || 'n/a'}`,
  };
}

export function signalSyncTiming(ctx: RaidContext, thread: ThreadState): SignalSnapshot {
  // Use velocity TimeSeries bucket counts within the last 5 minutes as a proxy for
  // inter-arrival regularity. If we have N events spread evenly across buckets,
  // synchronization is high.
  const buckets = thread.velocity?.buckets ?? [];
  if (buckets.length === 0) {
    return { signalId: 'raid-radar:sync-timing', fired: false, strength: 0, details: 'no velocity data' };
  }
  // Last 1 bucket = 5min. Use last 6 buckets (30min) to compute regularity.
  const sample = buckets.slice(-6);
  const total = sample.reduce((a, b) => a + b, 0);
  if (total < 6) {
    return { signalId: 'raid-radar:sync-timing', fired: false, strength: 0, details: 'insufficient comments' };
  }
  const m = mean(sample);
  const s = stddev(sample);
  const sync = m === 0 ? 0 : 1 - s / m;
  const syncClamped = clamp(sync, 0, 1);
  return {
    signalId: 'raid-radar:sync-timing',
    fired: syncClamped > 0.85,
    strength: clamp((syncClamped - 0.70) / 0.30, 0, 1),
    details: `sync_score=${syncClamped.toFixed(2)}`,
  };
}
