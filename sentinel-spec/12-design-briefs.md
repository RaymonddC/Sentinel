# 12 · Design Briefs

## Purpose

This file is the design handoff for Sentinel's UI mockup generation. Each brief describes one screen, component, or visual interaction that needs an HTML mockup. Mockups are produced externally (e.g. Claude.ai) and used for visual reference during Milestone 7 polish.

This file does **not** specify colors, fonts, or layouts — those are mockup-side decisions. It specifies **what data is shown**, **when the component appears**, **what the user can interact with**, and **what open questions the designer must resolve**.

---

## How to use

1. Take each brief to Claude.ai (or similar) as a standalone prompt.
2. Prepend the visual style context from `06-dashboard-and-ui.md § Visual style` (dark mode, severity palette, restrained animation).
3. Generate an HTML mockup for each brief in isolation first, then assemble into a full-dashboard reference.
4. The brief numbering matches build priority roughly — lower numbers are more demo-critical.

---

## Briefs

---

### Brief #1: Welcome / Onboarding Modal

- **Purpose:** First thing a mod sees after installing Sentinel. Sets expectations, captures initial settings choices, and starts the bootstrap process. This window determines whether Sentinel gets used or uninstalled within 60 seconds.
- **When user sees it:** Immediately after the mod completes the Devvit install flow (AppInstall trigger fires).
- **Inputs / data shown:**
  - App name and icon ("👋 Welcome to Sentinel")
  - Inline status message: "Scanning your sub's recent activity to seed your baseline. Detection is active immediately; accuracy improves over the next 7 days."
  - Memory-specific note: "Memory activates the first time you ban a user; accuracy improves as your ban history grows."
  - Three sensitivity radio options: Low / Medium (pre-selected) / High
  - Two auto-action checkboxes (unchecked by default): "Allow Sentinel to enable slow mode on critical brigades" / "Allow Sentinel to filter new accounts on critical brigades"
  - Two alert delivery checkboxes (both checked by default): "Pinned dashboard post (always on)" / "Modmail for critical alerts"
  - Single CTA button: "Get started"
- **Interactions:** Radio group selection (one active at a time); checkbox toggles; "Get started" button submits → transitions to a "Setup in progress" inline message; modal should not block mod from navigating away.
- **Reference:** `07-onboarding-and-install.md § Step 2 — Welcome modal`
- **Specific design questions:** How does the modal appear inside a Devvit custom post context? Should the "still scanning" animation play while bootstrap runs? What does the transition look like after "Get started" is clicked — does the modal close, or transform into a progress state? How is the Memory cold-start note visually distinguished from the scanning note?

---

### Brief #2: Dashboard Header + KPI Tiles

- **Purpose:** Always-visible top section of the pinned dashboard post. Provides at-a-glance sub health and live engine status. The first thing a mod sees every time they open the dashboard.
- **When user sees it:** Every time the pinned dashboard post is opened or refreshed (polling every 30s).
- **Inputs / data shown:**
  - Header bar: `🛡️ SENTINEL — r/[subname]`
  - Status line: `[N] mods online · last update [Xs] ago · all engines: [ON/OFF]`
  - Four KPI tiles (always visible, in a horizontal row):
    1. **Active Threats** — integer count; highlights red if > 0
    2. **Threads Watched** — integer count (max 50)
    3. **Users Profiled** — integer count of fingerprints in Memory store
    4. **Time Saved Today** — formatted estimate (e.g., "6h 20m")
  - Master kill switch indicator (if Sentinel is OFF, all tiles and tabs show a "Sentinel is paused" overlay)
- **Interactions:** None directly on KPI tiles — they are display-only. Header may show a refresh indicator while polling. If a KPI tile is clickable (e.g., "Active Threats" navigates to Threats tab), document that affordance.
- **Reference:** `06-dashboard-and-ui.md § KPI tiles (top row)` and `§ Layout (top to bottom)`
- **Specific design questions:** How does the "red highlight" on Active Threats manifest — tile border, tile background, badge color? How does the time-saved estimate display when zero (e.g., first open of the day)? What does the header look like when Sentinel master toggle is OFF?

---

### Brief #3: Tab Bar Navigation

- **Purpose:** Primary navigation within the dashboard custom post. Switches between the five functional views.
- **When user sees it:** Below the KPI tiles, always visible while on the dashboard.
- **Inputs / data shown:**
  - Five tab labels: **Threats** | **Users** | **Threads** | **Activity Log** | **Settings**
  - Active tab indicator (underline, highlight, or filled)
  - Optional: badge/dot on Threats tab when Active Threats > 0
  - Default selected tab: Threats
- **Interactions:** Click any tab to reveal that tab's content panel below. Tab state is not persisted across sessions — always opens to Threats.
- **Reference:** `06-dashboard-and-ui.md § Tab: Threats` through `§ Tab: Settings`
- **Specific design questions:** How does the badge/alert dot on the Threats tab look without being visually noisy? Should inactive tabs be dimmed or simply unselected? How does the tab bar behave on narrow/mobile viewports — horizontal scroll, or does it wrap?

---

### Brief #4: Threats Tab — Alert Card Feed

- **Purpose:** Live feed of all open alerts from all three engines, newest first. This is the primary triage surface mods use to see what's happening right now.
- **When user sees it:** When the Threats tab is active (default tab on open).
- **Inputs / data shown:**
  - Feed of alert cards, sorted newest-first
  - Each card contains:
    - Severity badge (CRITICAL / HIGH / MEDIUM) with color coding
    - Engine icon (Raid Radar / Memory / Health Score)
    - Alert headline (e.g., "Coordinated brigade detected")
    - Time ago (e.g., "2m ago")
    - One-line summary (e.g., "38 new accounts from r/external hit '[thread title]' in 90 seconds. Confidence 89%.")
    - Signal pills: checkmarks for each fired signal (e.g., "✓ velocity ✓ age cluster ✓ overlap ✓ sync")
    - Row of action buttons (engine-specific; see Brief #8)
  - Empty state when no open alerts (see Brief #21)
  - "Calibrating" badge overlaid on alerts during 7-day ramp (see Brief #22)
- **Interactions:**
  - Click the alert headline → expands or navigates to the engine-specific detail view (cluster graph for Raid Radar, User Spotlight for Memory, risk gauge for Health Score)
  - Action buttons inline on each card (no navigation required for quick actions)
  - "False positive" button on each card
- **Reference:** `06-dashboard-and-ui.md § Tab: Threats`; `03-engine-raid-radar.md § Dashboard panel`
- **Specific design questions:** How are CRITICAL vs HIGH vs MEDIUM cards visually differentiated — border color, left accent bar, icon color? How many cards are shown before pagination or "load more"? What does a Memory alert card look like vs a Raid Radar vs a Health Score alert card — are they identical in structure or engine-specific? Where does the false-positive button live on the card — inline or revealed on hover/expand?

---

### Brief #5: Severity Badge Component

- **Purpose:** Reusable chip/tag component used on alert cards, triage queue items, and User Spotlight. Provides consistent, accessible severity signaling across all three engines.
- **When user sees it:** On every alert card, every triage queue row, on the User Spotlight risk score, and on signal pills.
- **Inputs / data shown:**
  - Severity level: CRITICAL / HIGH / MEDIUM / LOW / HEALTHY
  - Color per level (from spec palette):
    - CRITICAL → red `#e74c3c`
    - HIGH → orange `#f39c12`
    - MEDIUM → yellow-amber `#f5b041`
    - LOW / MONITORING → yellow `#f5b041` (lighter)
    - HEALTHY → green `#46a973`
  - Label text (optionally abbreviated on small viewports)
  - Optional icon (🔴 🟠 🟡 🟢)
- **Interactions:** Not interactive on its own; parent container handles click.
- **Reference:** `06-dashboard-and-ui.md § Visual style`; `05-engine-health-score.md § Risk levels and dashboard color coding`
- **Specific design questions:** Should badges use filled backgrounds or bordered/outlined style? How large is the badge in different contexts (card vs table row vs spotlight header)? What is the accessible fallback when color cannot be the only signal — text label always present?

---

### Brief #6: Raid Radar Alert Detail Panel

- **Purpose:** Full detail view opened when a mod clicks on a Raid Radar alert headline. Shows the complete picture: cluster graph + signal breakdown + action buttons.
- **When user sees it:** After clicking a Raid Radar alert card (modal overlay or inline expansion).
- **Inputs / data shown:**
  - Alert header: "🚨 ACTIVE BRIGADE DETECTED" (or ✅ "All clear" if alert has been actioned)
  - Confidence score: large numeric (e.g., "89%") with severity color
  - Summary: "38 new accounts from r/external in 90 seconds"
  - Target thread link/title
  - Triggered: "[N] minutes ago"
  - Cluster graph widget (see Brief #7 — lazy-loaded in this panel)
  - Signal breakdown section (see Brief #9)
  - Action buttons row (see Brief #8)
  - "Calibrating" overlay badge if during 7-day ramp
- **Interactions:**
  - Clicking an account node in the cluster graph → opens Memory User Spotlight for that user (side panel or navigation)
  - Action buttons (Lock thread / Slow mode / Filter new / Notify team / False positive)
  - "Dismiss" or "Close" to return to the alert feed
- **Reference:** `03-engine-raid-radar.md § Dashboard panel for Raid Radar`; `06-dashboard-and-ui.md § Tab: Threats — Cluster graph implementation constraints`
- **Specific design questions:** Is this detail view a full-panel replace of the tab content, a modal overlay, or an inline expand below the alert card? How is the "Calibrating" badge shown during the ramp period — banner, watermark, or badge on confidence score? What does the panel look like if the alert has already been actioned (alert status = 'actioned')?

---

### Brief #7: Cluster Graph Widget

- **Purpose:** Visualizes the brigade cluster: which accounts arrived together and where they came from. The most visually striking element in the demo ("red dots radiating from external sub to target thread").
- **When user sees it:** Lazy-loaded only after a Raid Radar alert detail panel is explicitly opened — never rendered inline in the card feed.
- **Inputs / data shown:**
  - Fixed-height container: 320px (must not cause layout shift when loaded)
  - Center node: target thread (post title or icon)
  - Surrounding account nodes: up to 20 displayed; accounts beyond 20 collapsed into a "+N more accounts" badge
  - Edge connections: lines from each account node to the center, labeled with the shared external sub (e.g., "r/external")
  - Node color: red = >0.9 confidence, orange = 0.7–0.9, yellow = monitoring
  - Node labels: account names (abbreviated if needed)
  - Optional: "+N more accounts" badge for overflow
  - Loading spinner while lazy-loading
- **Interactions:**
  - Click an account node → opens Memory User Spotlight for that user
  - Hover an account node → shows tooltip: account age, comment count, confidence score
  - "+N more accounts" badge → shows a text list of overflow accounts (not additional nodes)
- **Reference:** `03-engine-raid-radar.md § Middle: Cluster visualization`; `06-dashboard-and-ui.md § Cluster graph implementation constraints`; `00-architectural-summary.md § Open Questions #4`
- **Specific design questions:** What rendering approach fits Devvit Blocks (SVG nodes, circles + lines, or a purely CSS layout)? How does the graph degrade gracefully for 1 node vs 20 nodes? What does the loading state look like in the 320px fixed container? How does the "+N more" overflow badge appear — below the graph, as a node, or as a legend item?

---

### Brief #8: Action Buttons Row (Raid Radar)

- **Purpose:** Gives mods one-click reversible interventions directly from the alert view. Every button must show confirmation state and be undoable.
- **When user sees it:** On alert cards in the Threats feed, and prominently in the Raid Radar detail panel.
- **Inputs / data shown:**
  - Five buttons:
    1. 🔒 **Lock thread** — permanently locks thread to approved users only
    2. ⏱️ **Slow mode (5 min)** — adds 5-minute cooldown between comments
    3. 🔍 **Filter new accounts** — requires account age before commenting
    4. 📨 **Notify mod team** — sends modmail to mod team
    5. ✓ **False positive** — marks as not a real threat
  - Button states: default / in-progress / confirmed (post-action) / error
  - Reversible actions show a small "Undo" link or clock icon after actioning (within 24h revert window)
  - "Lock thread" is irreversible — shows a warning/confirmation step before firing
- **Interactions:**
  - Click any button → immediate visual feedback (button state change) → action executes → confirmation state shown
  - For "Lock thread" specifically → show a confirmation dialog before executing
  - After action → button transforms to show "Undo" (within 24h window) + timestamp
  - "False positive" → alert card style changes (dimmed) and moves to bottom of feed or is removed
- **Reference:** `03-engine-raid-radar.md § Action buttons`; `06-dashboard-and-ui.md § Tab: Activity Log` (audit trail of actions)
- **Specific design questions:** How are active (already-taken) actions visually distinguished from available actions? Is "Undo" shown inline on the button, or in the Activity Log only? How does the confirmation dialog for "Lock thread" appear within a Devvit Blocks context (no native browser modals)? What happens to buttons when Sentinel master toggle is OFF?

---

### Brief #9: Raid Radar Signal Breakdown

- **Purpose:** Shows which of the 4 Raid Radar signals fired and how strongly. Provides explainability — mods understand WHY the alert fired, which is critical for trust and false-positive feedback.
- **When user sees it:** In the Raid Radar alert detail panel, below the confidence score.
- **Inputs / data shown:**
  - Four rows, one per signal:
    1. New-user influx: checkmark/cross + intensity label + details (e.g., "✓ New-user influx  +717%  z=6.2")
    2. Account-age cluster: checkmark/cross + intensity + details (e.g., "✓ Account-age cluster  ←low diversity  median 6d")
    3. Sub overlap: checkmark/cross + intensity + details (e.g., "✓ Sub overlap  94%  r/external")
    4. Sync timing: checkmark/cross + intensity + details (e.g., "✓ Sync timing  σ=0.91")
  - Each row: fired signals are highlighted (checked + bright); unfired signals are dimmed (cross + muted)
  - Optional: mini bar chart showing relative signal strength per row
- **Interactions:** None — display only. May be expandable/collapsible if space is tight.
- **Reference:** `03-engine-raid-radar.md § Bottom: Signal breakdown`; `06-dashboard-and-ui.md § Tab: Threats`
- **Specific design questions:** How is "signal fired" visually distinguished from "signal not fired" — color, icon, opacity? How are the detail values (z=6.2, median 6d) formatted for readability at small sizes? Should each row show a progress-bar-style strength indicator in addition to the numeric values?

---

### Brief #10: Users Tab — Search + Risk List

- **Purpose:** Direct entry point for investigating specific users. Mods can search by username or see who is highest risk right now.
- **When user sees it:** When the Users tab is selected.
- **Inputs / data shown:**
  - Search input: placeholder "Type a username to investigate"
  - "Highest risk online now" section: list of users with Memory risk scores ≥ 70
  - Each user row in the list:
    - Username
    - Confidence score (% match, e.g., "94% match")
    - Account age (e.g., "3 days old")
    - Matched-against label (e.g., "matches u/banned_2024_03")
    - Severity badge
  - Empty state for the risk list (see Brief #21)
- **Interactions:**
  - Type in search box → as user types, search executes → results appear below the search field
  - Click any user (from search results or risk list) → opens User Spotlight panel (Brief #11)
  - Empty search → shows the "Highest risk" list as default content
- **Reference:** `06-dashboard-and-ui.md § Tab: Users`; `04-engine-memory.md § What Memory shows the mod`
- **Specific design questions:** Is the search synchronous (filter from cached data) or async (calls Devvit)? What does the user row look like when there is no Memory match (user is profiled but low risk)? How many rows show in the "Highest risk" list before truncation?

---

### Brief #11: Memory — User Spotlight Panel

- **Purpose:** Detailed per-user investigation view. Shows behavioral profile, Memory match details, and mod action history. The "smoking gun" entry point before the side-by-side view.
- **When user sees it:** When a mod clicks any username from: the Users tab, a cluster graph node, the Threats feed, or a mod menu item.
- **Inputs / data shown:**
  - User header: `👤 u/[username]`
  - Account metadata: "Account age: 3 days · 47 comments"
  - Risk score: large numeric (e.g., "Risk score: 94 (HIGH)")
  - Match status block (if match found):
    - Alert banner: "⚠️ POSSIBLE BAN EVADER"
    - Matched-to label: "Strong match to u/[banned_user]"
    - Ban context: "(banned [date] for [reason])"
  - Behavioral match subsection:
    - Score: "✓ Behavioral match: 87%"
    - Bullet reasons: same posting hours, same comment length distribution, % sub overlap
  - Stylometry match subsection:
    - Score: "✓ Stylometry match: 94%"
    - Bullet reasons: punctuation profile, trigram fingerprint, emoji preferences (e.g., 😤 💀 🤡)
  - Combined confidence: "Combined confidence: 91%"
  - Other context section: report count, subreddit overlap details
  - "Insufficient text for stylometry" note when < 10 comments (edge case)
  - Cold-start state: "No ban history yet — Memory will start matching once mods take ban actions." (see Brief #23)
  - Action row: [View side-by-side] [Ban] [Dismiss]
- **Interactions:**
  - "View side-by-side" → opens fingerprint comparison panel (Brief #12)
  - "Ban" → executes ban with audit trail; confirmation required
  - "Dismiss" → removes from risk list; feeds calibration loop
  - Panel has a close/back navigation
- **Reference:** `04-engine-memory.md § What Memory shows the mod`
- **Specific design questions:** How is the panel presented — as a full tab replacement, a modal overlay, or a slide-in side panel? How are the "Behavioral match" and "Stylometry match" subsections visually separated (card, divider, accordion)? What does the panel look like when there is no match (user is profiled but no threat)? How is "POSSIBLE BAN EVADER" framed to avoid implying certainty?

---

### Brief #12: Memory — Side-by-Side Fingerprint Comparison

- **Purpose:** The "smoking gun" view. Two-column layout directly comparing the banned user's fingerprint to the suspected evader's fingerprint. Demo moment at [0:18–0:25].
- **When user sees it:** When mod clicks "View side-by-side" from the User Spotlight panel.
- **Inputs / data shown:**
  - Left column header: `u/[banned_user]` + "(banned [N] mo ago)"
  - Right column header: `u/[suspect_user]` + "([N] days old)"
  - Compared data rows (left vs right side-by-side):
    - Posting hours: e.g., "19–22 UTC peak" | "19–22 UTC peak"
    - Avg comment length: e.g., "47 chars" | "51 chars"
    - Top emojis: e.g., "😤 💀 🤡 😅 🙄" | "😤 💀 🤡 😅 🤡"
    - Sample comment excerpt: e.g., `"tbh idk why ppl even bother lol"` | `"tbh idk why this keeps happening lol"`
  - Optional: visual indicator highlighting matching/diverging cells (green = match, neutral = different)
  - Close / Back button
- **Interactions:** Read-only view. Close button returns to User Spotlight. Optional: expand a row to show full histogram (e.g., posting-time bar chart).
- **Reference:** `04-engine-memory.md § Side-by-side view`; `09-demo-video-script.md § [0:18–0:25] Memory tie-in`
- **Specific design questions:** How are strongly matching rows highlighted vs mismatching rows? Are posting-hour histograms shown as tiny bar charts inline in the cell, or as text ranges? How does the layout adapt on mobile (single column alternating, or stacked pairs)? Is the sample comment shown verbatim or truncated?

---

### Brief #13: Threads Tab — Triage Queue

- **Purpose:** Lists all watched threads sorted by risk score. Mods use this to decide which thread to look at next. A purpose-built "inbox sorted by fire risk."
- **When user sees it:** When the Threads tab is selected.
- **Inputs / data shown:**
  - Sort control: "by risk (default) | by recency | by comment count"
  - Filter control: "critical / high / all"
  - List of up to 50 thread rows, each showing:
    - Risk score (large, colored: 🔴 89% / 🟠 78% / 🟡 42% / 🟢 12%)
    - Thread title (truncated)
    - Comment count + time active (e.g., "487 cmts · 3h")
    - Trajectory indicator (↑ rising / → stable / ↓ falling)
  - Empty state (see Brief #21)
- **Interactions:**
  - Click sort/filter controls → list re-orders or filters
  - Click a thread row → opens Health Score thread detail (Brief #14)
  - Hover a thread row → shows abbreviated signal breakdown in a tooltip
- **Reference:** `06-dashboard-and-ui.md § Tab: Threads`; `05-engine-health-score.md § Section A: Triage queue`
- **Specific design questions:** How is the trajectory indicator (rising/stable/falling) shown — arrow icon, sparkline, or colored caret? What does a row look like for a thread with no Health Score yet (too new)? How is the active/selected thread visually indicated when the detail panel is open alongside the list?

---

### Brief #14: Health Score — Thread Detail (Gauge + Trajectory)

- **Purpose:** In-depth view for a selected watched thread. Shows current risk, trajectory history, and forecast. Opens when mod clicks a thread in the triage queue.
- **When user sees it:** When a thread row is clicked in the Threads tab, or via the "Show Health Score" mod menu item on a post.
- **Inputs / data shown:**
  - Thread title + link
  - Risk gauge: large radial/arc gauge 0–100, color-coded (green → amber → orange → red)
  - Current risk numeric: e.g., "78"
  - Severity label: "High"
  - Trajectory chart: sparkline or mini time-series for the last 3 hours (risk score over time)
  - Risk trajectory label: "↑ Rising" / "→ Stable" / "↓ Falling"
  - Health Score signal bars section (see Brief #15)
  - Forecast panel (see Brief #16)
  - Action buttons: Lock / Slow Mode / Filter New Accts / Dismiss
- **Interactions:**
  - Hovering trajectory chart → shows timestamps and risk values at data points
  - Action buttons → same mechanics as Raid Radar action buttons (confirmation, undo, audit)
  - Dismiss → flags that this thread was a false positive; feeds calibration loop
- **Reference:** `05-engine-health-score.md § Section B: Selected thread detail`; `06-dashboard-and-ui.md § Tab: Threads`
- **Specific design questions:** Is the risk gauge a radial arc dial (like a speedometer), a horizontal progress bar, or a numeric block? How does the trajectory sparkline render over 3 hours — does it show discrete 5-min buckets or a smooth curve? Does the gauge animate when the risk score updates?

---

### Brief #15: Health Score — Signal Bars

- **Purpose:** Per-signal strength visualization for the four Health Score signals. Shows which signals are driving the risk score and how strongly.
- **When user sees it:** In the Health Score thread detail panel, below the risk gauge.
- **Inputs / data shown:**
  - Four signal rows:
    1. Velocity: bar fill + value + label (e.g., "4.1σ above baseline")
    2. Sentiment: bar fill + value + label (e.g., "swing of 0.72")
    3. New accounts: bar fill + value + label (e.g., "34% new")
    4. Report rate: bar fill + value + label (e.g., "5.8σ above baseline")
  - Bar fill: 0–100% of container, colored by signal strength (green → red as strength increases)
  - Each row: signal name + bar + numeric detail
  - Unfired (zero-strength) signals are shown dimmed with a "—" or near-empty bar
- **Interactions:** Display only. May show a tooltip on hover explaining what each signal measures.
- **Reference:** `05-engine-health-score.md § The four signals`; `05-engine-health-score.md § Risk score computation`
- **Specific design questions:** Are signal bars horizontal (label on left, bar extends right) or vertical (small column chart)? How is "strong signal" (>threshold) visually marked vs "moderate" vs "not firing"? Should each bar have a threshold marker (e.g., a vertical line at the "strong signal" boundary)?

---

### Brief #16: Health Score — Forecast Panel

- **Purpose:** Shows the 1h and 2h projected risk scores, and what the score would be if slow mode were enabled. This is the predictive differentiator — mods see the future, not just the present.
- **When user sees it:** In the Health Score thread detail panel, below the signal bars.
- **Inputs / data shown:**
  - Section header: "Forecast"
  - Without intervention column:
    - "In 1 hour: [N]%"
    - "In 2 hours: [N]%"
    - "Comments expected: [N]"
  - With slow mode column:
    - "In 1 hour: [N]% (↓ with slow mode)"
    - "In 2 hours: [N]% (↓ with slow mode)"
  - Example verbatim: "Without intervention, projected to hit 95% in 90 minutes. With slow mode, predicted peak: 51%."
  - Disclaimer note: "Forecast based on current trajectory; slowModeVelocityImpact default 0.70 (pending empirical validation)"
- **Interactions:** Display only. "Enable slow mode" shortcut button may appear inline in the forecast panel.
- **Reference:** `05-engine-health-score.md § Forecast generation`; `09-demo-video-script.md § [0:42–0:50]`
- **Specific design questions:** Is the forecast shown as two columns (without vs with intervention), or as a before/after toggle? How are the projected numbers color-coded — by the severity of the projected score, or neutral? Is the slowModeVelocityImpact disclaimer visible to all mods, or only in advanced settings?

---

### Brief #17: Activity / Audit Log Tab

- **Purpose:** Append-only log of every action Sentinel or a mod has taken. Provides accountability, reversibility, and cross-mod transparency.
- **When user sees it:** When the Activity Log tab is selected.
- **Inputs / data shown:**
  - Filter controls: "by mod | by engine | by action type"
  - Log entries, newest first, each showing:
    - Timestamp (e.g., "14:23")
    - Actor: "u/[ModName] enabled slow mode on '[thread title truncated]'"
    - Trigger: "Triggered by: [Engine] ([confidence]% confidence)"
    - Inline action links: [Undo] (only within 24h revert window) · [See alert]
  - Entries for both Sentinel auto-actions and mod-manual actions
  - Entries marked with engine icon (Raid Radar / Memory / Health Score / Manual)
  - 30-day retention note in footer
  - Empty state (see Brief #21)
- **Interactions:**
  - [Undo] button → reverts the action (within 24h window); button disappears after 24h
  - [See alert] → navigates to the alert that triggered this action
  - Filter controls → narrows log entries
- **Reference:** `06-dashboard-and-ui.md § Tab: Activity Log`; `00-architectural-summary.md § Audit log`
- **Specific design questions:** How is the [Undo] button visually de-emphasized after 24h (greyed out, hidden, or replaced with "window expired")? How are auto-actions (by Sentinel) distinguished from mod-manual actions? How many entries are shown before pagination?

---

### Brief #18: Settings Tab — Simple View

- **Purpose:** Default settings UI. Approachable for all mods. Shows only the most important controls and hides power-user options.
- **When user sees it:** When the Settings tab is selected.
- **Inputs / data shown:**
  - Master toggle: "Sentinel ON" / "Sentinel OFF" (large toggle)
  - Engine sensitivity section (three engines, three radio groups):
    - Raid Radar: [Low ◉ Medium ○ High]
    - Memory: [Low ○ Medium ◉ High]
    - Health Score: [Low ○ Medium ◉ High]
  - Alert delivery section (two checkboxes):
    - ☑ Pinned dashboard (always on, non-interactive)
    - ☑ Modmail for critical alerts
  - Collapsed "▶ Advanced settings" section (click to expand; see Brief #19)
  - [Save] button
- **Interactions:**
  - Toggle master switch → immediate visual state change + confirmation
  - Radio group selection per engine
  - Checkbox toggles for alert delivery
  - "Advanced settings" accordion expands/collapses
  - [Save] → validates and saves; shows success/error feedback
- **Reference:** `06-dashboard-and-ui.md § Tab: Settings`
- **Specific design questions:** Should the [Save] button be sticky/always visible, or only at the bottom of the form? How is the "Pinned dashboard (always on)" checkbox communicated as non-interactive — disabled state, tooltip, or informational label? What does the success state look like after Save?

---

### Brief #19: Settings Tab — Advanced Panel (Expanded)

- **Purpose:** Power-user controls. Hidden by default. Gives fine-grained tuning without overwhelming casual mods.
- **When user sees it:** When the "Advanced settings" accordion in the Settings tab is expanded.
- **Inputs / data shown:**
  - Quiet hours section: "☐ Don't send modmail between [HH]:00–[HH]:00 UTC" (time inputs)
  - Auto-actions per engine (opt-in):
    - Raid Radar: "☐ Auto-enable slow mode at confidence > 0.85" / "☐ Auto-filter new accounts at confidence > 0.85"
    - Memory: "(no auto-actions available — Memory always suggests, never acts)" — static label
    - Health Score: "☐ Auto-enable slow mode at risk > 90" / "☐ Auto-filter new accounts at risk > 90"
  - Exempt users text field: "[add usernames]"
  - Exempt flairs multi-select
  - Watch only flair filter: "☐ Only watch threads tagged with these flairs"
  - Per-signal weights (Raid Radar): four percentage inputs summing to 100%
  - Per-signal weights (Health Score): four percentage inputs summing to 100%
  - Calibration health stats (read-only):
    - Total alerts (7d): [N]
    - False positive rate: [N]%
    - Mod actions taken: [N]
  - Mod Notes sync toggle: "Sync banned-index to Mod Notes: [yes/no]"
  - Memory min-comments gate: "Require [N] comments before evaluating" (number input, default 10)
  - slowModeVelocityImpact: "Slow mode velocity reduction: [0.70]" (number input)
- **Interactions:** All inputs interactive; [Save] at bottom of the section.
- **Reference:** `06-dashboard-and-ui.md § Tab: Settings — Expanded advanced section`; `04-engine-memory.md § Optional Mod Notes integration`
- **Specific design questions:** How does the "per-signal weights" input enforce that four numbers sum to 100%? How is the "Memory always suggests, never acts" message styled to be informative rather than confusing? Should calibration health stats have a "?" info icon explaining how they're calculated?

---

### Brief #20: Memory — Cold-Start Banner (PRI-4)

- **Purpose:** Communicates that Memory has no ban history yet and cannot match evaders. Appears prominently in the User Spotlight and Users tab. Prevents mods from thinking Memory is broken.
- **When user sees it:** In the User Spotlight panel and Users tab when the banned-index is empty (no ban actions have been taken yet on this sub installation).
- **Inputs / data shown:**
  - Banner/notice text: "No ban history yet — Memory will start matching once mods take ban actions."
  - Optional secondary: "To accelerate: enable Mod Notes sync in Settings to import your sub's existing ban history."
  - Dismissible (per session, not permanently)
- **Interactions:** Dismiss button hides for the session. "Go to Settings" link in the notice.
- **Reference:** `04-engine-memory.md § Cold-start behavior`; `07-onboarding-and-install.md § Welcome modal`
- **Specific design questions:** How is this distinguished from the calibration ramp banner (Brief #22) — different color, different icon? Should this banner appear every session until the first ban is recorded, or only once after install?

---

### Brief #21: Empty States

- **Purpose:** Communicates clearly and usefully when a tab or section has no data. Empty states are opportunities to set expectations, not just placeholder text.
- **When user sees it:** On each tab/section when there is nothing to show.
- **Inputs / data shown:**
  - Threats tab empty state: Icon (✅) + "No active threats. All engines are monitoring." + timestamp of last scan
  - Users tab empty state (no search results): "No users match '[query]'. Try a different username."
  - Users tab empty state (risk list empty): "No high-risk users detected right now."
  - Threads tab empty state: "No threads being watched. Active threads will appear here automatically."
  - Activity Log empty state: "No actions recorded yet. Actions taken by Sentinel or mods will appear here."
  - Cluster graph loading state: spinner within the 320px fixed container
- **Interactions:** None except possibly a "Refresh" link on the Threats tab empty state.
- **Reference:** `06-dashboard-and-ui.md § Tab: Threats`, all tab sections
- **Specific design questions:** Should empty states include an icon/illustration, or just text? How are empty states during the calibration ramp different from post-ramp empty states? What is the empty-state copy for a brand-new install vs an established install with genuine quiet?

---

### Brief #22: Calibration Ramp Banner

- **Purpose:** Communicates to mods that Sentinel is still learning and confidence is conservative. Present for the first 7 days. Prevents mods from losing trust when alerts are fewer or less confident than expected.
- **When user sees it:** As a banner at the top of the dashboard (above the KPI tiles) for the first 7 days post-install. Also as a small badge on each alert card during this period.
- **Inputs / data shown:**
  - Banner text: "ℹ️ Sentinel is calibrating to your sub. Detection is active, accuracy improves over the next [N] days. Current accuracy estimate: [N]% (improving)"
  - Days remaining computed dynamically (e.g., "6 days remaining")
  - Optional: progress bar showing ramp completion (0% → 100% over 7 days)
  - Per-alert badge: "Calibrating" chip overlaid on confidence score
- **Interactions:** Banner is not dismissible (it auto-removes after 7 days). Per-alert badge has no interaction.
- **Reference:** `07-onboarding-and-install.md § Step 5 — Calibration ramp`; `07-onboarding-and-install.md § What happens during the 7-day calibration`
- **Specific design questions:** How is this banner visually distinguished from a warning/error banner — it is informational, not alarming? Where exactly does it appear (above KPI tiles, between KPI tiles and tab bar, or above tabs)? Does the banner shrink or change appearance as days pass?

---

### Brief #23: Demo / Calibrated Test Sub Banner (PRI-2)

- **Purpose:** In-app framing for the demo context. When Sentinel is run on a small test sub with High Sensitivity and pre-staged scenarios, a visible banner communicates that this is demo mode — preserving honest framing for viewers.
- **When user sees it:** Only on the demo/test sub configuration, not in production. Shown during the demo video recording and in any screenshots submitted to Devpost/app listing.
- **Inputs / data shown:**
  - Banner text: "Demo mode — calibrated test sub. Pre-staged scenarios active. See Devpost for details."
  - Optional: small "i" info icon linking to the public framing copy from the demo video script
  - Visually distinct from the calibration ramp banner — different color, different icon
- **Interactions:** Read-only informational banner. Not dismissible.
- **Reference:** `09-demo-video-script.md § Statistical realism note`; `09-demo-video-script.md § Public framing`
- **Specific design questions:** How is this banner styled to be clearly "demo-mode" — different accent color (purple/blue?) to distinguish from operational yellow/orange banners? Should this only appear in the dashboard header, or also on individual alert cards?

---

### Brief #24: "Sentinel is Ready" Modmail Template

- **Purpose:** Auto-sent to mod team when bootstrap completes. Needs to look intentional and professional in Reddit's modmail interface. First communication from Sentinel to the mod team.
- **When user sees it:** In Reddit modmail, sent to the mod team of the sub after bootstrap finishes.
- **Inputs / data shown:**
  - Subject: "🛡️ Sentinel is now active on r/[subname]"
  - Body:
    - Greeting: "Hi mods,"
    - Status: "Sentinel is now active. Detection runs immediately; accuracy improves over the next 7 days as your baseline warms up."
    - Dashboard link: "Your dashboard is now pinned at the top of the sub: [URL]"
    - Capability list: three bullet points (brigade detection, ban evaders, escalation prediction)
    - Accuracy note: "Detection accuracy improves over the next 7 days as Sentinel learns your sub's specific patterns. You'll see a 'still learning' banner during this period — that's normal."
    - Help note: "Need help? See the Settings tab on your dashboard."
    - Sign-off: "— Sentinel"
- **Interactions:** None — this is a modmail message, not an interactive UI component. Design focuses on formatting and readability.
- **Reference:** `07-onboarding-and-install.md § Step 4 — 'Sentinel is ready' message`
- **Specific design questions:** How should the modmail render in Reddit's native modmail UI? Are emojis in the subject line appropriate for modmail (do they render correctly)? How does the capability list look as a formatted block inside Reddit's plaintext-ish modmail composer?

---

### Brief #25: Mobile Responsive Layout Variant

- **Purpose:** Sentinel's dashboard must render usably on mobile Reddit (Devvit custom posts render on mobile). The full desktop layout will not fit on narrow viewports.
- **When user sees it:** When a mod opens the dashboard post on a mobile device (iOS/Android Reddit app, mobile web).
- **Inputs / data shown:**
  - Same content as desktop dashboard, but adapted:
    - KPI tiles: 2×2 grid instead of horizontal row (or scroll horizontally)
    - Tab bar: horizontal scroll or compressed labels
    - Alert cards: full-width, action buttons stack vertically or wrap
    - Cluster graph: 320px fixed height preserved; node labels abbreviated
    - Side-by-side fingerprint comparison: alternating rows (banned user row / suspect row) instead of two-column layout
    - Settings tab: all form elements full-width
    - Signal breakdown bars: full-width bars
- **Interactions:** Same as desktop; touch targets must be ≥44×44px for accessibility.
- **Reference:** `06-dashboard-and-ui.md § Mobile considerations`; `06-dashboard-and-ui.md § Accessibility`
- **Specific design questions:** Which layout collapse breakpoints matter most for Reddit's mobile apps (typically 375px–414px wide)? Which components are most likely to break on narrow viewports — cluster graph, side-by-side fingerprint, or settings form? Should the tab bar collapse to icons-only on mobile, or abbreviate label text?

---

*End of Design Briefs — 25 briefs total.*
