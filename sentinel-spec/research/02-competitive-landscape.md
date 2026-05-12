# Competitive Landscape

## Summary

Sentinel is competitively differentiated in its unified platform thesis and predictive focus. No existing Devvit app combines brigade detection, ban-evader identification, and thread-escalation forecasting on a shared behavioral graph. Existing tools are either narrow-scope (single-engine) or rely on Reddit's native detection without mod visibility. The strongest competitive threat is not a single app but the combination of Reddit's native Ban Evasion Filter + Harassment Filter + Mod Insights, which collectively cover parts of all three engines—but lack real-time brigade detection and ban-evasion stylometry matching. The hardest differentiation claim to defend: that statistical anomaly detection beats the sophistication of Reddit's LLM-powered Harassment Filter and platform-scale ban-evasion fingerprinting.

## Existing Devvit Apps

| App | What it does | Engine overlap | Differentiation gap | Source |
|---|---|---|---|---|
| **Evasion Guard** | Bans/removes posts from users detected as ban evaders by Reddit's native system. | Memory (detection only) | Sentinel adds stylometry + behavioral matching; Evasion Guard is passive relay of Reddit's signals. | [GitHub](https://github.com/fsvreddit/evasion-guard) |
| **Hive Protect** | Monitors user participation in external subs (free karma, NSFW, OnlyFans) and triggers ban/remove/report. | Memory (behavioral proxy) | Sentinel matches stylometry + posting patterns; Hive only looks at sub participation (100 post limit, no writing style). | [GitHub](https://github.com/fsvreddit/hive-protect) |
| **Spam Source Spotter** | Alerts mods to posts from unfamiliar/rare domains (anomaly in post sources). | Health Score (weak) | Domain rarity ≠ thread health or escalation forecast. No temporal signals. | [GitHub](https://github.com/fsvreddit/spam-src-spotter) |
| **Trending Tattler** | Alerts when a post hits /r/all or /r/popular (trending feed notification). | Health Score (weak) | Alerts on fact of trending, not predictive; no escalation forecast or risk scoring. | [GitHub](https://github.com/fsvreddit/trending-tattler) |
| **Modlogstats** | Tracks mod activity, generates stats wiki pages + optional daily modmail summary. | None | Reporting tool, no threat detection. | [GitHub](https://github.com/DNSCond/modlogstats) |
| **Automodmail** | YAML rule engine for modmail auto-responses and ban appeal automation. | None | Workflow automation, no threat detection. | [GitHub](https://github.com/fsvreddit/automodmail) |
| **Modmail-Userinfo** | Appends user history summary to modmail (visible to mods only). | None (context aid) | User info lookup, not predictive threat detection. | [GitHub](https://github.com/fsvreddit/modmail-userinfo) |
| **Modmail-To-Discord/Slack** | Forwards modmail to Discord/Slack webhook for external alerting. | None | Notification pipeline, no threat detection. | [GitHub](https://github.com/ni5arga/Modmail-To-Discord-Slack) |
| **Sub-Stats-Bot** | Stores and surfaces subreddit statistics (growth, activity trends) to mods. | None | Reporting, not real-time or predictive. | [GitHub](https://github.com/fsvreddit/sub-stats-bot) |

## Reddit-Internal Features

| Feature | What it covers | Engine overlap | Sentinel's marginal value | Source |
|---|---|---|---|---|
| **Ban Evasion Filter** (native) | Optional auto-filter of posts/comments from suspected ban evaders (time-frame configurable). | Memory (detection only) | Reddit's signal-based detection is opaque; Sentinel adds explainable stylometry + behavioral scoring, mod visibility into why, and 24h revert window. | [Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484544471444-Ban-evasion-filter) |
| **Harassment Filter** (LLM-powered) | Auto-collapses/filters likely-harassment comments (Moderate/High sensitivity). 72% adoption in largest subs. | Health Score (weak) | Filter is post-hoc content moderation, not predictive thread escalation. No velocity or sentiment trajectory forecasting. | [Reddit Help](https://support.reddithelp.com/hc/en-us/articles/23856209638932-Harassment-filter) |
| **Crowd Control** (native) | Auto-collapse/filter posts+comments from untrusted/low-karma users. | Health Score (weak) | Filters noise, not threat detection. No risk scoring or escalation forecast. | [Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484545006996-Crowd-Control) |
| **Mod Insights** (official) | Dashboard: growth metrics (pageviews, subscribers), team health (mod activity), reports/removals trend. | Health Score (metrics only) | Sentinel adds real-time risk scoring, brigade detection (not just removal counts), and 1–2h escalation forecast. Mod Insights is historical/aggregate, not predictive. | [Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484468824980-Mod-Insights) |
| **Moderation Queue** (native) | Central inbox: flagged posts+comments, reports, sortable by recency or report count. | None | Triage tool, no threat intelligence. | [Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484440494356-Moderation-Queue) |
| **Safety Filters** (native) | Admin-powered filters (harassment, spam, abuse) for platform safety. | Health Score (opaque) | Platform-wide, not sub-aware. Mods have no control or visibility into signal triggers. | [Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484574845460-Safety-Filters) |
| **AutoModerator** (native) | Rules engine: match keywords, user status, link patterns, flair, age. | Health Score (rules-based, not intelligent) | AutoMod is manual rule entry by mods; Sentinel auto-learns baselines and detects anomalies without config. | [Reddit Mods](https://mods.reddithelp.com/hc/en-us/articles/360008425592-Moderation-Tools-overview) |

## Hackathon Overlap (if any)

No clearly overlapping entries found at scan time (May 2026, hackathon deadline May 27). The Devpost hackathon page for Mod Tools and Migrated Apps is live but submission details are not publicly visible to non-participants. Sentinel itself is presumed to be entered in this hackathon.

[Hackathon page](https://mod-tools-migration.devpost.com/)

## Differentiation Thesis

**Where Sentinel uniquely wins:**
- **Unified behavioral graph**: Three engines share a single real-time user+thread fingerprint, not siloed tools. A user flagged by Memory can inform Raid Radar; a thread's Health Score trajectory informs triage priority.
- **Brigade detection speed**: Raid Radar detects coordinated influx within 90s using z-score anomaly on account age + timing sync. No existing Devvit app does this. Reddit's native filters are platform-wide, not brigade-specific, and not transparent to mods.
- **Explainable, reversible actions**: Sentinel never auto-bans (only soft actions: slow mode, filter). Every decision is auditable and revertible within 24h. Most existing tools (Hive, Evasion Guard) auto-remove/ban with limited transparency.
- **Ban-evader stylometry + behavior**: Memory's dual-signal requirement (behavioral + stylometry) is not available in any Devvit app. Evasion Guard relays Reddit's opaque detection; Hive only checks subreddit participation.
- **2h escalation forecast**: Health Score predicts risk trajectory 1–2h ahead, with projected impact of interventions. Mod Insights shows historical trends, not prediction.

**Where Sentinel doesn't differentiate:**
- **On platform-scale ban detection**: Reddit's native Ban Evasion Filter and Harassment Filter are trained on Reddit-wide data, platform-integrated, and 72% adopted in largest subs. Sentinel's ban-evader matching operates on single-sub history and requires 10-comment sample (cold-start harder).
- **On aggregate reporting**: Mod Insights provides growth/team health dashboards that Sentinel does not. Sentinel focuses on threat alerts, not analytics.
- **On content-level harassment detection**: Harassment Filter uses LLM and covers statement-level toxicity. Sentinel uses simpler sentiment lexicon and focuses on thread-velocity escalation, not individual comments.

**Hardest claim to defend to a judge:**
That statistical anomaly detection (brigade detection via z-score + clustering) beats the sophistication of Reddit's LLM-powered Harassment Filter and platform-integrated ban-evasion fingerprinting. Judges will ask: "Why should a mod adopt a new, unproven app when Reddit's native tools are already protecting them?" Sentinel's answer must hinge on speed (90s brigade detection), explainability (mod can see *why* Raid Radar fired), reversibility (soft actions only, never destructive), and the unified platform claim (three engines, one interface, one behavioral model).

## Sources

1. [Evasion Guard (GitHub)](https://github.com/fsvreddit/evasion-guard)
2. [Hive Protect (GitHub)](https://github.com/fsvreddit/hive-protect)
3. [Spam Source Spotter (GitHub)](https://github.com/fsvreddit/spam-src-spotter)
4. [Trending Tattler (GitHub)](https://github.com/fsvreddit/trending-tattler)
5. [Modlogstats (GitHub)](https://github.com/DNSCond/modlogstats)
6. [Automodmail (GitHub)](https://github.com/fsvreddit/automodmail)
7. [Modmail-Userinfo (GitHub)](https://github.com/fsvreddit/modmail-userinfo)
8. [Modmail-To-Discord/Slack (GitHub)](https://github.com/ni5arga/Modmail-To-Discord-Slack)
9. [Sub-Stats-Bot (GitHub)](https://github.com/fsvreddit/sub-stats-bot)
10. [Ban Evasion Filter – Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484544471444-Ban-evasion-filter)
11. [Harassment Filter – Reddit Help](https://support.reddithelp.com/hc/en-us/articles/23856209638932-Harassment-filter)
12. [Crowd Control – Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484545006996-Crowd-Control)
13. [Mod Insights – Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484468824980-Mod-Insights)
14. [Moderation Queue – Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484440494356-Moderation-Queue)
15. [Safety Filters – Reddit Help](https://support.reddithelp.com/hc/en-us/articles/15484574845460-Safety-Filters)
16. [Moderation Tools Overview – Reddit Mods](https://mods.reddithelp.com/hc/en-us/articles/360008425592-Moderation-Tools-overview)
17. [Mod Tools and Migrated Apps Hackathon – Devpost](https://mod-tools-migration.devpost.com/)
