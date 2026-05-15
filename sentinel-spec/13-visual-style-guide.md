Caveats answered:                                                                                                                                                                 12:25:36 [38/809]
                                                                                                                                                                                                       1. AdvancedSettings collapsed default — CORRECT per spec. Keep that pattern.                                                                                                                            Brief #18 has it as "▶ Advanced settings" accordion. Confirmed.
                                                                                                                                                                                                       2. RiskGauge — KEEP and RENDER. Spec uses it in Health Score thread detail panel
     (Brief #14). If your current panels don't render it, that's a gap — add it to                                                                                                                        the Threads tab thread-detail surface. Don't drop it.
                                                                                                                                                                                                       3. Empty states — YES wire them. Brief #21 spec'd these explicitly. Use the copy                                                                                                                        I sent last round.
                                                                                                                                                                                                       ---
                                                                                                                                                                                                       Below are the 3 briefs you asked for, verbatim from 12-design-briefs.md:
                                                                                                                                                                                                       ### Brief #18: Settings Tab — Simple View
                                                                                                                                                                                                       - Purpose: Default settings UI. Approachable for all mods. Most important controls                                                                                                                     visible, power-user options hidden.                                                                                                                                                                - When user sees it: Settings tab selected.                                                                                                                                                          - Inputs / data shown:                                                                                                                                                                                 - Master toggle: "Sentinel ON" / "Sentinel OFF" (large toggle)                                                                                                                                       - Engine sensitivity (three engines, three radio groups):                                                                                                                                              - Raid Radar: [Low ◉ Medium ○ High]                                                                                                                                                                  - Memory: [Low ○ Medium ◉ High]                                                                                                                                                                      - Health Score: [Low ○ Medium ◉ High]                                                                                                                                                              - Alert delivery (two checkboxes):                                                                                                                                                                     - ☑ Pinned dashboard (always on, non-interactive)                                                                                                                                                    - ☑ Modmail for critical alerts                                                                                                                                                                    - Collapsed "▶ Advanced settings" accordion                                                                                                                                                          - [Save] button                                                                                                                                                                                    - Specific design questions: Sticky Save button or only at bottom? How is the always-on                                                                                                                pinned-dashboard checkbox shown as non-interactive — disabled state or label?

  ### Brief #19: Settings Tab — Advanced Panel (Expanded)

  - Purpose: Power-user controls. Hidden by default.
  - When user sees it: Advanced accordion expanded.
  - Inputs / data shown:
    - Quiet hours: "☐ Don't send modmail between [HH]:00–[HH]:00 UTC"
    - Auto-actions per engine (opt-in):
      - Raid Radar: "☐ Auto-enable slow mode at confidence > 0.85"
                    "☐ Auto-filter new accounts at confidence > 0.85"
      - Memory: "(no auto-actions available — Memory always suggests, never acts)"
                static label
      - Health Score: "☐ Auto-enable slow mode at risk > 90"
                      "☐ Auto-filter new accounts at risk > 90"
    - Exempt users: text input "[add usernames]"
    - Exempt flairs: multi-select
    - Watch only flair filter: "☐ Only watch threads tagged with these flairs"  
    - Per-signal weights (Raid Radar): 4 percentage inputs summing to 100%
    - Per-signal weights (Health Score): 4 percentage inputs summing to 100%
    - Calibration health stats (read-only):
      - Total alerts (7d): [N]
      - False positive rate: [N]%
      - Mod actions taken: [N]
    - Mod Notes sync toggle: "Sync banned-index to Mod Notes: [yes/no]"
    - Memory min-comments gate: number input, default 10
    - slowModeVelocityImpact: number input, default 0.70

  ### Brief #24: "Sentinel is Ready" Modmail Template

  - Purpose: Auto-sent to mod team when bootstrap completes. First Sentinel-to-mod
    message. Needs to look intentional/professional in Reddit modmail interface.
  - Subject: "🛡️ Sentinel  is now active on r/[subname]"
  - Body:
    - Greeting: "Hi mods,"
    - Status: "Sentinel is now active. Detection runs immediately; accuracy improves
      over the next 7 days as your baseline warms up."
    - Dashboard link: "Your dashboard is now pinned at the top of the sub: [URL]"
    - Capability list (3 bullets): brigade detection / ban evaders / escalation prediction
    - Accuracy note: "Detection accuracy improves over the next 7 days as Sentinel learns
      your sub's specific patterns. You'll see a 'still learning' banner during this
      period — that's normal."
    - Help note: "Need help? See the Settings tab on your dashboard."
    - Sign-off: "— Sentinel"
  - Design questions: How does this render in Reddit's native modmail UI? Are subject-line
    emojis appropriate (do they render correctly)? How does the capability list look as a
    formatted block in Reddit's plaintext-ish composer?