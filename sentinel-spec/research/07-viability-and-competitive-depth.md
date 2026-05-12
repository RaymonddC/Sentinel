# Hackathon Viability + Competitive Depth (Wave C)

## Summary

The 16-calendar-day solo-dev build of three-engine Sentinel is **unlikely to produce a shippable 3-engine product**. No comparable solo-dev, multi-engine, real-time threat detection Devvit app exists in hackathon history. Every past Devvit hackathon winner identified was a single-mechanic app. The most complex solo-shipped mod tools (Bot Bouncer, Hive Protect) are single-purpose utilities built iteratively over months—not under hackathon deadline pressure. Sentinel's own spec estimates 14–24 working days for a solo developer; 16 calendar days yields roughly 11–12 working days under realistic assumptions. The path to a competitive submission is scoping down to one fully-built engine (Raid Radar recommended) plus a skeleton dashboard that communicates the unified vision. On the competitive side, the deeper analysis strengthens Sentinel's differentiation thesis: Reddit's Ban Evasion Filter explicitly documents that it does *not* analyze content or writing style—a precise gap Memory fills. Harassment Filter is comment-level and post-hoc; Raid Radar's coordinated-attack detection is architecturally distinct. The "72% adoption" stat for Harassment Filter in large subs has no verifiable public source and should be dropped from competitive claims. The hardest threat to defend against after deepening: Reddit's native Ban Evasion Filter combined with Memory's cold-start problem (needs ≥10 comment samples from the banned user's prior history, which may be deleted).

---

## Part A: Hackathon Viability Evidence

### Comparable Past Projects

| Project | Scope | Engines / Complexity | Demo Type | Team | Build Time | Outcome | Source |
|---|---|---|---|---|---|---|---|
| **Syllacrostic** | Daily crossword-style syllable-combo puzzle; daily leaderboard | 1 mechanic: puzzle generation + scoring | Live game | Unknown (solo suspected based on single vision) | Unknown; built for Reddit's first Devvit hackathon (~2023) | Reddit **acquired** it — highest validation possible | [devpost.com/software/syllacrostic](https://devpost.com/software/syllacrostic) |
| **575 (Haiku Game)** | Daily word bank; users compose haikus in 5-7-5 syllable format; community upvotes via comments | 1 mechanic: word bank + submission + voting UI | Live game | **Solo** (Thomas Park) | ~28 days available (Games & Puzzles hackathon, Nov 20–Dec 17 2024); actual build time not stated | Won **UGC Award** for best use of user-generated content; ~2,000 total entrants | [thomaspark.co/2025/01/575](https://thomaspark.co/2025/01/575-a-daily-haiku-game-for-reddit/) |
| **Laddergram** | Competitive word-ladder puzzle; fewest-steps win | 1 mechanic: word transformation + competitive leaderboard | Live puzzle | Unknown | 28 days available (same hackathon) | Highlighted as judges' favorite; award status unconfirmed | [devpost.com/software/laddergram](https://devpost.com/software/laddergram) |
| **WYR (Would You Rather)** | Daily "Would You Rather" vote; real-time results display; one-vote enforcement | 1 mechanic: voting + result display | Live game | **Solo** (RedBeret, 17 commits) | 28 days available (Hack Reddit, Feb–Mar 2025); actual build ~days per commit density | Did not win (archived Apr 2026, no ongoing maintenance) | [github.com/RedBeret/WYR_Reddit_Hackathon_Mar2025](https://github.com/RedBeret/WYR_Reddit_Hackathon_Mar2025) |
| **Hive Protect** | Flags/bans users active in specified external subs or posting OnlyFans/domain links | 4 signals, 1 engine (behavioral proxy); modmail + Discord/Slack alerts; caching | Live detection (event-triggered) | **Solo** (fsvreddit) | Built iteratively over months (47 commits); not a hackathon entry | Production-shipped, multi-sub adoption | [github.com/fsvreddit/hive-protect](https://github.com/fsvreddit/hive-protect) |
| **Bot Bouncer** | Bans/removes classified bot accounts using automated + community human review; retroactive banning within 1 week | Multi-signal: automated classification + human review pipeline; 1 engine | Live detection | **Solo** (fsvreddit) | Built iteratively (~126 commits, most complex of fsvreddit suite) | Production-shipped; most complex solo Devvit mod tool found | [github.com/fsvreddit/bot-bouncer](https://github.com/fsvreddit) |

**Note on current hackathon context**: The Reddit Mod Tools and Migrated Apps Hackathon (April 29–May 27, 2026) is the *first mod-tool-specific* Devvit hackathon. No prior winners exist to directly compare scope expectations. All prior Devvit hackathons focused on games and social experiences, not moderation intelligence. The competitive baseline for mod tools is effectively uncalibrated.

---

### Sentinel Calibration

**Where Sentinel sits on the complexity distribution.** Every solo-dev hackathon entry identified has a single mechanic or single engine. The most complex solo-shipped Devvit app (Bot Bouncer, ~126 commits, built over months) is still a single-purpose utility: detect bot, take action. Sentinel's spec describes three co-dependent engines, a shared behavioral graph with five storage keys, five statistical primitives, a bootstrap job, an alert dispatcher, an audit log, a calibration loop, and a multi-tab dashboard—plus the time to discover Devvit's platform-specific quirks (e.g., "interactions on Devvit are limited to clicks; advanced gestures like dragging aren't supported," per 575's developer). The spec's own estimate of 14–24 working days for a solo developer is credible and probably optimistic: that estimate assumes full familiarity with Devvit APIs, which prior research (01-devvit-capability-matrix) shows requires its own learning curve.

**What past winners cut to ship.** In every identified case, hackathon-winning Devvit apps shipped a single, polished, immediately-graspable mechanic. 575 cut advanced word selection and themed banks. Syllacrostic is a puzzle with a leaderboard—nothing more. WYR's entire codebase is voting + display. Even Bot Bouncer, the most sophisticated app, relies on an external community (/r/BotBouncer) to handle the hard classification problem—the Devvit app is the executor, not the classifier. The pattern is consistent: narrow scope, deep polish, dramatic demo moment.

**Honest assessment.** Full 3-engine Sentinel in 16 calendar days (roughly 11–12 realistic working days) is not achievable at production-ready quality. The Memory engine alone—behavioral fingerprinting, stylometry N-gram extraction, dual-signal matching, banned-user index, User Spotlight with side-by-side view—rivals the full complexity of Hive Protect and Bot Bouncer combined. Raid Radar requires real-time z-score computation over rolling windows (a Devvit Redis pattern with no shipped comparable), debounced engine re-evaluation, and a cluster visualization component. Health Score adds four more signal computations, a sentiment lexicon, and a 1–2h forecasting model. The realistic path is: **one engine fully built and demo-ready (Raid Radar, 3–5 days) + dashboard skeleton (1–2 days) + alert/audit log (1 day) + polish and demo prep (2–3 days) = 7–11 days**. That fits in 16 calendar days and produces a uniquely differentiated submission. Health Score and Memory are stubbed in the UI to communicate the unified platform vision without needing to implement them.

---

## Part B: Competitive Depth

### Ban Evasion Filter

**What it actually does (mechanism, not marketing).** Reddit's Ban Evasion Filter is an opt-in per-sub safety setting that flags accounts suspected of returning after a community ban. Detection relies on device/IP fingerprinting, browser fingerprint, device metadata, and connection signals (how users connect to Reddit and what information they share). Reddit's own help documentation explicitly states: **"the ban evasion filter doesn't filter based on post or comment context (i.e. this tool doesn't use behavioral or contextual patterns)."** This is not a limitation buried in fine print—it is the documented design boundary.

**Per-sub or platform-wide? Mod-controllable parameters.** Per-sub toggle (off by default). When enabled, mods configure: (1) **timeframe**—how recently the account was banned (the evasion lookback window); (2) **confidence level**—High (more content filtered, more false positives) or Moderate (more accurate, lower recall). False positives are managed by adding users to the approved list or manually approving their content three consecutive times.

**Documented adoption stats.** No public adoption stats. Reddit's help pages are silent on what percentage of communities have enabled the filter. The 72% stat in prior research (02) was applied to the *Harassment Filter*, not Ban Evasion Filter—see Adoption Reality section.

**Known limitations and gaps Sentinel fills.** The filter is inherently VPN-circumventable: a sufficiently motivated ban evader using a new device + VPN presents a clean fingerprint. Reddit acknowledges: "isn't 100% accurate, as the user signals we use are approximations." Moderators in r/ModSupport report manually filing ban evasion reports because the filter alone is not reliable enough. Crucially, because the filter is content-blind, it cannot identify a ban evader who writes in the same distinctive style as their banned account. **Memory fills this gap precisely**: stylometry matching (sentence structure, n-grams, punctuation, capitalization patterns) catches the user who changed devices but not their writing habits. Memory also provides explainable output (confidence breakdown, signal percentages, side-by-side fingerprint comparison), whereas the Ban Evasion Filter is a binary opaque flag.

---

### Harassment Filter

**What it actually does.** The Harassment Filter is an LLM trained on moderator actions and content removed by Reddit's internal enforcement teams. When enabled, it tags comments as "potential harassment" in the mod queue for review. Sensitivity settings: Low (highest accuracy, least filtered) and High (more filtered, more false positives). An allow-list of up to 15 keywords forces the model to ignore specific terms. Available to any sub where a mod holds settings-change permissions. Initially surfaced via APK teardown of the official Reddit Android app (version 2024.10.0, March 2024).

**Per-sub or platform-wide? Mod-controllable parameters.** Per-sub opt-in. Mods control sensitivity (Low/High) and the 15-keyword allow list. No per-community model fine-tuning—the underlying LLM is fixed and platform-wide. No configuration for community-specific vocabulary or tone norms beyond the keyword allow list.

**Documented adoption stats (source audit).** The "72% adoption in largest subreddits" claim in prior research (02-competitive-landscape) **cannot be corroborated by any public source**. Searched: Reddit's S-1 IPO filing coverage (TechCrunch, MostlyMetrics analysis), official Reddit blog, Reddit Help, Reddit Mods Help, The Register, Slashdot, GeeksforGeeks, and SafetyFilters landing page (redditforcommunity.com). None contain a 72% adoption figure. The Harassment Filter was discovered via APK teardown, not an official rollout announcement, which suggests no formal adoption metrics were published. **This stat must be dropped from Sentinel's competitive claims or explicitly flagged as unverified.**

**Known limitations and gaps Sentinel fills.** The Harassment Filter is **comment-level and post-hoc**: it evaluates individual comments after they are posted. It has no awareness of behavioral patterns across accounts, no velocity tracking, no account-age clustering, and no coordinated-attack detection. A brigade of 40 accounts posting mildly-worded but overwhelming coordinated content may not trigger the Harassment Filter at all, because each individual comment might be below the harassment threshold. The filter cannot predict that a thread is about to peak. It cannot distinguish organic negative sentiment from coordinated manipulation. **Raid Radar occupies exactly this gap**: it detects the brigade pattern before individual comments are evaluated, using velocity z-scores and account-age clustering that the Harassment Filter has no equivalent for. Health Score adds the trajectory prediction dimension: "this thread will peak at 95% risk in 90 minutes"—a statement the Harassment Filter is architecturally incapable of making.

---

### Mod Insights

**What it actually does.** Mod Insights is a per-sub analytics dashboard with three sections: (1) **Activity**—community growth metrics (pageviews, daily unique visitors, subscribers, unsubscribers) over 24h, 7d, 30d, or 365d windows; (2) **Team Health**—mod activity overview (active mods in last 7/30/365 days); (3) **Reports and Removals**—content safety overview showing post/comment removal and report rates. One documented data gap: admin removal and safety-tooling filtering rate data is unavailable before September 2023.

**Per-sub or platform-wide? Mod-controllable parameters.** Per-sub, read-only dashboard. No mod-configurable parameters. No alerts, no actions, no predictions.

**Documented adoption stats.** No public adoption figure. Reddit's help pages describe the feature but cite no usage data.

**Known limitations and gaps Sentinel fills.** Mod Insights is **retrospective and aggregate**: its minimum time window is 24 hours. It cannot tell a mod that a brigade started 4 minutes ago. It cannot show that a thread's comment velocity just crossed 4σ above baseline. It has no user-level analysis, no fingerprinting, no escalation forecasting, and no actionable alerts. It is a rearview mirror; Sentinel is a radar. Specifically: Raid Radar provides a brigade alert within 90 seconds; Health Score provides 1–2h forward projections; Memory identifies returning banned users. None of these capabilities exist in Mod Insights or are architecturally compatible with its design (historical aggregate vs. real-time anomaly detection).

---

### Adoption Reality

The "72% adoption in largest subreddits" figure attached to the Harassment Filter in prior research (02-competitive-landscape) is **unverified**. Extensive search across Reddit's official S-1 coverage, help documentation, news coverage from The Register, Slashdot, GeeksforGeeks, and platform-facing pages found no such statistic. The Harassment Filter was discovered through an APK teardown, not a formal announcement with adoption metrics. The filter was confirmed as opt-in per-sub with no reported opt-in rate from any public source.

**What is confirmed:** Reddit's Safety Filters suite (Reputation, Harassment, Ban Evasion, Mature Content) are all opt-in per-community settings. Reddit's moderation infrastructure includes platform-wide enforcement tools (separate from per-sub safety filters) that operate invisibly to moderators. All four per-sub safety filters have documented accuracy limitations.

**Implication for Sentinel's positioning**: Remove "72% adoption" as a data point in any pitch. The competitive claim is safer and more honest as: "Reddit's Harassment Filter is opt-in and content-level only. Sentinel's Raid Radar detects the coordinated behavioral pattern that triggered the need to post harassing content in the first place."

---

## Differentiation Thesis Under Realistic Constraints

**Where Sentinel still uniquely wins.** Three differentiation claims survive the competitive deepening intact and are supported by Reddit's own documentation:

1. **Brigade detection (Raid Radar)**: No Devvit app and no Reddit-native feature detects coordinated account influx using behavioral clustering in real time. The Ban Evasion Filter and Harassment Filter are both reactive to individual users/comments. Raid Radar's z-score on new-user influx + account-age entropy + sub-overlap + timing synchronization is categorically different. This claim is defensible against any currently documented Reddit feature.

2. **Content-aware ban evader matching (Memory)**: Reddit's Ban Evasion Filter explicitly does not analyze content or behavioral patterns (per their own help documentation). Memory's stylometry + behavioral dual-signal matching catches the VPN-bypassing ban evader that Reddit's filter misses by design. This gap is documented by Reddit themselves—Sentinel doesn't need to argue about it.

3. **Explainability and reversibility**: Every Reddit-native safety tool is opaque: the filter fires, content is queued, mods don't see confidence scores or signal breakdowns. Sentinel's philosophy—show *why* an alert fired, let mods undo within 24h—has no native equivalent and addresses a documented moderator frustration (see r/ModSupport: mods manually file ban evasion reports because they don't trust the filter's accuracy).

**Where the thesis weakens under scope constraint.** If only Raid Radar ships fully, claims 2 and 3 become forward-looking promises, not demo-verified capabilities. A judge evaluating a single-engine submission will ask: "Is this really a three-engine platform, or is it a brigade detector with a mock UI?" The answer determines whether Sentinel is positioned as a unified platform (ambitious, harder to defend) or a class-leading brigade detection tool (narrow, immediately credible). The latter is more achievable in 16 days and still has no competition.

---

## Recommendations

1. **Scope the demo to Raid Radar only.** Ship one engine with complete implementation, real signal computation, and the visual cluster graph. Present Health Score and Memory as stub panels in the dashboard with the unified-platform narrative intact. A polished, working Raid Radar is more competitive than three half-built engines. Past hackathon winners (575, Syllacrostic) confirm: focused execution beats ambitious breadth.

2. **Drop the 72% adoption stat.** No public source supports this figure. Replace with the documented fact: "Reddit's Harassment Filter is per-sub opt-in with no published adoption data." Unverified stats weaken credibility with technical judges.

3. **Lead with Reddit's own documentation as differentiation evidence.** Reddit's Ban Evasion Filter help page explicitly states it does not analyze post/comment content. Use that quote directly in the listing and pitch: "Reddit's own filter can't do this. Sentinel can." This is unusually strong positioning because the gap is self-documented by the competitor.

4. **Position against the gap, not against the filter's strength.** Do not argue Sentinel's Memory beats Reddit's platform-scale ban-evasion ML. It probably doesn't at scale. Argue that Sentinel catches a *different class* of evader—the one who changes devices but not writing style—that Reddit's filter architecturally cannot catch. These are complementary tools, not direct substitutes.

5. **Treat the 16-day timeline as a forcing function for demo quality, not feature count.** Judges evaluate what they see, not what the spec promises. Allocate 2–3 of the 16 days to demo scripting, test data, and the demo video (the spec's Milestone 8). A 60-second video showing Raid Radar detecting an 89%-confidence brigade in 90 seconds is worth more than three engines at 30% completion.

---

## Sources Cited

1. Reddit Mod Tools and Migrated Apps Hackathon — Devpost: https://mod-tools-migration.devpost.com/
2. 575: A Daily Haiku Game for Reddit (Thomas Park, Jan 2025): https://thomaspark.co/2025/01/575-a-daily-haiku-game-for-reddit/
3. Syllacrostic — Devpost submission: https://devpost.com/software/syllacrostic
4. Laddergram — Devpost submission: https://devpost.com/software/laddergram
5. Emoji Charades — Devpost submission: https://devpost.com/software/emoji-charades
6. WYR Reddit Hackathon Mar 2025 — GitHub (RedBeret): https://github.com/RedBeret/WYR_Reddit_Hackathon_Mar2025
7. Reddit Games and Puzzles Hackathon — Devpost: https://redditgamesandpuzzles.devpost.com/
8. Hack Reddit 2025 — Devpost: https://hackreddit.devpost.com/
9. Phaser — Reddit Games and Puzzles Hackathon announcement: https://phaser.io/news/2024/11/reddit-games-and-puzzles-hackathon
10. fsvreddit GitHub profile (evasion-guard, hive-protect, bot-bouncer, sub-stats-bot, automodmail): https://github.com/fsvreddit
11. Evasion Guard — GitHub (fsvreddit): https://github.com/fsvreddit/evasion-guard
12. Hive Protect — GitHub (fsvreddit): https://github.com/fsvreddit/hive-protect
13. Bot Bouncer — GitHub (fsvreddit): https://github.com/fsvreddit/bot-bouncer
14. Devvit Pixelary — GitHub (Reddit official): https://github.com/reddit/devvit-pixelary
15. Devvit Mod Tool Template — GitHub (Reddit official): https://github.com/reddit/devvit-template-mod-tool
16. Ban Evasion Filter — Reddit Help: https://support.reddithelp.com/hc/en-us/articles/15484544471444-Ban-evasion-filter
17. Ban Evasion Filter — Reddit Mods Help: https://mods.reddithelp.com/hc/en-us/articles/14548700210829-Ban-Evasion-Filter
18. Harassment Filter — Reddit Help: https://support.reddithelp.com/hc/en-us/articles/23856209638932-Harassment-filter
19. Reddit Introduces LLM Harassment Filter — The Register (March 7, 2024): https://www.theregister.com/2024/03/07/reddit_introduces_aipowered_harassment_filter/
20. Reddit Will Use AI Model to Fight Harassment — Slashdot: https://tech.slashdot.org/story/24/03/07/2213245/reddit-will-now-use-an-ai-model-to-fight-harassment
21. Safety Filters — Reddit Help: https://support.reddithelp.com/hc/en-us/articles/15484574845460-Safety-Filters
22. Safety Filters — Reddit For Community: https://redditforcommunity.com/features/safety-filters
23. Mod Insights — Reddit Help: https://support.reddithelp.com/hc/en-us/articles/15484468824980-Mod-Insights
24. Mod Insights — Reddit Mods Help: https://mods.reddithelp.com/hc/en-us/articles/13599269020045-Mod-Insights
25. Reddit IPO S-1 coverage — TechCrunch: https://techcrunch.com/2024/02/23/reddit-downplays-risks-of-developer-backlash-decentralized-social-media-in-its-ipo-filing/
26. Reddit Unveils New Moderation and Analytics Tools — TechsterHub: https://www.techsterhub.com/news/reddit-unveils-new-content-moderation-and-analytics-tools-to-boost-user-engagement/
27. How Does Reddit Detect Ban Evasion — Quora: https://www.quora.com/How-does-Reddit-detect-ban-evasion-within-a-subreddit-I-m-not-banned-just-curious
28. r/ModSupport — How do I report ban evasion: https://reddit.garudalinux.org/r/ModSupport/comments/1g12aug/how_do_i_report_ban_evasion/
