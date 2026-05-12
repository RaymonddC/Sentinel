# Devvit Best Practices and Gotchas

## Summary

Sentinel's runtime assumptions are **partially viable but risky** on Devvit. The 5-second debounce, 5-minute scheduled scans, and ~500MB KV budget are defensible. However, the **14-day bootstrap backfill on install is likely unfeasible** without lazy backfill or partial initial fetch (Reddit API rate limits + timeout constraints). **Custom post complexity is borderline**: Devvit Blocks can support tabs, KPI tiles, and signal bars, but cluster graphs and multi-modal triage views risk render-time bloat and lag on mobile. File structure and async patterns must follow Devvit conventions (TypeScript, monorepo, event-driven triggers, promise-based error handling).

## Conventions to Adopt

- **Language & Monorepo:** TypeScript (100% of first-party Devvit apps); use Turborepo for multi-package architecture if Sentinel grows beyond single-app scope. Node v22.2.0+ required.
- **File Structure:** Flat or shallow (avoid deep nesting); separate concerns into `/triggers`, `/handlers`, `/storage`, `/ui` folders. Devvit examples use simple directory-per-feature pattern.
- **Event Handlers:** Async/await consistently; always wrap with try/catch or .catch() to avoid unhandled promise rejections (crashes the app). Devvit triggers (PostCreate, CommentCreate, ModAction, etc.) are event-driven; debounce re-evaluation at the handler level (not framework-guaranteed).
- **KV Access:** Use async/await; batch reads/writes where possible to minimize round-trips. No synchronous blocking I/O.
- **Error Handling:** Distinguish between transient (retry) and permanent (log + fallback) errors. Use typed errors (avoid catch(error: any)); prefer Result<T> or [error, data] tuple patterns for clarity. Log errors to KV for audit trail.
- **Settings/Config:** Use Devvit's `context.settings` or `context.modFlags` for per-sub configuration; store complex config in KV with versioning (allows safe upgrades).
- **Install Hook:** Devvit provides `onInstall` lifecycle hook; use it for settings initialization, not data backfill (see Bootstrap Feasibility section). Mark install complete after settings are persisted; do NOT block install on historical fetch.
- **Scheduler:** Use `context.scheduler.scheduleJob()` for recurring tasks (e.g., 5-minute scans). Frequency limits unknown from public docs; conservatively assume minimum 1–5 minute granularity; test before deploying.
- **Modmail:** Use `context.modMail.send()` for alerts. No public rate limit documented; assume rate limiting exists (similar to Reddit's 60/min tier for OAuth apps). Avoid batching >10 modmails/min per sub.

## Rate Limits and Quotas

| Resource | Limit | Source | Sentinel Impact |
|----------|-------|--------|---|
| **KV Storage (per sub)** | ~500 MB (estimated) | Spec assumption | Critical. Schema fits if user fingerprints (last 100 comments) and thread states are pruned aggressively. Verify with Reddit before deploy. |
| **KV Write Throughput** | Unknown (assume bounded) | Devvit docs unavailable | Risky. 5-second debounce per thread assumes writes don't cascade. Test write pressure on high-traffic subs. |
| **Reddit API (getUserById, getComments, etc.)** | 60 requests/min (OAuth, estimated) | General Reddit API | **Blocker for bootstrap.** Fetching 14 days of comments for a 100K-member sub could require 1000s of requests; will hit rate limit mid-bootstrap. |
| **Scheduler Frequency** | Unknown (assume 1–5 min min) | Devvit docs unavailable | Acceptable for 5-min scans if supported; test before shipping. No guarantee of sub-second precision. |
| **Modmail Send Rate** | Unknown (assume 10–20/min per sub) | Devvit docs unavailable | Low risk. Sentinel sends modmail only on critical alerts (~1–5/day typical). |
| **Custom Post (Blocks) Rendering** | Unknown (assume ~100 DOM elements per post) | Devvit GitHub issues | Risk. Cluster graph + 5 tabs + modals could push rendering to 200+ DOM nodes; test on mobile for jank. |
| **Scheduler Job Timeout** | Unknown (assume 5–30 min) | Devvit docs unavailable | Risky for bootstrap; safe for 5-min scans. |

## Spec Patterns That May Conflict

- **14-day Bootstrap Backfill (Section 01, 00-architectural-summary.md lines 71, 93):** 
  - **Conflict:** Reddit API rate limits (60 req/min OAuth) + network timeouts make fetching 14d of comments on install infeasible for large subs.
  - **Severity:** **Blocker.** Cannot meet "14-day bootstrap" requirement as written.
  - **Mitigation:** Adopt lazy backfill (fetch comments as they arrive for first 7d, mark partial state); accept 1–3 day cold-start period instead.

- **5-Second Debounce on Engine Re-evaluation (Section 00, line 75):**
  - **Conflict:** Devvit scheduler granularity unknown; event trigger handlers don't have built-in debounce. Application-level debounce (e.g., in-memory timer + KV flag) required.
  - **Severity:** **Risky.** Requires manual implementation; no framework guarantee if handler fires twice within 5s.
  - **Mitigation:** Implement debounce via KV compare-and-set (`getAsync` + conditional `putAsync`); document as "approximate" debounce.

- **Atomic Alert Persistence (Section 00, line 32):**
  - **Conflict:** KV is single-key atomic, but "alert + index + audit + dashboard refresh" spans 4+ keys. Race condition possible if handler crashes mid-update.
  - **Severity:** **Risky.** Audit log may miss an alert if process dies after alert write but before index write.
  - **Mitigation:** Use versioned alert IDs; retry index+audit writes on restart (idempotent design).

- **Custom Post Dashboard Complexity (Section 06, mockup reference):**
  - **Conflict:** 5 tabs + KPI tiles + cluster graph + signal bars + modal triage = 150–250 DOM nodes. Devvit Blocks are "very much limited" per GitHub; rendering lag on mobile likely.
  - **Severity:** **Cosmetic → Risky.** Won't block ship, but UX may degrade on 4G/slow devices.
  - **Mitigation:** Lazy-load tabs; defer graph render until user clicks; use fixed-height containers to avoid layout shift.

- **50 Watched Threads Max Per Sub (Section 00, line 77):**
  - **Conflict:** KV budget depends on thread state size. If 50 threads × ~5KB state = 250KB acceptable, but if cluster data embedded, could exceed allocation.
  - **Severity:** **Cosmetic.** Non-blocking if you prune old thread states weekly.
  - **Mitigation:** Implement weekly cleanup (delete threads older than 7d unless flagged); cap entries with LRU.

## Bootstrap Feasibility

**Verdict: 14-day full backfill is NOT feasible on install; recommend lazy backfill or partial initial load.**

### Detailed Analysis

1. **Scale Math:**
   - Assume 10K–100K member sub with average 200 posts/day and 50 comments/post.
   - 14 days = 2,800 posts = 140,000 comment API calls.
   - Reddit OAuth rate limit: 60 req/min = 3,600 req/hour.
   - Time to fetch: 140,000 ÷ 3,600 ≈ 39 hours.
   - **Devvit scheduler timeout: likely 5–30 min (unconfirmed).** Install would timeout before completing.

2. **Recommended Alternatives:**
   - **Option A (Lazy Backfill):** On install, fetch only the last 24 hours of posts/comments; start normal baseline accumulation. After 7 days, baselines are warm. Mark app "learning" for first week (calibration ramp already in spec, line 76).
   - **Option B (Partial Backfill):** Fetch last 2–3 days on install (feasible in 5–10 min), then background job fills in 3–14 day gap over next 3 hours (scheduled 100 req/min, respecting rate limit).
   - **Option C (Config Flag):** Allow mods to opt into "extended backfill" (takes 1+ hour); app processes in background, marks threads/users as backfilled separately from live-indexed.

3. **Batch API Calls:** Use `context.reddit.getComments(filter: { before, after })` or equivalent batch API if available; reduces round-trips. **Status: Unconfirmed whether Devvit supports batch comment fetch.**

4. **Recommendation:** Adopt **Option A (lazy backfill, 24h initial)** + spec clarification in product decisions (line 71) to reflect "7-day warm-up" instead of "bootstrap completion after 7d calibration." This matches the calibration ramp already defined.

## Custom Post Complexity

**Verdict: Achievable, but mobile UX risk. Cluster graph is the worst widget.**

### Technical Assessment

1. **Supported Complexity:**
   - ✅ **5 tabs:** Devvit Blocks support conditional rendering; simple to build (e.g., `{activeTab === 'Threats' && <ThreatsList />}`).
   - ✅ **KPI tiles:** Small read-only blocks (2 rows × 3 cols = 6 tiles). Well-supported.
   - ✅ **Signal bars:** SVG or CSS bars; ~30 DOM nodes total. Lightweight.
   - ✅ **Modal triage:** Single modal overlay + form controls; standard pattern.
   - ⚠️ **Cluster graph:** Graph rendering (e.g., D3 or custom canvas) is **the constraint.** 30–50 nodes + edges = 200+ DOM elements in SVG form.

2. **Bottleneck: Cluster Graph Rendering**
   - Devvit Blocks use React-like JSX with custom runtime; SVG rendering is supported but untested at scale.
   - Preliminary evidence from GitHub issues: "Blocks are very much limited" and "ArrayBuffer transfer performance" issues noted.
   - **Risk:** Graph re-renders on every KV update (dashboard refresh debounced, line 32); mobile browser may stall for 500ms–2s.
   - **Severity:** Not a blocker, but cosmetic jank on low-end devices.

3. **Mitigation:**
   - Lazy-load graph only when user clicks "Show Cluster" tab.
   - Use canvas (not SVG) for graph if Devvit supports it (more performant, unconfirmed).
   - Render graph once on initial mount, cache image; re-fetch only if cluster changes (not on every dashboard update).
   - Cap cluster visualization to ≤20 nodes; collapse smaller accounts.
   - Test on actual mobile (Reddit's official app + slow 4G) before launch.

4. **Dashboard Update Frequency:**
   - Spec debounces custom post updates (no line cited, but implicit in "atomic alert persistence").
   - **Assumption:** Post updates every 5–10s during active incidents.
   - **Devvit Reality:** Frequency unknown. Assume Blocks can handle 1 update/second without lag. Plan for 5–10s debounce minimum.

## Sources

1. [GitHub - reddit/devvit (main repository)](https://github.com/reddit/devvit)
2. [GitHub - reddit/devvit-docs (documentation repository)](https://github.com/reddit/devvit-docs)
3. [GitHub - reddit/devvit-examples (example apps)](https://github.com/reddit/devvit-examples)
4. [GitHub - reddit/devvit-kit (helper library)](https://github.com/reddit/devvit-kit)
5. [Developer Platform & Accessing Reddit Data – Reddit Help](https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data)
6. [Devvit #1: Introduction to the Reddit Developer Platform – Hashnode](https://dragonejt.hashnode.dev/introduction-to-the-reddit-developer-platform)
7. [Building Reddit Game with Devvit and TypeScript – DEV Community](https://dev.to/room_js/building-reddit-game-with-devvit-and-typescript-starter-included-3kcp)
8. [Better error handling with async/await – DEV Community](https://dev.to/sobiodarlington/better-error-handling-with-async-await-2e5m)
9. [The 5 commandments of clean error handling in TypeScript – Medium](https://medium.com/with-orus/the-5-commandments-of-clean-error-handling-in-typescript-93a9cbdf1af5)
10. [Reddit API Rate Limits 2026: Complete Guide – PainOnSocial](https://painonsocial.com/blog/reddit-api-rate-limits-guide)
