import type { RollingStatJSON } from '../storage/rolling-stat.js';
import type { TimeSeriesJSON } from '../storage/time-series.js';
import type { HistogramJSON } from '../storage/histogram.js';
import type { SignalSnapshot, EngineName } from './signals.js';

export type Severity = 'info' | 'medium' | 'high' | 'critical' | 'healthy';
export type AlertStatus = 'open' | 'actioned' | 'dismissed' | 'false_positive';
export type DispatchState = 'pending' | 'complete';

export interface ModActionRecord {
  ts: number;
  action: string;       // 'banuser' | 'removelink' | 'warn' | ...
  modId?: string;
  reason?: string;
}

export interface CommentSample {
  id: string;
  body: string;
  createdAt: number;
}

export interface StylometryProfile {
  totalChars: number;
  totalWords: number;
  totalSentences: number;
  // Punctuation per 1000 chars
  punctuation: {
    period: number;
    comma: number;
    exclamation: number;
    question: number;
    ellipsis: number;
    semicolon: number;
  };
  capitalization: {
    allCapsWords: number;
    sentenceStartLowercase: number;
  };
  emojiUsage: Record<string, number>;   // emoji → count
  topNgrams: Record<string, number>;    // trigram → count, capped top-50
  vocabulary: Record<string, number>;   // word → count, capped top-2000 (drop-500 at 2500)
  contractions: number;                 // count of contraction tokens (don't, won't, can't ...)
  filler: number;                       // count of filler tokens (um, like, tbh, ngl ...)
  avgSentenceLength: number;
  sentenceLengthStddev: number;
  vocabularyDiversity: number;          // TTR
}

export interface BehavioralProfile {
  postingTimeHistogram: number[]; // 24 buckets (UTC hour)
  commentLengthDist: HistogramJSON;
  postingFrequency: RollingStatJSON;
  subOverlap: Record<string, number>;  // sub → count, last-100 cross-sub items
  weekdayCount: number;
  weekendCount: number;
}

export interface UserFingerprint {
  userId: string;
  username: string;
  accountCreatedAt: number;
  firstSeenInSub: number;
  lastSeenInSub: number;
  totalComments: number;
  totalPosts: number;
  behavioral: BehavioralProfile;
  stylometry: StylometryProfile;
  modActions: ModActionRecord[];
  recentComments: CommentSample[]; // max 100, FIFO
  lastUpdated: number;
}

export interface SubBaseline {
  subId: string;
  installedAt: number;
  bootstrapComplete: boolean;
  commentsPerHour: RollingStatJSON;
  postsPerHour: RollingStatJSON;
  uniqueCommentersPerHour: RollingStatJSON;
  newAccountsPerHour: RollingStatJSON;
  reportRatePerHour: RollingStatJSON;
  avgCommentLength: RollingStatJSON;
  avgSentiment: RollingStatJSON;
  accountAgeDistribution: HistogramJSON;
  topOverlappingSubs: Record<string, number>;
  lastUpdated: number;
}

export interface ThreadState {
  postId: string;
  subId: string;
  title: string;
  authorId: string;
  createdAt: number;
  commentCount: number;
  uniqueCommenterIds: string[];        // serialized Set; cap last 200
  newAccountCommenters: number;
  reportCount: number;
  velocity: TimeSeriesJSON;
  sentiment: TimeSeriesJSON;
  reportRate: TimeSeriesJSON;
  currentRisk: number;
  riskHistory: TimeSeriesJSON;
  isWatched: boolean;
  exempt: boolean;
  flair?: string;
  slowModeEnabled: boolean;
  newAccountFilterEnabled: boolean;
  lastUpdated: number;
}

export interface ModActionInverse {
  // Captured state BEFORE the action, so revert can restore it exactly.
  kind: 'slow_mode' | 'new_account_filter' | 'ban_user' | 'remove_post';
  threadId?: string;
  previousSlowModeSeconds?: number;
  previousFilterFlag?: boolean;
  bannedUserId?: string;
  bannedDays?: number;
  removedItemId?: string;
}

export interface AuditEntry {
  entryId: string;
  ts: number;
  alertId?: string;
  modUsername: string;          // 'sentinel' for auto-actions
  engineName?: EngineName;
  action: string;
  target: { type: 'thread' | 'user' | 'sub' | 'system'; id: string };
  reason?: string;
  inverse?: ModActionInverse;
  reverted: boolean;
  revertedAt?: number;
  revertibleUntil: number;
}

export interface Alert {
  alertId: string;
  subId: string;
  engineName: EngineName;
  severity: Severity;
  triggeredAt: number;
  signals: SignalSnapshot[];
  confidence: number;
  targetType: 'thread' | 'user' | 'sub';
  targetId: string;
  // Engine-specific payload (rendered by detail view; never used for logic):
  evidence: string;
  title: string;
  payload?: Record<string, unknown>;
  status: AlertStatus;
  resolvedAt?: number;
  resolvedBy?: string;
  actionEntryId?: string;
  revertibleUntil: number;
  dispatchState: DispatchState;
}

export interface BannedFingerprint {
  userId: string;
  username: string;
  bannedAt: number;
  reason?: string;
  // Summary derived from a full UserFingerprint at ban time. ~400–750 bytes.
  postingTimeHistogram: number[]; // 24
  topEmojis: Record<string, number>;   // top-10
  topNgrams: Record<string, number>;   // top-50
  topSubs: Record<string, number>;     // top-20 subOverlap keys
  avgCommentLength: number;
  vocabularyDiversity: number;
}

export interface CalibrationData {
  perSignal: Record<string, { dismissals: { ts: number; alertId: string }[]; thresholdMultiplier: number }>;
  totalDismissals: number;
  totalAlerts: number;
}
