export type Sensitivity = 'low' | 'medium' | 'high';

export interface EngineSettings {
  enabled: boolean;
  sensitivity: Sensitivity;
  autoActions: {
    enableSlowMode: boolean;
    filterNewAccounts: boolean;
  };
}

export interface QuietHours {
  enabled: boolean;
  startHourUtc: number; // 0-23
  endHourUtc: number;   // 0-23
}

export interface AdvancedSettings {
  quietHours: QuietHours;
  exemptUsers: string[];          // 'u/...' or userIds
  exemptFlairs: string[];
  watchOnlyFlairs: { enabled: boolean; flairs: string[] };
  slowModeVelocityImpact: number; // 0..1, default 0.70
  memoryMinComments: number;      // gate, default 10
  modNotesSync: boolean;          // default true
  timeSavedPerAction: number;     // minutes, default 30 (KPI tile)
}

export interface SubSettings {
  enabled: boolean;
  engines: {
    raidRadar: EngineSettings;
    memory: EngineSettings;
    healthScore: EngineSettings;
  };
  alertChannels: {
    pinnedDashboard: boolean;  // always true (non-toggleable)
    modmailCritical: boolean;
  };
  advanced: AdvancedSettings;
}

export function defaultSettings(): SubSettings {
  return {
    enabled: true,
    engines: {
      raidRadar: { enabled: true, sensitivity: 'medium', autoActions: { enableSlowMode: false, filterNewAccounts: false } },
      memory: { enabled: true, sensitivity: 'medium', autoActions: { enableSlowMode: false, filterNewAccounts: false } },
      healthScore: { enabled: true, sensitivity: 'medium', autoActions: { enableSlowMode: false, filterNewAccounts: false } },
    },
    alertChannels: {
      pinnedDashboard: true,
      modmailCritical: true,
    },
    advanced: {
      quietHours: { enabled: false, startHourUtc: 2, endHourUtc: 6 },
      exemptUsers: [],
      exemptFlairs: [],
      watchOnlyFlairs: { enabled: false, flairs: [] },
      slowModeVelocityImpact: 0.70,
      memoryMinComments: 10,
      modNotesSync: true,
      timeSavedPerAction: 30,
    },
  };
}

/** Raid Radar confidence thresholds per sensitivity. */
export const RAID_RADAR_THRESHOLDS = {
  low: { fire: 0.85, autoAction: 0.95 },
  medium: { fire: 0.75, autoAction: 0.85 },
  high: { fire: 0.65, autoAction: 0.80 },
} as const;

/** Health Score severity cutoffs (out of 100). */
export const HEALTH_SCORE_CUTOFFS = {
  medium: 31,
  high: 61,
  critical: 81,
} as const;
