# 01 · Product Decisions Log

> Every major design decision made during the brainstorming session. Each entry has the question, the options considered, what was chosen, and **why**. This is the most important file in the spec — when in doubt, read this before changing anything.

---

## Q1 · Project scope

**Question:** When we say "build Sentinel," what does that mean?

**Options considered:**
- Build all three engines at MVP quality
- Build one engine extremely well
- Build a thin slice of all three

**Decision:** Build all three engines fully integrated.

**Why:** User explicitly chose maximum ambition with no time constraints. Spec is engineered to make this achievable through aggressive infrastructure sharing across engines.

---

## Q2 · Demo environment

**Question:** Where does Sentinel run during development and demo?

**Decision:** Create a private test subreddit (e.g., `r/SentinelDemo`), populate with alt accounts, scripted demo.

**Why:** Hackathon explicitly requires <200-member subreddit for the demo post. Scripted scenarios using owned alts allow repeatable, dramatic demos. Real-world data is unpredictable for a 60-second video.

---

## Q3 · Demo narrative lead engine

**Question:** Which engine opens the demo video?

**Decision:** Raid Radar leads. Memory and Health Score appear as supporting context.

**Why:** Raid Radar has the most visual impact (cluster graph with red dots) and zero existing analog on Reddit. Memory was tempting but overlaps visually with Reddit's existing Mod Notes feature — judges might mentally categorize Memory as "fancier mod notes." Health Score is intelligent but less cinematic. Lead with the screenshot that ends up in the press release.

---

## Q4 · Raid Radar detection brain

**Question:** How does Sentinel detect a brigade?

**Options considered:**
- Heuristic rules (hardcoded thresholds)
- Statistical anomaly detection
- ML model
- Hybrid (rules + statistics + ML for close calls)

**Decision:** Statistical anomaly detection (baseline + standard deviations + signal stacking).

**Why:**
- ML rejected: no training data exists for "labeled brigades," manual labeling is 2–3 weeks of work, hosted inference adds cost and failure modes
- Heuristics rejected: hardcoded thresholds can't tell viral apart from brigade
- Statistics wins: per-sub baselines learn automatically, fully explainable, cheap, debuggable, works from week 1
- ML upgrade path remains available for v2 — every alert and dismissal becomes labeled training data automatically

**This is THE most important decision in the spec.** Don't override.

---

## Q5 · Memory detection brain

**Question:** How does Memory catch ban evaders?

**Options considered:**
- Behavior signals only (posting times, sub overlap, frequency)
- Stylometry only (writing fingerprint)
- Both combined

**Decision:** Both combined. Behavior + stylometry, weighted score.

**Why:**
- Behavior catches lazy evaders (same schedule)
- Stylometry catches schedule-changers (same writing style)
- Single-signal stylometry has high false-positive risk (people write similarly by coincidence) — combination corrects for this
- Combination cost is ~1.3x single-signal cost (not 2x) because shared data pipeline
- "94% style match + 87% behavioral match" is the demo screenshot that lands

---

## Q6 · Health Score prediction approach

**Question:** How does Health Score produce its 89% risk number?

**Options considered:**
- Threshold-based scoring
- Statistical baseline + trajectory
- Time-series forecasting (Holt-Winters)
- Survival analysis

**Decision:** Statistical baseline + trajectory. Same pattern as Raid Radar.

**Why:**
- Time-series forecasting fails on sparse/noisy comment data
- Survival analysis requires hundreds of labeled historical threads — not realistic
- Threshold-based is what AutoMod already does; nothing new
- **Sharing Raid Radar's infrastructure is the architectural win** — one baseline system serves both engines, one config UI, one debugger
- "Baseline + trajectory" provides the four-quadrant logic (stable-active vs quietly-heating vs already-bad vs bad-and-worsening) that mods intuitively understand

---

## Q7 · Settings configuration

**Question:** How configurable is Sentinel for mods?

**Options considered:**
- Zero-config (auto-tune everything)
- Sensitivity slider per engine
- Full power-user config (20+ knobs)
- Tiered: simple defaults + collapsible advanced panel

**Decision:** Tiered. Simple defaults visible, advanced settings collapsible.

**Why:**
- Zero-config gets uninstalled by power users (mods of big subs need to tune)
- Full config gets uninstalled by everyone else (overwhelming)
- AutoMod's complaint pattern is "too scary to edit" — Sentinel's pitch is being better than AutoMod
- Tiered is how Stripe/GitHub/Linear admin tools work — recognizable senior product pattern
- Marginal cost is ~10% (advanced panel is just exposing values already stored)

---

## Q8 · Alert delivery

**Question:** How do alerts reach mods?

**Options considered:**
- Modmail only
- Custom mod-only post (dashboard) only
- Discord/Slack webhooks
- Custom post + modmail (two channels by severity)
- Everything

**Decision:** Custom mod-only post (always-visible dashboard) + modmail for critical alerts only.

**Why:**
- Two-channel by severity is the production pattern (Datadog dashboard + PagerDuty alerts)
- Dashboard for ambient awareness, modmail for "wake me up"
- Webhooks rejected — adds external dependency, mod teams have varied chat infra
- Modmail-only risks alert fatigue
- Dashboard-only risks missed critical alerts

---

## Q9 · Automation and trust

**Question:** Does Sentinel act on its own, or just suggest?

**Options considered:**
- Fully manual (suggest only)
- Suggest + opt-in auto-throttle for reversible actions
- Tiered auto-action by confidence
- Full automation with audit log

**Decision:** Suggest by default. Auto-throttle (slow mode, filter new accounts) is opt-in per engine. **Sentinel never bans, never removes content.**

**Why:**
- Mod community gospel: tools that take irreversible actions get uninstalled
- Reversible "soft" actions (slow mode) are tolerable when explicitly enabled
- Following the Cloudflare "Under Attack Mode" pattern — opt-in, reversible, non-destructive
- The "Reliable UX" judging criterion punishes tools that create regret
- Trust escalates over time: mods who see Sentinel work correctly may enable more automation later

---

## Q10 · Memory storage strategy

**Question:** Where and how much history does Memory keep?

**Options considered:**
- Cache-only (last 24h)
- Sliding window per user, Devvit native KV
- Full history forever, Devvit storage
- External database
- Hybrid hot/cold

**Decision:** Sliding window per user. Devvit Redis. Bounded retention.

**Defaults:**
- Last 100 comments per user (~50KB per user)
- 90-day retention for inactive users
- Permanent retention for users with mod actions on record

**Why:**
- External DBs break the "install and works" promise (creds, cost, ongoing maintenance)
- Full history forever doesn't scale past ~1 year of active sub
- Cache-only misses dormant evaders
- Devvit native storage is what Reddit's developer relations team rewards — "well-behaved citizen" of the platform

---

## Q11 · Multi-mod conflict handling

**Question:** What happens when mods disagree about a Sentinel-triggered action?

**Options considered:**
- No conflict handling
- Audit log + first-mod-wins + one-click revert
- Mandatory maker-checker
- Confidence-based auto-approval

**Decision:** Audit log + first-mod-wins + one-click revert. Maker-checker is **NOT** added even as opt-in.

**Why:**
- Brigades don't wait for second-mod approval — by the time approval comes, damage is done
- Mods are unpaid volunteers, not bank employees — they didn't sign up for governance overhead
- Audit log + revert provides transparency and reversibility without adding workflow friction
- This is reusable infrastructure across all three engines — same code, same UI, same revert button

**24-hour revert window** for any Sentinel-triggered action.

---

## Q12 · Onboarding flow

**Question:** What happens when Sentinel is first installed?

**Options considered:**
- Cold-start, mods wait 7 days
- Working from minute one, accuracy improves over 7 days
- Pre-tuned sub archetype templates
- No onboarding, just on

**Decision:** Working from minute one. History bootstrap on install. Transparent "still learning" banner for first 7 days.

**Behavior on install:**
1. Welcome screen with tiered settings selection
2. Background: fetch last 14 days of activity, compute initial baselines
3. "Sentinel is live" confirmation with link to dashboard
4. Banner stays for 7 days: "Detection active, accuracy improving"

**Why:**
- "Come back in 7 days" gets uninstalled in 7 seconds
- History bootstrap means most subs skip cold-start entirely
- Honest "still learning" banner builds trust — mods respect transparency
- Pre-tuned archetypes rejected — who maintains 10+ templates? Creates support burden

---

## Q13 · Demo video structure

**Decision:** 60-second scripted demo. Raid Radar opens, Memory and Health Score appear as supporting context. See `09-demo-video-script.md` for shot list.

---

## Q14 · False positive feedback loop

**Question:** What happens when a mod marks an alert as a false positive?

**Decision:** One-click "false positive" button on every alert. Dismissals nudge that signal's threshold higher (less sensitive) for THAT sub only. After ~10 dismissals on the same signal type, dashboard suggests raising the sensitivity preset.

**Why:**
- Smartest version of "learn from mods" without crossing into ML territory
- Pure threshold adjustment — fully explainable, mod-controlled
- Per-sub calibration prevents one sub's quirks from affecting others
- Mods see a "calibration health" stat: "False positive rate this month: 3.2%"

---

## Q15 · App listing strategy

**Decision:** Lead with brigade screenshot. Target audience = mods of subs with 10K–500K members. See `10-app-listing.md` for full copy.

---

## Cross-cutting principles

These emerged repeatedly through the conversation. Reference them when making implementation decisions:

### Production-ready over impressive-looking
Every choice trades raw capability for reliability. Statistical detection over ML, opt-in over auto, dashboard + modmail over fancy webhooks. Polish and Reliable UX are equally weighted with Ecosystem Impact in scoring — finished beats clever.

### Shared infrastructure makes Sentinel coherent
Every engine uses the same baseline-tracking, the same audit log, the same alert dispatcher, the same revert mechanism. Without this sharing, Sentinel is three random apps with the same logo. With it, Sentinel is a platform.

### Reversible by default, irreversible never
No bans, no removals, no destructive actions. Slow mode and filters only. Audit log for everything. Undo button always visible. The first time Sentinel does something a mod can't undo, it gets uninstalled.

### Honest > impressive
Transparent "still learning" banner. Visible false-positive rate. Clear "why this fired" reasoning on every alert. Mods trust tools that admit limitations more than tools that pretend perfection.

### "Don't over-engineer" (user explicit guidance, Q11)
Skip maker-checker. Skip pre-trained archetypes. Skip webhook integrations. Skip ML. Skip survival analysis. The spec deliberately leaves these out — adding them is feature creep, not improvement.
