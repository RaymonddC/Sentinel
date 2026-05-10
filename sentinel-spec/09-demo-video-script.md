# 09 · Demo Video Script

> 60-second demo video for Devpost submission. Shot list, voiceover, and timing. The video is the most important deliverable after the working app — judges may not test the app personally, but they all watch the video.

---

## Constraints

- Maximum 60 seconds (judges aren't required to watch beyond 1 min)
- Footage must show Sentinel functioning on Reddit
- Must be uploaded to YouTube/Vimeo/Facebook Video/Youku
- English only
- No copyrighted music — use royalty-free or none

---

## The 3-act structure

```
[0–10s]    Setup     What is this, who is it for
[10–35s]   Act 1     Live brigade detected and mitigated (Raid Radar lead)
[35–50s]   Act 2     Memory + Health Score appear as supporting context
[50–60s]   Close     Three engines, one platform, install CTA
```

---

## Shot list

### [0:00–0:05] Title card

```
Visual: Black screen, Sentinel logo fades in.
Text overlay: "SENTINEL"
Subtitle: "Moderation intelligence for Reddit"
```

Voiceover (or text overlay if no voice):
> "Reddit moderators are unpaid volunteers protecting millions of users."

### [0:05–0:10] Problem framing

```
Visual: Cut to a chaotic Reddit thread — comments scrolling fast, reports piling up.
Text overlay: "When a brigade hits, mods notice 2 hours too late."
```

### [0:10–0:18] Brigade detected (Raid Radar core moment)

```
Visual: Cut to mod's screen. Sentinel dashboard pinned at top of sub.
Suddenly the dashboard pulses red.
Title card: "🚨 Coordinated brigade detected"
```

The dashboard shows:
- 89% confidence
- "38 new accounts from r/external in 90 seconds"
- Cluster graph populates with red dots radiating from external sub to target thread

Voiceover/caption:
> "Sentinel detects coordinated brigades in 90 seconds — not 2 hours."

### [0:18–0:25] Memory tie-in

```
Visual: Mod clicks one of the red dots in the cluster graph.
A side panel slides in: User Spotlight for u/totally_new_user_99.
Shows match to u/banned_2024 with 94% style + 87% behavioral confidence.
```

Voiceover/caption:
> "And recognizes the attackers — including ban evaders."

### [0:25–0:32] Mitigation

```
Visual: Mod clicks "Filter new accounts" + "Slow mode."
Buttons confirm. The thread on screen visibly stops accelerating.
The cluster graph fades from red to amber.
Risk meter on dashboard drops from 89 → 65.
```

Voiceover/caption:
> "One click. Brigade neutralized. Every action reversible."

### [0:32–0:42] Health Score showcase

```
Visual: Cut to a different thread on the dashboard.
Show timelapse of risk score climbing 22% → 31% → 58% → 78%.
Forecast box appears: "Projected to hit 95% in 90 minutes."
```

Voiceover/caption:
> "Health Score predicts which threads will need help — before they explode."

### [0:42–0:50] Mod intervenes early

```
Visual: Mod hits "Slow mode" at 78% (proactively).
Forecast updates: "Predicted peak: 51%, then declining."
Risk gauge starts decreasing.
```

Voiceover/caption:
> "Mods stop reacting. They start preventing."

### [0:50–0:58] Close — three engines, one platform

```
Visual: Wide shot of the full dashboard with three engine sections visible.
Three sub-logos light up in sequence: Raid Radar, Memory, Health Score.
Text overlay: "One platform. Three engines."
```

Voiceover/caption:
> "Sentinel — moderation intelligence for Reddit."

### [0:58–1:00] Install CTA

```
Visual: App listing URL appears
Text: "developers.reddit.com/apps/sentinel"
End card.
```

---

## Production tips

### Recording the brigade scenario

Use the test scenarios from `03-engine-raid-radar.md`:
- Have 8 alts pre-staged with comments ready in another tab
- Record the dashboard before the brigade
- Trigger the brigade (paste comments rapidly across alts)
- Record 90-second window of the alert firing and you mitigating
- Edit down to the 18 seconds that go in the video

### Recording the Memory side-by-side

- Set up the banned alt + new alt scenario per `04-engine-memory.md` BEFORE recording
- The Memory match should already be detected and persisted before you start filming
- Shot is just: click the user → panel appears → cut

### Recording the Health Score timelapse

- 30-min real-time scenario, recorded in one take
- Speed up 10x in editing to fit in 10 seconds of footage
- Optional: synthesize the data via debug commands if real-time recording is too time-consuming

### Voiceover vs text-only

If you have time and a quiet space: record voiceover. Adds production value.

If not: use clear text overlays with consistent typography. Many great demo videos have no voice. Either works.

### Music

Optional. If used:
- Royalty-free, no copyright issues
- Tense / building / serious tone — match the "threat intelligence" framing
- Quiet enough not to drown out voiceover or distract from text overlays

---

## What NOT to include in the video

- ❌ Talking-head shots (no time for them)
- ❌ Lengthy explanations (judges already read the spec)
- ❌ Code or terminal screens
- ❌ Long credits / branding sequences
- ❌ More than 3 transitions per scene
- ❌ Stock footage of "people using laptops"
- ❌ Anything that doesn't directly demonstrate Sentinel working

---

## Backup version

If full 60-second version is too ambitious to produce in time, have a 30-second backup ready:
- Skip the Memory tie-in (8 seconds saved)
- Skip the Health Score showcase (15 seconds saved)
- Just: "Brigade detected → mitigated → here's the platform" in 30 seconds

A clean 30-second video is better than a sloppy 60-second one.

---

## Captions / accessibility

Add SRT captions to the YouTube/Vimeo upload. Many judges watch on mute or in noisy environments. Captions should match voiceover line-for-line (or describe text overlays if no voice).

---

## Submission checklist

Before submitting the video URL to Devpost:
- [ ] Video is publicly viewable (not unlisted, not private)
- [ ] Total length ≤ 60 seconds
- [ ] Captions/subtitles added
- [ ] Title is "Sentinel — Moderation Intelligence for Reddit"
- [ ] Description includes one-paragraph summary + link to app listing
- [ ] Thumbnail is the cluster graph screenshot (most striking visual)
- [ ] Audio levels are normalized (not too quiet, not blown out)
- [ ] Tested on mobile playback (some judges watch on phones)
