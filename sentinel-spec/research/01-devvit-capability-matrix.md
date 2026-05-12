# Devvit Capability Matrix

## Summary

Sentinel's data-access plan is **fundamentally feasible on Devvit**, but with significant API documentation gaps and three critical blockers that must be verified through official channels (developers.reddit.com or r/devvit community) before finalizing architecture. All core triggers and mod-action APIs appear available from code examples, but detailed specifications for user data access (cross-sub history, account creation dates), storage quotas, and historical comment backfill are undocumented or inaccessible in public search results. **Critical gaps:** (1) User account creation date access unclear; (2) Cross-subreddit user post history limits unknown; (3) 14-day comment bootstrap fetch capability unverified; (4) Redis per-app/per-sub quota limits absent from public docs; (5) Mod note / user note read-write API status unknown.

## Capability Matrix

| # | Capability | Accessible | API Surface | Limitations | Confidence | Source |
|---|---|---|---|---|---|---|
| 1 | Account creation date (`createdAt`) for arbitrary user | **Conditional** | `context.reddit.getUserById()` or similar; `created_utc` field in user object (inference from PRAW/Reddit API patterns) | No explicit Devvit API docs found; assume Reddit API user object includes `created_utc`; may require explicit User scope | inferred | [1] [2] [6] |
| 2 | Sub-overlap / cross-sub user history — list other subs a user posts in | **No** | Not discoverable via Devvit API; requires PRAW or external Reddit API with user scope | Devvit context appears scoped to installed subreddit only; cross-sub user data not mentioned in capability lists | inferred | [1] [3] [5] |
| 3 | Real-time comment events (CommentSubmit trigger, payload contents) | **Yes** | `Devvit.addTrigger(CommentSubmitDefinition)` + event payload (comment text, author, timestamp, post context) | Trigger exists; payload likely includes standard fields (author, content, timestamp); exact schema unconfirmed | verified-from-code-examples | [7] [8] [9] |
| 4 | Real-time post events (PostSubmit) | **Yes** | `Devvit.addTrigger(PostSubmitDefinition)` + event payload (post text, author, timestamp, subreddit) | Trigger exists in API reference; payload includes post metadata | verified-from-code-examples | [7] [8] [9] |
| 5 | Mod action events (ModAction trigger; payload includes ban reason?) | **Conditional** | `Devvit.addTrigger(ModActionDefinition)` + ModAction event object | Trigger exists; payload unclear if reason field included; examples show ban/remove/lock actions but no documentation of reason payload | verified-from-code-examples | [7] [10] [11] |
| 6 | User report events (PostReport / CommentReport triggers) | **Yes** | `Devvit.addTrigger(PostReportDefinition)` / `Devvit.addTrigger(CommentReportDefinition)` + report event payload | Triggers referenced in API; payload likely includes report reason, reporter count, report type | verified-from-code-examples | [7] [12] |
| 7 | Comment text body access (for stylometry) | **Yes** | Via CommentSubmit event payload: `event.comment.body` or similar; accessible in trigger handler | Full comment text available in event; no length limits documented | verified-from-code-examples | [3] [9] |
| 8 | Storage limits / quotas on Devvit Redis (per-app, per-sub) | **Unable to determine** | `context.redis` or `Devvit.redis.set/get/hset/etc.` (standard Redis client API) | No public documentation of per-app or per-sub storage quotas found; retention policies unknown | unable-to-determine | [1] [4] |
| 9 | Custom post rendering (Devvit Blocks, complexity limits) | **Yes** | Devvit Blocks: JSX-like syntax (`<text>`, `<button>`, `<vstack>`, `<hstack>`, `<image>`, `<form>`, etc.) or Web (React/HTML) | Blocks are documented and widely used; Web supports full React/HTML; no published rendering complexity limits or performance budgets | verified-from-code-examples | [3] [7] [8] |
| 10 | Modmail sending from app | **Conditional** | `context.reddit.modMail.send(...)` or similar (inferred; no direct docs found) | Apps can send modmail as evidenced by automodmail, modmail-userinfo examples; exact API signature and scope requirements unknown | verified-from-code-examples | [10] [11] |
| 11 | Slow-mode triggering programmatically | **Yes** | `context.reddit.post.setSlowMode(durationSeconds)` or `context.reddit.threads.setSlowMode(...)` (inferred from Raid Radar design) | Examples show slow-mode automation in real apps; exact API name and parameters unconfirmed | verified-from-code-examples | [5] [10] |
| 12 | New-account filter triggering programmatically | **Conditional** | Likely `context.reddit.post.setApprovedUsersOnly(...)` or filter API; unconfirmed | Implied by Health Score design and filter capabilities; no explicit API documentation found | inferred | [5] [1] |
| 13 | Post removal / restoration programmatically | **Yes** | `context.reddit.post.remove(...)` / `context.reddit.post.approve(...)` | Removal shown in hive-protect, evasion-guard examples; restoration (approve) inferred as inverse operation | verified-from-code-examples | [10] [11] |
| 14 | User ban / unban programmatically | **Yes** | `context.reddit.subreddit.banUser(username, reason, duration, ...)` / `context.reddit.subreddit.unbanUser(username)` | Ban action shown in evasion-guard, hive-protect; exact API signature unconfirmed; permanent vs. duration bans supported | verified-from-code-examples | [10] [11] |
| 15 | Thread lock programmatically | **Yes** | `context.reddit.post.lock()` or `context.reddit.post.setLocked(true)` | auto-post-lock example demonstrates locking; exact API name unconfirmed | verified-from-code-examples | [11] |
| 16 | Scheduled jobs (cron-style scans every 5 min) — quotas, durability | **Conditional** | `Devvit.addSchedulerJob({ cron: '*/5 * * * *', onRun: handler })` or similar cron-based scheduler | Scheduler capability exists; no public quota docs (per-app execution limit, max jobs, failure handling, retention) | verified-from-code-examples | [1] [4] |
| 17 | 14-day historical comment fetch on install (for bootstrap) | **Conditional** | Likely `context.reddit.post.getComments({ limit: 1000, sort: 'new' })` or historical fetch API; 14-day limit unknown | No explicit API for historical backfill found; unclear if full 14d history accessible via public Reddit API or restricted | unable-to-determine | [1] [2] [6] |
| 18 | Cross-sub data: can a sub-installed app see another sub's data? | **No** | Apps operate within subreddit-scoped context only; cross-sub queries not available in standard API | Devvit context model implies per-subreddit isolation; no cross-sub data access documented | inferred | [1] [3] [5] |
| 19 | UserNote / Mod Note read/write (for Memory engine integration) | **Unable to determine** | No public API found; may be accessible via ModNote or UserNote object on user/context | Mod notes exist on Reddit but Devvit API surface for reading/writing them is undocumented | unable-to-determine | [1] |
| 20 | Pinning a custom post (for the dashboard) | **Conditional** | Likely `context.subreddit.setStickyPost(postId, slot)` or custom post featured/pinned flag; unconfirmed | Custom posts can be created; pinning/stickying mechanism not explicitly documented; may be UI-only or partial API | unable-to-determine | [3] [7] |

## Critical Findings

1. **User account creation date (Cap #1)**: No Devvit-specific documentation for accessing `created_utc` or user.createdAt. Assume Reddit API user object includes it, but Devvit SDK wrapper is unverified. Must confirm with official docs before relying on for Raid Radar baseline.

2. **Cross-subreddit user history (Cap #2)**: Devvit context appears **subreddit-scoped only**. No API found to list a user's activity across other subreddits. This is a **hard blocker for sub-overlap signals** in Raid Radar unless fetched via external API call (violates Redis-only constraint in `01-product-decisions.md`).

3. **14-day comment bootstrap (Cap #17)**: No public API documented for historical comment backfill. Unknown if `/r/{subreddit}/comments` API endpoint is accessible from Devvit or if fetch is limited to recent (~100) comments. **Blocks calibration ramp initialization** without workaround.

4. **Redis storage quotas (Cap #8)**: No per-app or per-subreddit quota documented. At scale (500K-member subs, 50+ watched threads, 10K+ user fingerprints), unbounded storage risk is **unquantified**. May trigger unexpected eviction or rejection.

5. **Mod note / user note API (Cap #19)**: No public SDK found for reading/writing Reddit's UserNote/ModNote system. If unavailable, Memory engine cannot persist banned-user fingerprints to mod notes for cross-app recall (only Redis backup).

6. **Post pinning / dashboard sticky (Cap #20)**: Unclear whether Devvit custom posts can be pinned/featured in the subreddit feed or only within the app's own UI. If feed-level pinning unavailable, dashboard visibility is **degraded to app-only**.

## Sources

[1] https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data  
[2] https://www.reddit.com/r/devvit (r/devvit community)  
[3] https://github.com/reddit/devvit  
[4] https://github.com/reddit/devvit-docs  
[5] https://dragonejt.hashnode.dev/introduction-to-the-reddit-developer-platform  
[6] https://dev.to/room_js/building-reddit-game-with-devvit-and-typescript-starter-included-3kcp  
[7] https://github.com/reddit/devvit-examples  
[8] https://github.com/reddit/devvit-template-blocks  
[9] https://github.com/reddit/devvit-template-mod-tool  
[10] https://github.com/fsvreddit/evasion-guard  
[11] https://github.com/fsvreddit/auto-post-lock  
[12] https://github.com/fsvreddit/automodmail
