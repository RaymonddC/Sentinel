# 06 · Dashboard and UI

## Changelog

| Rev | Section changed | Summary | Plan-review citation |
|---|---|---|---|
| R-Cluster-Graph | § Tab: Threats | Cluster graph lazy-load, ≤20-node cap, 320 px fixed height, alertId in-memory cache, ≤2 MB write constraint added | `00-plan-review.md` (v4) R-Cluster-Graph |

> What the mod sees when Sentinel is installed. The visual mockup at `tier_s_mockups.html` and `sentinel_demos.html` are reference implementations — match the structure, refine details as needed.

---

## Where Sentinel lives in the sub

Sentinel installs as a Devvit app on a subreddit. Once installed, it manifests in three places:

1. **A pinned mod-only custom post** — the main dashboard. Created on install, kept up-to-date by the engines.
2. **Mod menu items** — added to context menus on posts and users for direct access.
3. **Modmail messages** — for critical alerts only.

There is no separate website. There is no separate app to launch. The dashboard is a Devvit custom post — that's the entire UX surface.

---

## The pinned dashboard custom post

This post is auto-created on install. It uses Devvit Blocks to render dynamically — the content updates as engines fire. Mods see live state every time they open the post.

### Visibility

- Visible only to users with mod permissions on the sub
- Pinned to the sub by Sentinel
- Title: `🛡️ Sentinel Dashboard — DO NOT REMOVE`
- Author: the Sentinel app account

### Layout (top to bottom)

```
┌─────────────────────────────────────────────────────────┐
│ 🛡️ SENTINEL — r/yoursub                                 │
│ 4 mods online · last update 12s ago · all engines: ON  │
├─────────────────────────────────────────────────────────┤
│ KPI ROW (4 tiles)                                       │
│ Active Threats │ Threads Watched │ Users Profiled │ TST│
├─────────────────────────────────────────────────────────┤
│ TAB BAR                                                 │
│ [Threats] [Users] [Threads] [Activity Log] [Settings]   │
├─────────────────────────────────────────────────────────┤
│ TAB CONTENT (varies based on selection)                 │
│                                                         │
│ ...                                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### KPI tiles (top row)

Always visible. Updated in near-real-time.

- **Active Threats** — count of `status: 'open'` alerts; red highlight if >0
- **Threads Watched** — count of currently-monitored threads
- **Users Profiled** — count of fingerprints in Memory store
- **Time Saved Today** — calculated estimate (e.g., 12 brigades caught × 30 min avg manual time = 6h)

### Tab: Threats (default)

Live feed of open alerts, newest first. Each alert is an interactive card:

```
┌───────────────────────────────────────────────────────┐
│ 🔥 [CRITICAL] Coordinated brigade detected     2m ago │
│                                                       │
│ 38 new accounts from r/external hit "Why does this   │
│ policy keep getting passed..." in 90 seconds.        │
│ Confidence 89%.                                      │
│                                                       │
│ Signals: ✓ velocity ✓ age cluster ✓ overlap ✓ sync   │
│                                                       │
│ [Lock thread] [Slow mode] [Filter new] [False pos.]  │
└───────────────────────────────────────────────────────┘
```

Clicking the alert title opens the engine-specific detail view (the cluster graph for Raid Radar, the side-by-side for Memory, the gauge + signals for Health Score).

**Cluster graph implementation constraints (Raid Radar detail view):**
- **Lazy-load:** render only after the user explicitly opens an alert's detail view — do not render inline in the card list.
- **Node cap:** ≤20 nodes; collapse remainder into "+N more accounts" badge.
- **Fixed-height container:** 320 px to prevent layout shift.
- **In-memory cache:** rendered structure cached by alertId; no re-render on re-open unless alert state has changed.
- **Cluster-state cache writes:** ≤2 MB per write (see `02-architecture.md` § Devvit Redis schema note on 5 MB per-request cap).

### Tab: Users

User Spotlight panel as defined in `04-engine-memory.md`. Top of tab:
- Search box: type a username to investigate
- "Highest risk online now" — list of users with risk scores ≥70

### Tab: Threads

Triage queue as defined in `05-engine-health-score.md`. Top of tab:
- Sort: by risk (default) | by recency | by comment count
- Filter: critical / high / all

### Tab: Activity Log

Per `02-architecture.md`, every Sentinel-triggered action is logged with full reversal capability.

```
14:23  u/ModeratorAlex enabled slow mode on "Why does..."
       Triggered by: Raid Radar (89% confidence)
       [Undo] [See alert]

13:47  u/ModeratorAlex banned u/totally_new_user_99
       Triggered by: Memory (94% match to u/banned_2024)
       [Undo] [See evidence]
```

Filters: by mod, by engine, by action type. 30-day retention.

### Tab: Settings

The tiered settings UI (Q7 decision):

```
┌─────────────────────────────────────────────────────────┐
│ ⚙️ Sentinel Settings                                    │
├─────────────────────────────────────────────────────────┤
│ Master toggle:  [●] Sentinel ON                         │
│                                                         │
│ Engine sensitivity:                                     │
│   Raid Radar    [Low ◉ Medium ○ High]                  │
│   Memory        [Low ○ Medium ◉ High]                  │
│   Health Score  [Low ○ Medium ◉ High]                  │
│                                                         │
│ Alert delivery:                                         │
│   ☑ Pinned dashboard (always on)                       │
│   ☑ Modmail for critical alerts                        │
│                                                         │
│ ▶ Advanced settings (click to expand)                  │
│                                                         │
│ [Save]                                                  │
└─────────────────────────────────────────────────────────┘
```

Expanded advanced section:

```
▼ Advanced settings

  Baseline window:  [14 days ▼]
  Quiet hours:      [☐] Don't send modmail between [02]:00 - [06]:00 UTC

  Auto-actions per engine (opt-in, reversible only):
    Raid Radar:
      ☐ Auto-enable slow mode at confidence > 0.85
      ☐ Auto-filter new accounts at confidence > 0.85
    Memory:
      (no auto-actions available — Memory always suggests, never acts)
    Health Score:
      ☐ Auto-enable slow mode at risk > 90
      ☐ Auto-filter new accounts at risk > 90

  Exempt users:    [add usernames]
  Exempt flairs:   [select flairs]
  Watch only:      ☐ Only watch threads tagged with these flairs

  Per-signal weights (Raid Radar):
    New-user influx     [30%]
    Account-age cluster [25%]
    Sub overlap         [25%]
    Sync timing         [20%]

  Per-signal weights (Health Score):
    Velocity            [30%]
    Sentiment           [25%]
    New accounts        [20%]
    Reports             [25%]

  Calibration health:
    Total alerts (7d):        47
    False positive rate:      3.2%
    Mod actions taken:        31
```

Power users can fine-tune. Most mods will never expand this section.

---

## Mod menu items

Devvit lets you add menu items to existing Reddit UI surfaces. Sentinel adds:

### On a post (right-click / "..." menu)

- **🛡️ Show Health Score** — opens the Health Score detail for this thread
- **🛡️ Add to watch list** — manually mark a thread as worth watching even if Sentinel didn't auto-pick it
- **🛡️ Mark thread as exempt** — add to ignore list

### On a user

- **🛡️ Open in Sentinel** — opens User Spotlight panel
- **🛡️ Run evader check** — manually compare against banned index

### On a comment

- **🛡️ Check author in Sentinel** — opens User Spotlight for the comment's author

These give mods quick paths into Sentinel from their normal mod workflow without going through the dashboard first.

---

## Visual style

Reference the mockups (`tier_s_mockups.html`, `sentinel_demos.html`). Key principles:

- **Dark mode default** — looks like a security platform, not a 2014 admin panel
- **Severity colors are consistent across engines**:
  - 🟢 Green / `#46a973` = healthy / approved / OK
  - 🟡 Yellow-amber / `#f5b041` = elevated / monitoring
  - 🟠 Orange / `#f39c12` = warning / medium severity
  - 🔴 Red / `#e74c3c` = critical / high severity
- **Reddit orange (`#ff4500`) for accents only** — not for severity
- **Generous whitespace** — looks polished, scales to small viewports
- **Numbers are tabular-numeric** — column-aligned for readability
- **Animation is restrained** — pulse on critical alerts, gentle transitions, no distracting motion

---

## Accessibility

- Keyboard navigable
- Screen reader labels on icons and buttons
- Color is never the only signal — every color-coded element also has a text label or icon
- Sufficient contrast (WCAG AA)

---

## Mobile considerations

Devvit custom posts render on mobile too. Layout collapses to single-column. Test on narrow viewports.

---

## What NOT to build in v1

- ❌ Real-time live updates via websockets (use polling, every 30s on dashboard open is fine)
- ❌ Custom themes / dark-mode toggle (we're already dark; users can use Reddit's native theme)
- ❌ Multi-language support (English only for hackathon — required by rules anyway)
- ❌ Settings sync across multiple subs (each install is independent — Devvit constraint)
- ❌ Configurable layout (no drag-and-drop tiles, no rearrangement)
- ❌ Analytics dashboards beyond the calibration health box
