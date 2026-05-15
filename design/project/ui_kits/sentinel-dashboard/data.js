// Sample data. All fake. Mirrors the real spec.
// Five tabs · function-named · alerts cross engines.

window.SentinelData = {
  // Post-header summary (the "always-visible" KPIs at the top)
  summary: {
    alertsLast24h: 7,
    criticalActive: 1,
    healthScore: 78,
    healthTrend: "rising",
  },

  // System banner state. Drives calibration / demo banner above tab content.
  banner: {
    kind: "calibration",
    text: "Sentinel is calibrating to your sub. Detection is active, accuracy improves over the next 6 days.",
    accuracy: 62,
  },

  // ============================================================
  // 1. THREATS — cross-engine open alerts. Mixed feed.
  //    kind: "cluster" (Raid Radar) | "evader" (Memory) | "thread-risk" (Health Score)
  // ============================================================
  threats: [
    {
      kind: "cluster",
      severity: "critical",
      id: "C-0442",
      engine: "Raid Radar",
      title: "Coordinated brigade detected",
      evidence: "38 new accounts from r/external hit \"How is this allowed?\" in 90 seconds.",
      confidence: 0.89,
      signals: ["velocity", "age cluster", "overlap", "sync"],
      target: "How is this allowed? (megathread, today)",
      startedAgo: "2 min ago",
      accounts: 38,
    },
    {
      kind: "thread-risk",
      severity: "high",
      id: "T-0331",
      engine: "Health Score",
      title: "Thread risk escalating",
      evidence: "Risk score on \"AMA: my unpopular take\" climbed from 41 to 78 in 14 min.",
      confidence: 0.84,
      signals: ["report rate", "removal rate", "new-account share"],
      target: "AMA: my unpopular take",
      forecast: { noAction: { peak: 95, etaMin: 90 }, withAction: { peak: 51 } },
      startedAgo: "14 min ago",
    },
    {
      kind: "evader",
      severity: "high",
      id: "M-0118",
      engine: "Memory",
      title: "Possible ban evader",
      evidence: "Strong match to u/old_handle_2024 (banned Mar 14 for rule 2 — harassment).",
      confidence: 0.91,
      signals: ["behavioral", "stylometry", "timing", "subreddit overlap"],
      user: "u/new_account_8821",
      bannedUser: "u/old_handle_2024",
      bannedDate: "Mar 14",
      bannedReason: "rule 2 — harassment",
      scores: { behavioral: 87, stylometry: 94, combined: 91 },
      startedAgo: "27 min ago",
      then: {
        label: "u/old_handle_2024 · banned Mar 14",
        items: ["14 comments removed (harassment)", "2 modmail warnings", "Permanent ban (rule 2)"],
      },
      now: {
        label: "u/new_account_8821 · active in last hour",
        items: ["3 comments in 2 threads", "Same n-gram fingerprint (0.94)", "Posts at same hour-of-day"],
      },
    },
    {
      kind: "cluster",
      severity: "medium",
      id: "C-0439",
      engine: "Raid Radar",
      title: "Dormant cluster forming",
      evidence: "4 accounts · sequential usernames · low karma · no engagement yet.",
      confidence: 0.54,
      signals: ["age cluster"],
      target: "no target yet",
      startedAgo: "4h ago",
      accounts: 4,
    },
  ],

  // ============================================================
  // 2. USERS — search + risk list (entry point for Memory)
  // ============================================================
  users: [
    {
      username: "u/new_account_8821",
      severity: "high",
      tag: "POSSIBLE BAN EVADER",
      risk: 91,
      summary: "Strong match to u/old_handle_2024 (combined 91%)",
      signals: ["match: 91%", "new", "high activity"],
      lastSeen: "active now",
    },
    {
      username: "u/cold_take_central_2",
      severity: "medium",
      tag: "POSSIBLE RETURN",
      risk: 68,
      summary: "Likely match to u/cold_take_central (combined 68%)",
      signals: ["match: 68%", "tone-similar"],
      lastSeen: "32 min ago",
    },
    {
      username: "u/late_night_poster",
      severity: "medium",
      tag: "WATCH",
      risk: 54,
      summary: "3 prior modmail threads · no removals",
      signals: ["prior modmail"],
      lastSeen: "2h ago",
    },
    {
      username: "u/anon_burner_991",
      severity: "high",
      tag: "NEW + ACTIVE",
      risk: 82,
      summary: "Account 3 days old · 47 comments today across 12 threads",
      signals: ["new account", "high velocity"],
      lastSeen: "active now",
    },
  ],

  // ============================================================
  // 3. THREADS — watched threads triage queue
  // ============================================================
  threads: [
    {
      title: "How is this allowed?",
      kind: "megathread",
      severity: "critical",
      risk: 89,
      trend: "up",
      summary: "Brigade in progress · 38 new accounts · 90s window",
      signals: ["brigade: 38", "new accounts: 92%", "report rate ×8"],
      reports: 142,
      removals: 21,
      ageMin: 38,
    },
    {
      title: "AMA: my unpopular take",
      severity: "high",
      risk: 78,
      trend: "up",
      summary: "Risk climbed from 41 to 78 in 14 min · without intervention, peak 95% in 90 min",
      signals: ["report rate ×4", "removal rate +12%", "new-account share 34%"],
      reports: 67,
      removals: 8,
      ageMin: 122,
    },
    {
      title: "Daily discussion — Tuesday",
      severity: "medium",
      risk: 58,
      trend: "flat",
      summary: "Steady volume · 2 contested comments under review",
      signals: ["disputed removals: 2"],
      reports: 24,
      removals: 3,
      ageMin: 410,
    },
    {
      title: "Weekly meta thread",
      severity: "healthy",
      risk: 22,
      trend: "down",
      summary: "Within baseline · no signals firing",
      signals: [],
      reports: 6,
      removals: 0,
      ageMin: 1340,
    },
  ],

  // ============================================================
  // 4. ACTIVITY LOG — audit trail with Undo
  // ============================================================
  activityLog: [
    {
      time: "14:23", actor: "u/mod_jane", actorKind: "mod",
      action: "enabled slow mode on \"How is this allowed?\"",
      trigger: { engine: "Raid Radar", value: "89% confidence" },
      chips: ["Undo", "See alert"],
    },
    {
      time: "13:47", actor: "Sentinel", actorKind: "sentinel",
      action: "auto-filtered new accounts on \"How is this allowed?\"",
      trigger: { engine: "Health Score", value: "risk 92" },
      chips: ["Undo", "See alert"],
    },
    {
      time: "12:10", actor: "u/mod_alex", actorKind: "mod",
      action: "dismissed Memory alert for u/suspect_user",
      chips: ["See alert"],
    },
    {
      time: "11:58", actor: "Sentinel", actorKind: "sentinel",
      action: "opened cluster #C-0442",
      trigger: { engine: "Raid Radar", value: "3 accounts in 60s" },
      chips: ["See alert"],
    },
    {
      time: "09:32", actor: "u/mod_jane", actorKind: "mod",
      action: "banned u/throwaway_4471",
      trigger: { engine: "Memory", value: "91% combined match" },
      chips: ["See alert"],
    },
    {
      time: "Yest", actor: "Sentinel", actorKind: "sentinel",
      action: "raised Health Score to HIGH",
      trigger: { engine: "Health Score", value: "removal rate +1.1" },
      chips: ["See alert"],
    },
  ],

  // ============================================================
  // 5. SETTINGS — Brief #18 (simple) + #19 (advanced)
  // ============================================================
  settings: {
    enabled: true,

    // Simple view — radio groups, not sliders. Three levels.
    engines: {
      "Raid Radar":   { enabled: true, level: "low"    },  // Low ◉ Medium ○ High
      "Memory":       { enabled: true, level: "high"   },  // Low ○ Medium ○ High ◉
      "Health Score": { enabled: true, level: "medium" },  // Low ○ Medium ◉ High ○
    },

    // Two checkboxes. Pinned dashboard is always-on (non-interactive).
    delivery: {
      pinnedDashboard: true,   // always true — checkbox shown disabled with "(always on)"
      modmailCritical: true,   // ☑ Modmail for critical alerts
    },

    advanced: {
      // Quiet hours — don't send modmail between HH:00 and HH:00 UTC
      quietHours: { enabled: false, fromHour: 22, toHour: 7 },

      // Auto-actions per engine. Memory has none — static label only.
      autoActions: {
        raidRadar: {
          slowMode:  { enabled: true,  confidence: 0.85 },
          filterNew: { enabled: true,  confidence: 0.85 },
        },
        // memory: explicitly absent — see static label in panel
        healthScore: {
          slowMode:  { enabled: false, risk: 90 },
          filterNew: { enabled: false, risk: 90 },
        },
      },

      // Filters
      exemptUsers:  ["u/AutoModerator", "u/mod_jane", "u/mod_alex", "u/community_bot"],
      exemptFlairs: ["Mod Post", "Megathread"],
      watchOnlyFlairs: { enabled: false, flairs: [] },

      // Per-signal weights — must sum to 100
      raidRadarWeights:  { velocity: 30, ageCluster: 25, overlap: 20, sync: 25 },
      healthScoreWeights:{ reportRate: 30, removalRate: 25, newAccountShare: 25, modmailVolume: 20 },

      // Calibration health (read-only, populated by backend)
      calibration: {
        totalAlerts7d: 47,
        falsePositiveRate: 0.08,   // 8%
        modActionsTaken: 31,
      },

      // Misc tuning
      modNotesSync: true,
      memoryMinComments: 10,         // gate: ignore accounts with < N comments
      slowModeVelocityImpact: 0.70,  // expected impact factor when slow-mode triggers
    },
  },
};
