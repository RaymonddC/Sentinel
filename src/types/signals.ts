export const SIGNAL_IDS = [
  'raid-radar:influx-z',
  'raid-radar:age-cluster',
  'raid-radar:sub-overlap',
  'raid-radar:sync-timing',
  'memory:behavioral',
  'memory:stylometry',
  'health-score:velocity',
  'health-score:sentiment',
  'health-score:new-accounts',
  'health-score:report-rate',
] as const;

export type SignalId = (typeof SIGNAL_IDS)[number];

export type EngineName = 'raid_radar' | 'memory' | 'health_score';

export interface SignalSnapshot {
  signalId: SignalId;
  fired: boolean;
  strength: number;   // 0..1
  details: string;    // human-readable explanation
}

export interface ConfidenceBreakdown {
  firedCount: number;
  avgStrength: number;
  confidence: number; // 0..1
}
