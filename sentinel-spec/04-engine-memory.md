# 04 · Memory Engine

> Profiles every user behaviorally and stylometrically. Catches ban evaders. Surfaces precedent.

---

## What it detects

Memory's primary job is **ban evader detection** — identifying when a "new" account is actually a previously-banned user wearing a fresh face.

Secondary capabilities:
- Surface relevant past mod actions when a user appears in a queue
- Show cross-sub behavioral patterns (which other subs they're active in, how that's changed)
- Flag users whose behavior pattern suddenly shifts (compromised account, stylebot, etc.)

Memory is the engine that transforms Sentinel from "real-time alerts" to "an actual platform with memory."

---

## What Memory does NOT do

- ❌ Auto-ban anyone, ever
- ❌ Make claims of certainty — always shows confidence ranges and reasoning
- ❌ Act on its own — only surfaces context for mods to act on
- ❌ Rely on text content for moderation decisions (it analyzes style, not opinions)

---

## The two detection signals (combined)

Memory uses **behavior + stylometry combined**, weighted. Either alone is too noisy. Combined, they're robust.

### Signal A: Behavioral fingerprint

For each user, Memory builds a behavioral profile:

```typescript
type BehavioralProfile = {
  postingTimeHistogram: number[24];    // hours of day, 24 buckets
  commentLengthDist: Histogram;        // bucketed lengths
  postingFrequency: RollingStat;       // gaps between comments
  subOverlap: Map<string, number>;     // other subs the user frequents
  weekdayVsWeekend: { weekday: number; weekend: number };
};
```

To compare two profiles (a new account vs a banned account):

```typescript
function behavioralSimilarity(a: BehavioralProfile, b: BehavioralProfile): number {
  const timeOverlap = histogramOverlap(a.postingTimeHistogram, b.postingTimeHistogram);
  const lengthOverlap = histogramOverlap(a.commentLengthDist, b.commentLengthDist);
  const subOverlap = jaccard(a.subOverlap.keys(), b.subOverlap.keys());
  const freqDelta = Math.abs(a.postingFrequency.mean - b.postingFrequency.mean) / max(a.postingFrequency.mean, b.postingFrequency.mean);

  return (
    timeOverlap * 0.30 +
    lengthOverlap * 0.20 +
    subOverlap * 0.35 +
    (1 - freqDelta) * 0.15
  );
}
```

Output: 0–1 similarity score. Above 0.75 = behavioral match warranting investigation.

### Signal B: Stylometry fingerprint

Stylometry analyzes HOW someone writes, ignoring WHAT they write:

```typescript
type StylometryProfile = {
  avgSentenceLength: number;
  sentenceLengthStddev: number;
  punctuationProfile: {
    period: number;                    // periods per 1000 chars
    comma: number;
    exclamation: number;
    question: number;
    ellipsis: number;
    semicolon: number;
  };
  capitalization: {
    allCaps: number;                   // ratio of ALL CAPS words
    sentenceStartLowercase: number;    // ratio of sentences starting lowercase
  };
  emojiUsage: Map<string, number>;     // top 10 emojis by frequency
  topNgrams: Map<string, number>;      // top 50 character trigrams
  vocabularyDiversity: number;         // type-token ratio
  contractions: number;                // "dont" vs "do not" ratio
  filler: number;                      // "um", "like", "tbh", "ngl" frequency
};
```

To compare two profiles:

```typescript
function stylometrySimilarity(a: StylometryProfile, b: StylometryProfile): number {
  // Cosine similarity on numeric features
  const numericVecA = [
    a.avgSentenceLength, a.punctuationProfile.period, a.punctuationProfile.comma,
    a.punctuationProfile.exclamation, a.capitalization.allCaps,
    a.vocabularyDiversity, a.contractions, a.filler
  ];
  const numericVecB = /* same fields from b */;
  const numericSim = cosineSimilarity(numericVecA, numericVecB);

  // Jaccard on top n-grams (the strongest signal)
  const ngramSim = jaccard(a.topNgrams.keys(), b.topNgrams.keys());

  // Emoji preference overlap
  const emojiSim = histogramOverlap(a.emojiUsage, b.emojiUsage);

  return numericSim * 0.30 + ngramSim * 0.55 + emojiSim * 0.15;
}
```

Output: 0–1 similarity score. Above 0.85 = stylometric match warranting investigation.

**Why ngrams dominate (55%):** Character trigrams capture idiolect — the unconscious patterns of how someone types. They're remarkably stable across topics and resistant to deliberate disguise. Best stylometry signal in the academic literature.

---

## Combined match logic

```typescript
function isLikelyEvader(suspect: UserFingerprint, banned: UserFingerprint): {
  match: boolean;
  confidence: number;
  reasons: string[];
} {
  // Bare minimum: suspect account must be plausibly an evader
  const ageMonths = (Date.now() - suspect.accountCreatedAt) / (30 * 86400 * 1000);
  if (ageMonths > 12) return { match: false, confidence: 0, reasons: [] };  // old account, unlikely evader
  if (suspect.recentComments.length < 10) {
    return { match: false, confidence: 0, reasons: ['insufficient sample'] };
  }

  const behSim = behavioralSimilarity(suspect.behavioral, banned.behavioral);
  const styleSim = stylometrySimilarity(suspect.stylometry, banned.stylometry);

  // Combined score: both must contribute
  const combined = (behSim * 0.4 + styleSim * 0.6);

  // Require BOTH signals above threshold (prevent single-signal false positives)
  const match = behSim > 0.65 && styleSim > 0.75 && combined > 0.78;

  const reasons: string[] = [];
  if (behSim > 0.85) reasons.push(`Behavioral match ${(behSim*100).toFixed(0)}%`);
  if (styleSim > 0.90) reasons.push(`Style match ${(styleSim*100).toFixed(0)}%`);
  if (suspect.behavioral.subOverlap && jaccard(suspect.behavioral.subOverlap.keys(), banned.behavioral.subOverlap.keys()) > 0.7) {
    reasons.push('Same subreddit footprint');
  }

  return { match, confidence: combined, reasons };
}
```

**Three guards against false positives:**
1. Suspect account must be <12 months old (older accounts are real people)
2. Must have ≥10 comment samples (enough text for stable fingerprint)
3. BOTH behavior AND stylometry must independently exceed thresholds (combined score alone insufficient)

---

## When Memory runs

- **On every CommentSubmit** in the sub: update the user's fingerprint, refine stylometry profile (cheap)
- **When a new user comments for the first time**: scan against banned-user index (bounded N, see below)
- **When a mod opens a user's profile in the dashboard**: pull fingerprint, run on-demand comparison if mod requests
- **Every 6 hours**: scan recently-active new accounts against banned index (catches evaders who slipped through real-time)

---

## Banned-user index

Memory keeps a fast index of banned-user fingerprints for comparison.

```
sentinel:memory:banned_index → Map<userId, UserFingerprint summary>
```

When a `ModAction` event with action=`banuser` fires:
- The full fingerprint is preserved (overrides 90-day aging policy)
- Added to the banned index
- Tagged with the ban reason and timestamp

When checking a new account, only compare against banned users from THIS sub (cross-sub data isn't available via Devvit).

---

## What Memory shows the mod

When a mod clicks on a user from anywhere in Sentinel, they see the **User Spotlight panel**:

```
┌─────────────────────────────────────────┐
│ 👤 u/totally_new_user_99                 │
│ Account age: 3 days · 47 comments        │
│ Risk score: 94 (HIGH)                    │
├─────────────────────────────────────────┤
│ ⚠️ POSSIBLE BAN EVADER                   │
│                                          │
│ Strong match to u/banned_2024_03         │
│ (banned 2024-03-15 for harassment)       │
│                                          │
│ ✓ Behavioral match: 87%                  │
│   • Same posting hours (UTC 19-22)       │
│   • Same comment length distribution     │
│   • 71% sub overlap                      │
│                                          │
│ ✓ Stylometry match: 94%                  │
│   • Identical punctuation profile        │
│   • Same trigram fingerprint             │
│   • Same emoji preferences (😤,💀,🤡)    │
│                                          │
│ Combined confidence: 91%                 │
├─────────────────────────────────────────┤
│ Other context:                           │
│ • 12 reports filed against this user     │
│ • Active in 4 of u/banned_2024_03's      │
│   former subreddits                      │
├─────────────────────────────────────────┤
│ [View side-by-side] [Ban] [Dismiss]      │
└─────────────────────────────────────────┘
```

**Critical UX rule:** Memory NEVER says "this IS the banned user." Always "possible match," "strong match," "X% confidence." It surfaces evidence; the mod decides.

---

## Side-by-side view

When the mod clicks "View side-by-side":

```
┌──────────────────────┬──────────────────────┐
│ u/banned_2024_03     │ u/totally_new_user_99│
│ (banned 14 mo ago)   │ (3 days old)         │
├──────────────────────┼──────────────────────┤
│ Posting hours:       │ Posting hours:       │
│ 19-22 UTC peak       │ 19-22 UTC peak       │
│                      │                      │
│ Avg comment length:  │ Avg comment length:  │
│ 47 chars             │ 51 chars             │
│                      │                      │
│ Top emojis:          │ Top emojis:          │
│ 😤 💀 🤡 😅 🙄        │ 😤 💀 🤡 😅 🤡        │
│                      │                      │
│ Sample comment:      │ Sample comment:      │
│ "tbh idk why ppl     │ "tbh idk why this    │
│ even bother lol"     │ keeps happening lol" │
└──────────────────────┴──────────────────────┘
```

Both rendered from real data on demand. This is the "smoking gun" view that makes the demo land.

---

## Calibration & false positive feedback

Same loop as Raid Radar:
- "Dismiss / not an evader" button on every Memory alert
- 3 dismissals in 7 days → raise threshold for THIS sub by 10%
- 10 dismissals total → suggest sensitivity drop in dashboard

Memory's calibration is per-sub because writing styles vary heavily by community (gaming sub vs academic sub have different baseline trigram distributions).

---

## Performance budget

- New-user fingerprint scan against banned index: <500ms (banned index typically <100 users per sub)
- Single fingerprint comparison: <50ms
- Stylometry fingerprint refinement on new comment: <20ms

---

## Edge cases

- **User comments only with images / very short comments**: skip stylometry entirely, rely on behavior signals only. Show "Insufficient text for stylometry" in the panel.
- **Two real different users with similar styles**: this WILL happen. The combined-signal-required rule + 0.78 threshold + 12-month age cutoff makes this rare. Mod can dismiss → Memory learns. ✅
- **Banned user comes back 5 years later**: yes, Memory will still catch them. The fingerprint is stored permanently for banned users (not aged out). ✅
- **Banned user changes everything intentionally** (timing, vocabulary, even emoji): trigrams are very hard to fake — they're unconscious. Memory may not catch a deliberate sophisticated evader. That's an honest limitation. ✅
- **Mod-of-mod-team identifies themselves wrongly**: Memory has an exempt-users list in advanced settings. Add mods, AutoModerator, etc. ✅

---

## Demo scenario for Memory

In your test sub, set this up before recording:

1. Create alt account `u/banned_demo_user`. Have it comment 30 times over 2-3 days with a recognizable style (use lots of "tbh," "ngl," double exclamation marks, specific emojis).
2. Have the demo mod ban that account.
3. Wait 24 hours.
4. Create alt `u/new_innocent_user`. Comment 10–15 times in the same style.
5. In the demo, click on `u/new_innocent_user` from the dashboard → User Spotlight loads showing the match → click "View side-by-side" → the smoking gun.

Total demo time: ~10 seconds. Cinematic.
