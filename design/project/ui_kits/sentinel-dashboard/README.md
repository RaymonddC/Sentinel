# Sentinel — pinned Devvit custom post (UI kit)

This is the **one and only Sentinel surface**: a pinned custom post that lives at the top of a moderated subreddit.

## What's in the kit

| File | What it is |
|---|---|
| `index.html` | Interactive click-through. Tabs work; alert cards expand; cluster graph hovers. |
| `App.jsx` | Top-level state — current tab, expanded alert, sample data |
| `PostFrame.jsx` | Reddit-style chrome around the custom post (subreddit row, pinned indicator) |
| `TabBar.jsx` | 4 tabs: Raid Radar, Memory, Health Score, Audit |
| `SeverityBadge.jsx` | Capsule — CRITICAL / HIGH / MEDIUM / HEALTHY |
| `AlertCard.jsx` | The most-used component — severity left rule, headline, meta, action |
| `KpiTile.jsx` | Number + label + delta — used on Health Score |
| `RiskGauge.jsx` | SVG arc — center number, severity-colored fill |
| `ClusterGraph.jsx` | SVG node/link diagram for Raid Radar |
| `ComparisonPanel.jsx` | Memory: now vs then side-by-side |
| `AuditLogRow.jsx` | Single audit-log entry — timestamp, mod, action, note |
| `Chip.jsx` | Filter / toggle chip |
| `Button.jsx` | Primary, secondary, ghost |
| `Icon.jsx` | Lucide wrapper |
| `panels.jsx` | The 4 tab panels — RaidRadarPanel, MemoryPanel, HealthScorePanel, AuditPanel |
| `data.js` | Sample alerts, clusters, KPIs, audit entries |

## How to read it

- The post itself is **640px wide** to mirror the Reddit feed at desktop. Inside the post, the design is mobile-first (a single column, ≥44px hit targets) — desktop just shows the same layout in a wider container.
- Each panel renders inside `<PostFrame>` so you see the Reddit context that always surrounds Sentinel.
- All data is fake. The audit log entries are illustrative.

## Devvit constraints honored

- No `position: fixed` (the tab bar sticks via `position: sticky` inside the post).
- No `backdrop-filter`.
- No modals — the alert detail is a drawer inside the post.
- Tap targets ≥ 44px.
