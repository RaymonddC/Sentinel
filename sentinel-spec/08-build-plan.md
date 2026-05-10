# 08 · Build Plan

> Suggested build order and milestones. Designed for incremental delivery — each milestone produces something demoable, so you're never stuck with "almost done."

---

## Philosophy: build the spine first

The shared infrastructure (event ingestion, behavioral graph, alert dispatcher, audit log) is the spine. Engines plug into the spine. Build the spine FIRST, even if it feels like nothing is "happening" — every engine becomes 3x faster to build once the spine exists.

Don't be tempted to build Raid Radar end-to-end first as a vertical slice. You'll regret it when Memory and Health Score require ripping it apart for shared infra.

---

## Milestone 1 — Foundation (1–3 days)

**Goal:** Sentinel installs, ingests events, builds baselines. Nothing detects yet.

**Build:**
- [ ] Devvit project skeleton, `devvit.yaml`, package config
- [ ] KV schema for `SubBaseline`, `UserFingerprint`, `ThreadState`, `Alert`
- [ ] Statistical primitives: `RollingStat`, `TimeSeries`, `Histogram`
- [ ] Event ingestion module — handlers for `CommentSubmit`, `PostSubmit`, `ModAction`, `Report`
- [ ] Bootstrap job — scan last 14 days on install
- [ ] Settings storage with default values
- [ ] Welcome modal (basic version)

**Demoable:** Install Sentinel, see "Setup complete" message. Verify via debug logging that events are being ingested. No UI yet.

---

## Milestone 2 — Dashboard skeleton (1–2 days)

**Goal:** The pinned dashboard post exists. Tabs work. Real data shows in KPI tiles. No alerts yet.

**Build:**
- [ ] Custom post creation on bootstrap completion
- [ ] Dashboard layout with tabs: Threats / Users / Threads / Activity Log / Settings
- [ ] KPI row pulling live data from KV
- [ ] Settings tab with tiered UI (simple + collapsible advanced)
- [ ] Empty states for each tab ("No threats yet" etc.)

**Demoable:** Open dashboard, see real KPIs (Users Profiled = N, Threads Watched = M). Settings tab works. Other tabs show empty states.

---

## Milestone 3 — Alert dispatcher and audit log (1 day)

**Goal:** Infrastructure for any engine to fire an alert and record actions.

**Build:**
- [ ] `dispatchAlert()` function — writes alert, updates dashboard, sends modmail if critical
- [ ] Audit log structure with reverse capability
- [ ] `performModAction()` and `revertModAction()` wrappers
- [ ] Activity Log tab pulling from audit log

**Demoable:** Manually inject a test alert via debug command. See it appear in dashboard. Click "false positive" — see it dismissed and logged.

---

## Milestone 4 — Raid Radar (3–5 days)

**Goal:** Brigade detection works end-to-end.

**Build:**
- [ ] Four signal computations (influx z-score, account-age cluster, sub overlap, sync timing)
- [ ] Confidence calculation
- [ ] Evaluation trigger on every comment (debounced)
- [ ] Alert generation when threshold exceeded
- [ ] Dashboard panel: cluster visualization, signal breakdown, action buttons
- [ ] Auto-action handler (slow mode, filter new accts) — gated on opt-in
- [ ] False positive feedback loop
- [ ] Per-sub threshold calibration

**Demoable:** Run the "hero brigade" test scenario in your demo sub. See alert fire within 90 seconds. See cluster graph populate. Click "Slow mode" — verify it actually applies to the thread.

This is the biggest single milestone. **Most of the demo video footage is captured here.**

---

## Milestone 5 — Health Score (3–5 days)

**Goal:** Thread risk prediction works for all watched threads.

**Build:**
- [ ] Four signal computations (velocity, sentiment, new-account ratio, report rate)
- [ ] Sentiment lexicon (AFINN-style word list)
- [ ] Risk score calculation with trajectory amplifier
- [ ] Forecast generation (1h, 2h, with-mitigation)
- [ ] Dashboard panel: triage queue, gauge, signal bars, forecast box
- [ ] Watched-threads management (auto-add active threads, max 50)
- [ ] Calibration health stats

**Demoable:** Run the "escalating thread" test scenario. Watch risk climb 22% → 89%. See triage queue update in real-time. See forecast change after enabling slow mode.

---

## Milestone 6 — Memory engine (4–6 days)

**Goal:** Ban evader detection works.

**Build:**
- [ ] Behavioral fingerprint computation
- [ ] Stylometry fingerprint computation (n-grams are the heaviest piece)
- [ ] Combined similarity scoring with the dual-signal guard
- [ ] Banned-user index maintenance (on `ModAction.banuser`)
- [ ] New-user scan against banned index
- [ ] Periodic re-scan job (every 6 hours)
- [ ] User Spotlight panel
- [ ] Side-by-side comparison view
- [ ] Mod menu items: "Open in Sentinel" on user, comment

**Demoable:** Run the "ban evader" test scenario (banned alt → fresh alt with same style). See Memory flag the new alt within an hour. Open the side-by-side view. Smoking gun.

---

## Milestone 7 — Polish + edge cases (2–3 days)

**Goal:** Production-ready feel. Everything works under stress.

**Build:**
- [ ] All edge cases from each engine spec verified
- [ ] Performance budget tests (eval times, memory usage)
- [ ] All four Raid Radar test scenarios pass correctly
- [ ] Settings save/load roundtrips correctly
- [ ] Auto-action opt-in respected
- [ ] Quiet hours respected
- [ ] Exempt users / flairs respected
- [ ] Error handling on Devvit API failures (retries, graceful degradation)
- [ ] All UI interactions work on mobile viewport
- [ ] Calibration banner shows correctly during first 7 days
- [ ] Visual polish pass — colors, spacing, animations match the mockup

---

## Milestone 8 — Demo prep (1–2 days)

**Goal:** Hackathon submission ready.

**Build:**
- [ ] Test sub set up (`r/SentinelDemo` or similar)
- [ ] All test scenarios scripted and runnable on demand
- [ ] Demo video recorded per `09-demo-video-script.md`
- [ ] App listing copy written per `10-app-listing.md`
- [ ] Screenshots taken for app listing
- [ ] Public demo post in <200-member sub
- [ ] Submission text (Tool Overview, Project Impact)
- [ ] Devpost submission filled in

---

## Total time estimate

- Milestone 1: 1–3 days
- Milestone 2: 1–2 days
- Milestone 3: 1 day
- Milestone 4: 3–5 days
- Milestone 5: 3–5 days
- Milestone 6: 4–6 days
- Milestone 7: 2–3 days
- Milestone 8: 1–2 days

**Total: 16–27 working days.**

The hackathon deadline is May 27, 2026. Today is May 10. That's 17 calendar days. Working ~6 hrs/day = ~102 hours of build time = enough for the optimistic estimate but tight on the pessimistic one.

**If schedule slips, cut in this order:**
1. Skip milestone 8 video polish (record one rough take, ship it)
2. Skip Memory's stylometry (use behavior-only Memory)
3. Skip auto-actions (manual-only Sentinel still ships)
4. Skip the side-by-side Memory view (just show the match panel)

Don't cut Raid Radar, dashboard, or Health Score. These are the platform's core.

---

## Per-milestone definition of done

For each milestone, you can call it done when:
- The "Demoable" line at the bottom passes
- All checkboxes for the milestone are checked
- A 30-second screen recording demonstrates the milestone working
- Code is committed with milestone tag

Don't move to the next milestone with a previous one half-done. Half-done milestones are how 3-week projects become 3-month projects.

---

## Risk register (things most likely to go wrong)

### "Devvit doesn't expose the data I need"

Risk for: account creation date, sub overlap, referrer info.

Mitigation: do a 1-day spike at the start of Milestone 1 specifically to verify what Devvit's API gives you. If `accountCreatedAt` isn't accessible, Raid Radar Signal 2 (account-age cluster) needs replacement. If sub overlap requires fetching each user's history individually, it's expensive but doable.

If something in the spec turns out to be impossible on Devvit, document the limitation and adapt — don't try to work around it with hacks.

### "Bootstrap takes forever on big subs"

Risk for: very active subs.

Mitigation: bootstrap is non-blocking. Engines work on new events while bootstrap runs in background. Worst case: a sub with 6 months of history takes a full day to bootstrap. That's fine — Sentinel becomes useful immediately on new events.

### "Storage limits hit"

Risk for: very active subs running for months.

Mitigation: 90-day aging policy already specified. Add a stress test in Milestone 7 — populate a test sub with 10K user fingerprints + 50 threads + 1000 alerts and verify storage remains under quota.

### "Stylometry is too noisy"

Risk for: Memory false positives.

Mitigation: dual-signal guard already specified (both behavioral AND stylometric must exceed thresholds). If false positives still happen, raise stylometry threshold from 0.75 to 0.85 and accept lower recall. Or fall back to behavior-only Memory for v1.

### "Demo sub doesn't have enough activity for realistic baseline"

Risk for: demo sub looks too quiet for the demo to feel real.

Mitigation: pre-populate the demo sub with 2 weeks of scripted alt activity BEFORE recording. Bootstrap will pick this up on install. Demo then shows Sentinel reacting to the brigade scenario against a baseline that looks lived-in.

---

## Things to deliberately NOT optimize

In milestone 7 (polish), resist the urge to:
- Fine-tune signal weights to perfection (waste of time without real-world data)
- Add more signals to engines (each engine has the right number — more = noise)
- Build a "configuration export/import" feature (out of scope)
- Build a "Sentinel statistics for the past month" dashboard (calibration health is enough)
- Add Discord/Slack integration "while you're at it" (explicitly rejected in Q8)

Stick to the spec. The spec was designed by saying no to these things.
