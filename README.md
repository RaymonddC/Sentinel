# 🛡️ Sentinel

> Reddit moderation intelligence — predictive threat detection on Devvit.

---

## What it does

Reddit moderators are unpaid volunteers protecting millions of users. Current tools are reactive: they help mods clean up after problems happen. Sentinel is predictive — it surfaces problems before they escalate, with the reasoning shown alongside every alert.

Three engines share one behavioral graph and one dashboard:

- **Raid Radar** — detects coordinated brigades within ~90 seconds (vs ~2 hours manual), using account-age clustering, sub-overlap concentration, and synchronized timing signals.
- **Memory** — profiles every user behaviorally and stylometrically, flags probable ban evaders by comparing posting patterns and writing style against a per-sub banned-user index.
- **Health Score** — predicts which threads will need intervention 1–2 hours ahead, using comment velocity, sentiment swing, new-account ratio, and report rate.

All three feed a unified alert queue. Every alert has an audit-log entry and a one-click revert. No auto-bans, no auto-removals — Sentinel surfaces; mods decide.

---

## Status

Foundation and all three engines are built (M0–M6). M7 polish and Phase 0 empirical probes are in progress; M8 demo prep is upcoming. The codebase is under active development toward the 2026-06-27 hackathon deadline — see the [build schedule](sentinel-spec/11-ultraplan.md) for milestone detail.

---

## How it looks

_Screenshots coming in M8 demo prep._

The dashboard runs as a single pinned Devvit custom post. Design system and component previews are in [`design/`](design/project/README.md) — dark-mode first, high-density, no gradients or decorative imagery.

---

## Architecture at a glance

Every Reddit event flows through a shared ingestion layer that updates the sub baseline, user fingerprint, and thread state once. The three detection engines read from that shared graph and emit alerts to a unified dispatcher. Alerts surface in a custom-post dashboard with a tabbed threat feed, user spotlight, watched threads, activity log, and tiered settings.

For a full breakdown, see [`sentinel-spec/00-architectural-summary.md`](sentinel-spec/00-architectural-summary.md).

---

## Constraints / non-negotiables

- **Devvit Redis only** — no external databases, no API keys, no infrastructure overhead.
- **Statistics, not ML** — anomaly detection via z-scores and Welford accumulation; fully explainable, no training data required.
- **Suggest, don't act** — Sentinel never bans users or removes content; the only auto-actions are reversible thread-level soft actions (slow mode, new-account filter), and only when mods explicitly opt in.
- **Reversible** — every Sentinel-triggered action has a 24-hour revert window and can be undone in one click.
- **Audit log on every action** — append-only, capped 1000 entries, 30-day retention; every entry is attributable and includes the triggering signal.
- **Production-ready over impressive-looking** — finish over features; false-positive rate target < 10% over 7 days of natural sub activity.

---

## Quick start

```bash
# Clone and install
git clone https://github.com/RaymonddC/Sentinel.git
cd Sentinel
npm install

# Authenticate with Reddit (opens browser OAuth)
devvit login

# Create a private test subreddit at reddit.com/subreddits/create
# then install Sentinel on it:
devvit playtest r/<your-test-sub>

# Open the dashboard in your browser:
# https://www.reddit.com/r/<your-test-sub>/?playtest=sentinel-h
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full setup guide, branching conventions, and daily dev loop.

---

## Project structure

```
sentinel-spec/    spec of record — read before coding
  01-product-decisions.md   the compass file; every architectural choice documented
  00-architectural-summary.md
  11-ultraplan.md           build schedule
design/           design system, tokens, component previews, UI mockups
  project/README.md         design system overview + tone guide
src/              TypeScript source
  ingest/         event ingestion + debounce
  engines/        Raid Radar, Memory, Health Score
  alerts/         dispatcher, audit log, mod actions
  storage/        Redis primitives (RollingStat, TimeSeries, Histogram)
  ui/             dashboard blocks, SVG components, tokens
.github/          CI workflows (typecheck + test on every push and PR)
```

---

## Docs map

| Document | Purpose |
|---|---|
| [`sentinel-spec/01-product-decisions.md`](sentinel-spec/01-product-decisions.md) | The compass — every architectural choice and its reasoning |
| [`sentinel-spec/00-architectural-summary.md`](sentinel-spec/00-architectural-summary.md) | What Sentinel is, three-engine overview, storage schema, thresholds |
| [`sentinel-spec/00-plan-review.md`](sentinel-spec/00-plan-review.md) | Applied spec revisions and open Plan Review Items |
| [`sentinel-spec/11-ultraplan.md`](sentinel-spec/11-ultraplan.md) | Build schedule — milestones, Phase 0 probes, scope governance |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to contribute — setup, daily dev loop, branching, gotchas |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | How to deploy — post-merge upload checklist, publishing to app directory |
| [`design/project/README.md`](design/project/README.md) | Design system — palette, type, tone, component rules |

---

## Reddit scopes

Sentinel requests the following Devvit permissions:

`read_posts` · `read_comments` · `read_modlog` · `read_reports` · `manage_posts` · `manage_settings` · `manage_modmail` · `manage_mod_notes` · `manage_subreddit`

No external network calls. All data stays in Devvit Redis, scoped to the installing subreddit.

---

## License

Source code is MIT. Sentinel bundles the AFINN-2015 English sentiment lexicon (© Finn Årup Nielsen, Open Database License v1.0) and a curated 30-entry emoji extension table (MIT). See [`LICENSES.md`](LICENSES.md) for full attribution and license text.

---

## Hackathon context

Sentinel is being built for the Reddit Mod Tools and Migrated Apps Hackathon (deadline 2026-06-27). The hackathon is the proximate milestone — the long-term goal is a production-ready Devvit app for real mod teams on communities of 10K–500K members.
