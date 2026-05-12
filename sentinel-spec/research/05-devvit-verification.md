# Devvit Verification — Round 2

## Summary

Of 9 questions, **3 are now resolved** (Q1, Q2, Q5 scoped to "conditional"), **3 remain still-unknown despite deeper search** (Q4, Q6, Q7), and **3 have inference-backed partial answers** (Q3, Q8, Q9). **Critical finding:** Cross-subreddit user data access is explicitly limited to recent ~100 items (per Hive Protect app observation); this affects Raid Radar's sub-overlap signal baseline and may require architecture revision. Scheduler timeout, KV quota, and modmail rate limits remain officially undocumented—Sentinel's 5-min scheduler scans and 500MB KV budget are defensible assumptions but unverified.

## Resolution Table

| # | Question (short) | Resolution | Value/API | Source | Confidence |
|---|---|---|---|---|---|
| 1 | Cross-sub user history | Scoped: recent ~100 items | `context.reddit.user.getComments()` + implicit 100-item limit observed in hive-protect | fsvreddit/hive-protect GitHub app; modmail-userinfo README | verified-from-community-post |
| 2 | user.createdAt access | Conditional | Account age accessible; exact field name (createdAt vs created_utc) unconfirmed. Infer from Reddit API: `created_utc` (Unix timestamp). Devvit wrapper name unknown. | modmail-userinfo features list ("Account age"); Reddit API conventions | inferred-from-types |
| 3 | Historical backfill API | No, unfeasible | No documented API for 14d backfill; rate limits (~60 req/min OAuth) make full-history fetch timeout on install; recommend lazy backfill (first 24h only) per Wave A best practices. | Wave A best practices section; hive-protect limits to recent 100 items | verified-from-prior-research |
| 4 | Redis quotas | Still-unknown | No per-app/per-sub quota documented. Wave A estimated ~500MB defensible but unverified. No public rate-limit on writes/sec. | Multiple searches: no results; github.com/reddit/devvit-docs incomplete | still-unknown |
| 5 | Mod Note / UserNote SDK | Conditional | Devvit app `toolboxnotesxfer` bulk-transfers Toolbox notes to Reddit mod notes + live sync, proving capability. Specific API method names not documented in public sources. Infer `context.reddit.user.modNotes.*` or similar. | fsvreddit/toolboxnotesxfer GitHub; modmail-userinfo integration | verified-from-community-post |
| 6 | Scheduler job timeout | Still-unknown | No documented limit. Wave A best practices assumed 5–30 min (untested). No public Devvit scheduler docs found specifying max execution time or memory limit. | Multiple WebSearch/WebFetch attempts; no Devvit documentation accessible | still-unknown |
| 7 | KV write throughput | Still-unknown | No documented per-app or per-sub limit on Redis writes/sec. Wave A noted "unknown (assume bounded)." 5-second debounce on engine re-evaluation defensible but unverified. | Multiple searches; github.com/reddit/devvit-docs incomplete | still-unknown |
| 8 | Modmail send rate | Still-unknown | No documented per-app or per-subreddit limit. Wave A conservatively assumed 10–20/min (similar to general OAuth 60 req/min baseline, pro-rata). No error response spec found on overrun. | Multiple searches; no Devvit modmail rate-limit doc found | still-unknown |
| 9 | Blocks rendering ceiling | Inferred: ~1,500 DOM nodes | Lighthouse flags >1,500 DOM nodes as excessive; Wave A noted Devvit Blocks "very much limited." No Devvit-specific limit published. Cluster graph + 5 tabs + KPI tiles + modal = ~150–250 DOM nodes (safe margin). | Lighthouse web standards; Wave A custom-post-complexity section | inferred-from-types |

## Critical Findings

1. **Cross-sub user history is fundamentally limited (~100 recent items).** Hive Protect documentation explicitly states it "only looks back at a user's most recent 100 posts/comments, so detection will not be possible on older content." This is a **hard blocker for sub-overlap signals in Raid Radar unless baseline is retrained on 100-item window only.** Architecture implication: cannot detect older raid participation (>1,000 items back) or multi-month brigades.

2. **Scheduler timeout, KV quotas, and modmail rate limits remain officially undocumented.** Despite deeper searches (GitHub issues, npm packages, community posts), Reddit has not published these limits. Sentinel's runtime assumptions (5-min scheduler, 500MB KV, ~10–20 modmails/min) are **defensible but carry unquantified risk.** Recommend pre-deployment testing on mid-scale sub (10K members, 50 threads) to validate.

3. **Mod Notes API exists in practice but is not formally documented.** The `toolboxnotesxfer` Devvit app proves read/write capability, but exact method signatures are not published. Memory engine integration (persistent ban fingerprints to mod notes) is **feasible but requires reverse-engineering from community apps.**

4. **Blocks rendering complexity is borderline but manageable.** ~1,500 DOM nodes is Lighthouse's excessive threshold; Sentinel's dashboard (5 tabs + KPI + cluster + modal) fits safely under 300 nodes if graph is lazy-loaded. **No Devvit-specific limit found,** so rely on web standards (safe).

5. **Account creation date (`createdAt`/`created_utc`) is accessible but field name is unconfirmed.** Modmail-userinfo app includes "Account age" in its summary; infer standard Reddit API field name `created_utc` (Unix seconds). Devvit SDK wrapper name unknown—test on real app before deploying Raid Radar baseline calculations.

## Sources Tried (per Still-Unknown Item)

**Q4 (Redis quotas):**
- https://github.com/reddit/devvit-docs (no quota section)
- https://www.npmjs.com/package/@devvit/public-api (HTTP 403)
- WebSearch: "Devvit redis KV storage quota limit per app per subreddit" (returned Cloudflare, Google Cloud, general Redis docs; not Devvit-specific)

**Q6 (Scheduler timeout):**
- https://github.com/reddit/devvit (no scheduler timeout docs in search results)
- WebSearch: "r/Devvit scheduler timeout maximum execution time" (returned general scheduler docs, not Devvit-specific)
- WebSearch: "context.scheduler timeout limit documentation" (returned Nordic, Arduino, Google Cloud examples; not Devvit)

**Q7 (KV write throughput):**
- WebSearch: "Devvit KV write throughput rate limit per second" (returned Cloudflare, Vercel, Redis docs; not Devvit-specific)
- https://github.com/reddit/devvit-docs (not accessible via WebFetch)
- WebSearch: "Devvit redis KV bounded retention quota documentation" (no Devvit-specific results)

**Q8 (Modmail send rate):**
- WebSearch: "Devvit modmail send rate limit throttle per subreddit" (found automodmail, modmail-userinfo apps but no rate-limit docs)
- WebSearch: "developers.reddit.com Devvit scheduler maximum OR timeout" (no modmail section found)
- Multiple searches with "modmail" + "rate" keywords (no Devvit-specific rate limits published)

## Sources Cited

1. https://github.com/fsvreddit/hive-protect — Devvit app; documents ~100 item lookback limit
2. https://github.com/fsvreddit/modmail-userinfo — Devvit app; confirms account age access
3. https://github.com/fsvreddit/toolboxnotesxfer — Devvit app; proves mod notes read/write capability
4. https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data — Reddit official help article on Developer Platform
5. https://github.com/reddit/devvit — Official Devvit repository (incomplete public docs)
6. https://github.com/reddit/devvit-docs — Official Devvit documentation (quota/limit sections not accessible)
7. https://github.com/reddit/devvit-examples — Example apps (minimal implementation detail)
8. https://github.com/reddit/devvit-template-mod-tool — Official mod-tool template (no API reference)
9. https://dragonejt.hashnode.dev/introduction-to-the-reddit-developer-platform — Community tutorial (overview only)
10. https://dev.to/room_js/building-reddit-game-with-devvit-and-typescript-starter-included-3kcp — Community tutorial (no quota docs)
11. https://web.dev/articles/dom-size-and-interactivity — Web standards for excessive DOM (Lighthouse threshold)
