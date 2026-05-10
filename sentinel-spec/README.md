# Sentinel — Moderation Intelligence Platform for Reddit

> A unified threat-intelligence layer for subreddit moderators. Three engines (Raid Radar, Memory, Health Score) sharing one behavioral graph and one dashboard. Built on Devvit (Reddit's developer platform) for the Reddit Mod Tools and Migrated Apps Hackathon.

---

## What Sentinel does

Reddit moderators are unpaid volunteers protecting millions of users. The current tools (AutoModerator, Mod Notes, Toolbox) are reactive — they help mods clean up after problems happen. Sentinel is **predictive** — it surfaces problems before they happen, with the reasoning shown alongside.

Three engines, one platform:

1. **Raid Radar** — detects coordinated brigades within ~90 seconds (vs ~2 hours manual)
2. **Memory** — profiles every user behaviorally + stylometrically, catches ban evaders
3. **Health Score** — predicts which threads will need intervention 1–2 hours ahead

All three share the same behavioral baseline infrastructure, the same audit log, the same dashboard. That shared infrastructure is what makes "Sentinel" a coherent platform rather than three random tools.

---

## How to read this spec

This spec is split across multiple files. Read them in order:

| File | What's in it |
|---|---|
| `README.md` (this file) | Overview, architecture, how the engines fit together |
| `01-product-decisions.md` | Every decision made during design + reasoning. Read this to understand WHY before you code |
| `02-architecture.md` | Data model, shared infrastructure, Devvit APIs used |
| `03-engine-raid-radar.md` | Raid Radar engine spec |
| `04-engine-memory.md` | Memory engine spec |
| `05-engine-health-score.md` | Health Score engine spec |
| `06-dashboard-and-ui.md` | What mods see, dashboard structure, settings page |
| `07-onboarding-and-install.md` | First-install flow, baseline bootstrapping |
| `08-build-plan.md` | Suggested build order, milestones, what to demo when |
| `09-demo-video-script.md` | 60-second demo script for the hackathon submission |
| `10-app-listing.md` | App Directory listing copy and screenshots |

---

## Critical context for whoever is building this

### Why these architectural choices

The "production-ready" design philosophy drives everything. Specifically:

- **Statistics over ML** — All three engines use baseline + trajectory anomaly detection, not machine learning. ML was considered and rejected: no training data exists, infrastructure cost is significant, debugging is a nightmare. Statistical detection with the right signals matches or beats small ML models on these specific problems and is fully explainable. (See `01-product-decisions.md` Q4.)
- **Suggest, never act** (with one exception) — Sentinel never bans users, never removes content. It can ONLY take reversible "soft" actions (slow mode, filter new accounts), and ONLY if mods have explicitly opted in for that engine. Default = manual everything. (See Q9.)
- **Devvit native storage** — No external databases. Sliding window per user. Stays within platform limits and the "well-behaved citizen" pattern Reddit's developer relations team rewards. (See Q10.)
- **Audit log + first-mod-wins + one-click revert** — No maker-checker, no quorum, no waiting. Every Sentinel-triggered action is logged and reversible for 24 hours. (See Q11.)

### What NOT to build (intentional non-features)

- ❌ ML models (deliberately statistical instead)
- ❌ External databases (use Devvit KV only)
- ❌ Auto-banning, auto-removing content (only auto-throttle, opt-in)
- ❌ Pre-trained "sub archetype" templates (was Q12 option 3, rejected)
- ❌ Discord/Slack webhook integrations (was Q8 option 3, rejected)
- ❌ Maker-checker workflows (over-engineered for moderation context)
- ❌ Public-facing transparency reports (cool but out of Sentinel's scope; that's a different product)

### Hackathon context

- **Submission deadline:** May 27, 2026, 6pm PDT
- **Categories:** New Mod Tool ($10K) + Moderator's Choice ($10K)
- **Judging criteria** (equal weight):
  1. Community Impact — does it save mod time / improve community?
  2. Polish — close to publishable, compliant with Devvit Rules
  3. Reliable UX — easy to install, works at scale
  4. Ecosystem Impact — net-new functionality
- **Required submission artifacts:**
  - Working app on `developers.reddit.com/apps/{slug}`
  - Demo post in a public sub with <200 members
  - 60-second demo video (YouTube/Vimeo)
  - Tool overview + project impact in submission text
- **The "polish" criterion** is doing a lot of quiet work. Apps that feel finished beat apps that have more features but feel half-built. Optimize for finished.

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DEVVIT EVENT TRIGGERS                  │
│  PostSubmit · CommentSubmit · ModAction · UserReport · ...  │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│            SHARED EVENT INGESTION + BEHAVIORAL GRAPH        │
│   • Update sub baseline (rolling stats)                     │
│   • Update user fingerprint (stylometry + behavior)         │
│   • Update thread state (velocity, sentiment, etc.)         │
└──────────┬──────────────┬──────────────┬───────────────────┘
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────────┐
    │   RAID   │   │  MEMORY  │   │   HEALTH     │
    │  RADAR   │   │  ENGINE  │   │   SCORE      │
    │          │   │          │   │              │
    │ brigade  │   │ ban-     │   │ thread       │
    │ detect.  │   │ evader   │   │ escalation   │
    │          │   │ detect.  │   │ predict.     │
    └────┬─────┘   └────┬─────┘   └──────┬───────┘
         │              │                 │
         └──────────────┼─────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   UNIFIED ALERT DISPATCHER   │
         │  • Dashboard pinned post     │
         │  • Modmail (critical only)   │
         │  • Audit log                 │
         └──────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │      MOD DASHBOARD UI        │
         │  • Threat feed               │
         │  • User spotlight            │
         │  • Watched threads           │
         │  • Activity log              │
         │  • Settings (tiered)         │
         └──────────────────────────────┘
```

### Why this layering matters

The shared **event ingestion + behavioral graph** is the architectural keystone. Every Reddit event flows through it once, updates the baseline + user fingerprint + thread state once, and feeds all three engines. Without this layer, the engines duplicate work and Sentinel feels like three apps glued together.

With this layer, Sentinel feels like one platform — and the build effort actually drops because the engines reuse infrastructure.

---

## Tech stack (Devvit)

- **Language:** TypeScript
- **Platform:** Devvit (`@devvit/public-api`)
- **Storage:** Devvit Redis (built-in key-value)
- **UI:** Devvit Blocks (custom posts) + Forms (settings)
- **Triggers:** Devvit event triggers (PostSubmit, CommentSubmit, ModAction, etc.)
- **Scheduling:** Devvit scheduler (for periodic baseline rollup)
- **No external services, no API keys, no databases.**

---

## Build order (high-level — see `08-build-plan.md` for details)

1. **Foundation** (1–3 days): event ingestion, behavioral graph, KV schema, baseline computation
2. **Raid Radar** (3–5 days): brigade detection, dashboard panel, alert dispatch
3. **Health Score** (3–5 days): thread monitoring, risk gauge, prediction
4. **Memory** (4–6 days): user fingerprinting, stylometry, evader detection
5. **Dashboard polish + onboarding** (2–3 days): unified UI, install flow, tiered settings
6. **Demo prep** (1–2 days): test sub setup, demo data, video recording, app listing

Total: roughly 14–24 working days. Spec is intentionally engineered for incremental delivery — Raid Radar alone is shippable; each engine added strengthens the platform without breaking anything.

---

## Success criteria

A successful Sentinel build hits these checkpoints:

- [ ] Installs cleanly on a fresh subreddit in <60 seconds
- [ ] Dashboard shows live state within 2 minutes of install
- [ ] Detects a simulated brigade in your test sub in <2 minutes
- [ ] Memory flags a known ban-evader alt with >85% confidence
- [ ] Health Score predicts thread escalation at least 30 minutes ahead
- [ ] Every Sentinel-triggered action has an audit-log entry and an Undo button
- [ ] Mods can adjust sensitivity per engine without touching code
- [ ] False positive rate < 10% on natural sub activity over 7 days
- [ ] Demo video tells the story in 60 seconds without narration crutches
- [ ] App listing screenshots make the value obvious in 3 seconds

---

## How to use this spec with Claude Code

1. Read this README first.
2. Read `01-product-decisions.md` next — understand the "why" before you code.
3. Read `02-architecture.md` — understand the shared infrastructure.
4. Pick an engine spec (`03-`, `04-`, or `05-`) based on build order.
5. Reference `06-dashboard-and-ui.md` and `07-onboarding-and-install.md` as you build the user-facing pieces.
6. Use `08-build-plan.md` to stay on track milestone-by-milestone.

When in doubt, refer to `01-product-decisions.md` — every architectural choice has a documented reason. Don't override these decisions without understanding what they're protecting against.
