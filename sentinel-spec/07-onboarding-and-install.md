# 07 · Onboarding and Install

## Changelog

### 2026-05-12 — Phase 2 spec revisions applied (per `00-plan-review.md` v4)
- R-Bootstrap: 14-day fetch replaced with 3-pattern hybrid (P1 top-1000 hot at install + P2 reactive from t=0 + P3 progressive scheduled backfill during 7-day ramp); welcome modal copy and Step 4 modmail copy updated accordingly; per `00-plan-review.md` § R-Bootstrap and Broken Assumption A
- PRI-1 Q12 mechanism revised; principle "live from minute one" preserved
- R-Memory-Cold-Start / PRI-4: Memory cold-start framing added to welcome modal ("Memory activates the first time you ban a user; accuracy improves as your ban history grows."); per `00-plan-review.md` § R-Memory-Cold-Start and PRI-4

---

> What happens in the first 5 minutes after a mod hits "Install Sentinel." This window determines whether the tool gets used or uninstalled.

---

## Install flow (step by step)

### Step 1 — Mod hits Install on the App Directory

Standard Devvit install flow. Sentinel's `AppInstall` trigger fires.

### Step 2 — Welcome modal

A Devvit-rendered welcome screen appears in the sub. Single screen, three sections:

```
┌──────────────────────────────────────────────────────────┐
│ 👋 Welcome to Sentinel                                    │
├──────────────────────────────────────────────────────────┤
│ Scanning your sub's recent activity to seed your         │
│ baseline. Detection is active immediately; accuracy      │
│ improves over the next 7 days.                           │
│ Memory activates the first time you ban a user;          │
│ accuracy improves as your ban history grows.             │
│                                                          │
│ ─────────────────────────────────────────────            │
│                                                          │
│ Choose your starting settings:                           │
│                                                          │
│ Sensitivity (apply to all engines):                      │
│   ○ Low       — Fewer alerts, higher precision          │
│   ◉ Medium    — Balanced (recommended)                   │
│   ○ High      — More alerts, higher recall              │
│                                                          │
│ Auto-actions (recommended OFF until you trust it):       │
│   ☐ Allow Sentinel to enable slow mode on critical      │
│     brigades                                             │
│   ☐ Allow Sentinel to filter new accounts on critical   │
│     brigades                                             │
│                                                          │
│ Alert delivery:                                          │
│   ☑ Pinned dashboard post (always on)                   │
│   ☑ Modmail for critical alerts                         │
│                                                          │
│ ─────────────────────────────────────────────            │
│                                                          │
│ [Get started]                                           │
└──────────────────────────────────────────────────────────┘
```

Default = Medium sensitivity, auto-actions off, both alert channels on.

### Step 3 — Background bootstrap

After mod clicks "Get started":

1. Schedule `bootstrapBaseline(subId)` (P1 hot-list seed + P3 backfill kickoff)
2. Show a "Setup in progress" message immediately

Bootstrap uses a three-pattern hybrid to stay within Reddit's ~60 req/min OAuth rate limit:

- **P1 — Hot-list seed (at install):** Fetches the sub's top-1000 hot posts and indexes them into initial `SubBaseline` + `UserFingerprint` records. Keeps install-time API calls under ~50.
- **P2 — Reactive from t=0:** All engines evaluate every incoming event immediately, with no dependency on P1 completing.
- **P3 — Progressive backfill (7-day ramp):** A scheduled hourly job fills the historical gap in rate-limit-safe batches (≤50 API calls per child job, within the 60 runJob/min ceiling).

The bootstrap job steps:
1. Fetch top-1000 hot posts; build initial `SubBaseline` + `UserFingerprint` records (P1)
2. Schedule the hourly progressive-backfill job for the 7-day ramp (P3)
3. Mark `baseline.bootstrapComplete = true`
4. Post the dashboard custom post and pin it
5. Notify mods via modmail: "Sentinel is active"

Estimated time for P1: under 2 minutes. P3 backfill continues in the background throughout the 7-day calibration ramp.

**Critical:** Bootstrap is non-blocking. Sentinel's engines run reactively on every new event from t=0 (P2) — they operate with progressively more baseline data as P1 and P3 complete.

### Step 4 — "Sentinel is ready" message

When bootstrap finishes, send modmail:

```
Subject: 🛡️ Sentinel is now active on r/yoursub

Hi mods,

Sentinel is now active. Detection runs immediately; accuracy improves over the next 7 days as your baseline warms up.

Your dashboard is now pinned at the top of the sub:
  https://reddit.com/r/yoursub/comments/abc123/sentinel_dashboard

Sentinel will detect:
  🚨 Coordinated brigades and raid attacks
  🔍 Possible ban evaders (returning banned users)
  📊 Threads escalating toward needing intervention

Detection accuracy improves over the next 7 days as Sentinel
learns your sub's specific patterns. You'll see a "still
learning" banner during this period — that's normal.

Need help? See the Settings tab on your dashboard.

— Sentinel
```

### Step 5 — Calibration ramp (first 7 days)

A banner appears at the top of the dashboard for 7 days:

```
ℹ️ Sentinel is calibrating to your sub. Detection is active,
   accuracy improves over the next 6 days.
   Current accuracy estimate: 72% (improving)
```

After 7 days, banner auto-removes. Replace with the calibration health stats in advanced settings.

---

## What happens during the 7-day calibration

The engines run normally but with these adjustments:
- Confidence scores are slightly conservative (multiply by 0.85)
- Critical-severity alerts require higher confidence (0.92 instead of 0.85)
- Auto-actions are NOT taken even if mods opted in — they activate only after day 7
- "Calibrating" badge shows on every alert during this period

This is intentional honesty — Sentinel is less trusted of itself early on, and the UI shows that.

---

## Permissions Sentinel needs

Devvit will prompt the mod to approve permissions on install:

- **Read posts and comments** — required for all engines
- **Read mod actions** — required for Memory (banned-user index), audit log
- **Read user reports** — required for Health Score and Raid Radar
- **Write posts** — required to create/update the dashboard pinned post
- **Send modmail** — required for critical alerts
- **Manage thread settings** — required for slow mode and filter actions (only used if mod opts in)

If the mod denies "Manage thread settings," Sentinel still works fine — auto-actions are unavailable, but detection and dashboard work normally.

---

## What happens on AppUpgrade

When Sentinel is updated to a new version:
1. `AppUpgrade` trigger fires
2. Run any settings migration (e.g. new fields)
3. Don't re-bootstrap — keep all existing data
4. Post a small "Sentinel updated to vX.Y" message in the activity log

---

## Uninstall

If the mod uninstalls Sentinel:
- Devvit handles the cleanup automatically (keys are deleted)
- The pinned dashboard post stays (mod can manually delete)
- All alerts and audit log are gone

This is fine. Devvit-native = clean uninstall.

---

## Edge cases

### Brand-new sub with no history

- Bootstrap finds 0 posts/comments → marks `bootstrapComplete = true` immediately
- Engines start with very wide thresholds (everything is "anomalous" relative to no baseline)
- Cold-start defaults kick in for the first 7 days
- After mods generate enough activity, baseline becomes meaningful

### Very active sub (1000+ comments/hour)

- Bootstrap may take longer than 10 min
- Show progress in the welcome message: "Setup in progress: scanned 200/1000 posts"
- Don't block the UI — engines work on incoming events while bootstrap continues

### Mod uninstalls then reinstalls

- Treated as a fresh install (Devvit storage was wiped)
- Bootstrap runs again
- Banned users from before are gone (this is acceptable; rare case)

### Sub goes private during operation

- Sentinel still runs (Devvit has its own permissions)
- Just won't fetch new public data — works on internal events

---

## What we're NOT doing in v1

- ❌ Migration from other tools (Toolbox, AutoMod) — out of scope
- ❌ Multi-sub install wizard (each sub configures independently)
- ❌ Backup / restore of Sentinel state
- ❌ Cloud sync of settings across mod team's other subs
- ❌ Onboarding tutorial / interactive walkthrough (the welcome modal is enough)

The install flow is intentionally minimal. Two clicks from "Install" to "working." Anything more = friction = uninstalls.
