# Sentinel Design System

> Reddit moderation intelligence — a restrained, dark‑mode production tool that lives inside a single pinned Devvit custom post.

---

## What is Sentinel?

Sentinel is a moderation intelligence dashboard built on **Devvit** (Reddit's developer platform). It runs as a **single pinned custom post** at the top of a subreddit and gives mod teams three coordinated detection engines:

| Engine | Job |
|---|---|
| **Raid Radar** | Detect coordinated user clusters arriving in spikes — brigades, ban‑evasion rings, bot networks. |
| **Memory** | Long‑term recall of users, modmail threads, removals, prior offenses. Side‑by‑side comparison of "now" vs "then". |
| **Health Score** | Subreddit‑level vital signs — report volume, removal rate, unanswered modmail, active mod ratio. |

All three feed a unified **alert queue** with a single **severity ladder** (Critical → High → Medium → Healthy) and a write‑once **audit log**.

### Surface constraints

Sentinel renders inside Devvit Blocks, which constrains the design more than a normal web app:

- **≤ 1,500 nodes per render** — every wrapper, badge, and divider counts. Prefer text + a single chip over decorative compositions.
- **No native modals or popovers** — drawers, inline expands, and "full‑post takeover" views replace overlays.
- **Mobile Reddit app is the dominant surface** — touch targets ≥ 44px, single‑column flows, no hover‑only affordances.
- **Dark mode first** — Reddit's mod tools are used overwhelmingly in dark mode; light mode is a fallback, not a co‑equal.

These constraints are the design system's *spine* — every component below is scored against them.

---

## Sources

This design system was authored from a written brand brief — **no codebase, Figma file, or screenshot reference was attached**. The visual direction is therefore an interpretation of the brief plus the documented constraints of Devvit Blocks and Reddit's mod‑tooling conventions.

If you have any of the following, drop them in and I'll re‑ground everything against them:

- Devvit app repo (TypeScript / `devvit.yaml`)
- Figma file or frames
- Existing logo / wordmark
- Reference screenshots of the running app
- Copy decks, alert templates, or modmail samples

---

## Index — what's in this folder

```
README.md                  ← you are here
SKILL.md                   Agent‑Skills entrypoint for downstream Claude Code use
colors_and_type.css        Token system — colors, type, spacing, radius, shadows
fonts/                     IBM Plex Sans + JetBrains Mono (Google Fonts substitution — flagged)
assets/                    Logo lockups, severity glyphs
preview/                   Design System tab cards (colors, type, components, etc.)
ui_kits/
  sentinel-dashboard/      The pinned custom post — Devvit Blocks recreation
    index.html             Interactive click‑through
    *.jsx                  Modular components (TabBar, AlertCard, KpiTile, etc.)
    README.md              Notes on the kit
```

---

## CONTENT FUNDAMENTALS

Sentinel is a tool for **mods**, not a consumer product. The voice is the voice of a senior coworker handing you a clipboard.

### Tone

- **Direct, factual, no marketing gloss.** "3 accounts joined in 90s" — not "We've detected suspicious activity!"
- **Numbers lead.** A headline is a count, a duration, a percentage. Prose supports the number.
- **Second person, sparingly.** "You" appears in actions ("Review queue"), almost never in body copy.
- **Never apologize, never hype.** No "Oops!", no "🎉", no "Awesome".
- **The product narrates, the mod decides.** Sentinel surfaces; mods act. Copy never tells a mod what to think — it lays out the evidence.

### Casing

- **Sentence case everywhere** — labels, buttons, headers, alerts. ("Review cluster", not "Review Cluster".)
- **ALL CAPS reserved for severity badges and tab labels** — `CRITICAL`, `RAID RADAR`. Capitalization is a *signal*, used sparingly.
- **Code‑style identifiers in mono** — usernames as `u/throwaway_4471`, subreddits as `r/example`. Always with prefix, always mono.

### Lexicon

| Use | Don't use |
|---|---|
| Alert | Notification, ping |
| Cluster | Group, swarm |
| Removed | Deleted, taken down |
| Mod | Moderator (too formal), admin (wrong) |
| Subreddit | Sub (too casual for UI), community (Reddit's marketing term) |
| Action | Decision, response |

### Specific examples (from real spec)

> **Alert headline (Raid Radar)** — title then evidence then confidence
> **Coordinated brigade detected**
> 38 new accounts from r/external hit "[thread]" in 90 seconds. Confidence 89%.
> Signal pills: ✓ velocity · ✓ age cluster · ✓ overlap · ✓ sync

> **Alert headline (Memory)** — the ⚠ emoji is *load-bearing* here
> **⚠ POSSIBLE BAN EVADER**
> Strong match to u/[banned_user] (banned [date] for [reason])
> Behavioral 87% · Stylometry 94% · Combined 91%

> **Alert headline (Health Score)** — number-first, with a forecast
> **78 (High) · ↑ Rising**
> Without intervention, projected to hit 95% in 90 minutes. With slow mode, predicted peak: 51%.

> **Empty state — threats**
> ✅ No active threats. All engines are monitoring.

> **Empty state — users**
> No high-risk users detected right now.

> **Empty state — activity log**
> No actions recorded yet. Actions taken by Sentinel or mods will appear here.

> **Calibration banner (first 7 days)**
> ℹ Sentinel is calibrating to your sub. Detection is active, accuracy improves over the next 6 days. Current accuracy estimate: 62% (improving).

> **Demo-mode banner (judging/demo honesty)**
> Demo mode — calibrated test sub. Pre-staged scenarios active. See Devpost for details.

> **Audit log entry — Sentinel auto-action**
> 13:47 · Sentinel · auto-filtered new accounts on "[thread]" · Triggered by: Health Score (risk 92) · [Undo] [See alert]

> **Audit log entry — mod action**
> 14:23 · u/ModName · enabled slow mode on "[thread title truncated]" · Triggered by: Raid Radar (89% confidence) · [Undo] [See alert]

> **Transactional modmail (bootstrap)** — only place 🛡 appears
> Subject: 🛡 Sentinel is now active on r/[subname]
> Hi mods, Sentinel is now active. Detection runs immediately; accuracy improves over the next 7 days as your baseline warms up. Your dashboard is now pinned at the top of the sub: [URL].

### Emoji — functional only, never decorative

A small, locked vocabulary of semantic glyphs. Each one means **exactly one thing** and appears only where listed below. No others, ever — no 🎉, no 🚨, no 🔥, no 👀.

| Glyph | Meaning | Where it appears |
|---|---|---|
| `🛡` | The Sentinel brand mark | Only in transactional modmail subject lines |
| `⚠` | "Look at this" — used on Memory ban-evader headlines | Memory alert title, *only* |
| `✅` | "All clear" — paired with a no-results state | Empty states with positive sentiment (e.g. Threats tab) |
| `ℹ` | "Informational, no action required" | System banners (calibration, demo mode) |
| `✓` | Signal-confirmed checkmark | Signal pills inside an alert card |
| `↑ ↓` | Direction of a metric | Health Score risk trend, KPI deltas |

Audit-log free-text mod notes pass through verbatim and may contain anything the mod typed.

**Severity color carries urgency, not the copy itself** — never punctuate a CRITICAL alert with 🚨, never add 🔥 to "Rising". The badge and the rail do that work.

---

## VISUAL FOUNDATIONS

### Palette

Dark canvas, near‑black panels, single accent for interactive state. **Severity colors are reserved** — they only appear on severity surfaces (badges, dots, gauge fills, alert‑card left rule). They never become decorative.

- **Canvas** `#0b0d0f` — the page
- **Panel** `#14171a` — cards, alert rows
- **Raised** `#1b1f23` — hover state, active tab
- **Border** `#2b3138` — 1px hairlines, the default divider
- **Text** `#e6e9ed` / `#aab2bd` / `#6e7681` — primary / secondary / tertiary
- **Severity** `#e74c3c` Critical · `#f39c12` High · `#f5b041` Medium · `#46a973` Healthy
- **Accent** `#5b8def` — a single muted blue, only on focus rings and primary buttons. Never on text.

### Type

- **Display + UI:** **IBM Plex Sans** (400 / 500 / 600). Engineered, neutral, slightly humanist — the right note for a tool that reports facts.
- **Mono:** **JetBrains Mono** (400 / 500). For usernames, subreddit names, IDs, timestamps, cluster hashes.
- No serif. No display face. The system has 2 families and that is the total.
- Number tabular variants on (`font-variant-numeric: tabular-nums`) everywhere a number appears in a column.

### Spacing

A 4px base grid. Tokens are exposed as `--space-1` (4) through `--space-8` (32). The system is **tight** — alert rows are 56–64px tall on mobile, not 80. Density is a feature; mods have hundreds of rows to triage.

### Backgrounds & imagery

- **No gradients on surfaces.** Severity gauges use a single solid arc; alert cards are flat.
- **No imagery, illustrations, or stock photography.** This is a tool. The only "imagery" is Reddit avatars and the severity glyph in the logo lockup.
- **No full‑bleed photos**, no patterns, no textures.
- The closest thing to decoration is the **cluster graph** — a node/link diagram of related accounts. It's data, not garnish.

### Animation

- **Fades and crossfades only.** 120ms ease‑out for entering, 80ms ease‑in for leaving.
- **No bounces, no springs, no parallax.** A production tool should never feel "playful" when surfacing an in‑progress raid.
- **Severity escalation pulses once.** When an alert ticks from High → Critical, the left rule pulses twice (1.2s total) then settles. Movement = state change, never decoration.
- **`prefers-reduced-motion` disables everything** except the severity pulse, which becomes a 250ms color flash with no motion.

### Hover / press

- **Hover** = background steps from `--bg-panel` → `--bg-raised` (1 step lighter). No transform, no shadow change.
- **Press** = background steps one more (`--bg-raised-2`), and the element drops 1px via `translateY(1px)`. Tiny, but it confirms touch.
- **Focus** = 2px solid `--accent` outline at 2px offset. Never removed; never restyled to a glow.

### Borders, radii, shadows

- **Radius** is small and consistent. `--radius-sm: 6px` (chips, inputs), `--radius-md: 10px` (cards, panels), `--radius-lg: 14px` (the outermost custom‑post wrapper). Nothing is round except severity dots and avatars.
- **Borders are hairlines** — `1px solid var(--border)`. Always 1px. Always the same color. No double‑borders, no contrasting accents.
- **Shadows are nearly invisible.** A single token, `--shadow-1: 0 1px 0 rgba(0,0,0,0.4)` — used for the active tab indicator only. Drop shadows are forbidden on cards (they'd waste node budget and feel un‑Reddit).

### Transparency & blur

- **No blur effects.** Devvit Blocks doesn't support `backdrop-filter`, and even in the HTML recreation we don't fake it. Layering is by background color, not by translucency.
- **`rgba()` is used only for severity tints** — e.g. an alert row's left wash is `rgba(231, 76, 60, 0.08)` for Critical. The 4 tints are documented as `--bg-tint-critical` etc.

### Capsules vs. cards

- **Severity badges are capsules** (`border-radius: 999px`) — they're tags, not containers.
- **Everything else is a card** with a small radius (6–14px) and a 1px border. The visual hierarchy is: capsule (inline tag) → chip (selectable filter) → card (content) → panel (group of cards). All four use the same border and the same backgrounds, just at different radii.

### Layout rules

- **Single column on mobile** (≤ 720px effective width inside the post). Tab bar pins to top of the post; the rest scrolls within Reddit's scroller.
- **Tab bar is sticky inside the post**, not the page — Devvit doesn't expose page‑level fixed positioning.
- **Max 7 rows visible before requiring "View all"** — the post can't grow unbounded inside the Reddit feed.
- **One primary action per surface.** "Review", "Archive", or "Action" — never all three at the same hierarchy.

### Density target

- Alert row: **64px** tall (mobile), 56px (desktop).
- KPI tile: **88px** tall, single number + label + delta.
- Tab bar: **44px** tall — Apple HIG minimum touch target.

---

## ICONOGRAPHY

Sentinel uses **Lucide** (https://lucide.dev) for all glyphs.

### Why Lucide

- 1.5px stroke weight matches IBM Plex Sans's visual weight at 14–16px.
- It's CDN‑available and ships as inline SVG, so we don't blow the Devvit node budget on a separate icon font.
- It's actively maintained and stable enough to pin a version.

> **⚠ Substitution flag:** The brief did not specify an icon system. Lucide is my pick for production‑dashboard tooling at this stroke weight. If you have an internal set (or want Phosphor / Heroicons instead), drop it in and I'll swap. See `assets/icons/README.md`.

### Usage rules

- **One stroke weight.** 1.5px. Never mix weights, never use filled Lucide variants.
- **Size from a 4‑step scale:** `14, 16, 20, 24px`. 16px is the default.
- **Color follows text color** (`currentColor`). Severity icons inherit from the severity badge they sit inside.
- **No icon‑only buttons without a tooltip.** Devvit can't render hover tooltips on mobile, so icon‑only buttons must have an adjacent text label or be replaced with a labeled chip.
- **Icons never replace numbers.** "12 accounts" is the headline; the cluster icon is a supporting glyph next to it, not a stand‑in.

### Sentinel‑specific glyph mapping

| Concept | Lucide icon |
|---|---|
| Raid Radar | `radar` |
| Memory | `history` |
| Health Score | `activity` |
| Cluster | `git-fork` |
| Alert (Critical) | `alert-octagon` |
| Alert (High) | `alert-triangle` |
| Alert (Medium) | `alert-circle` |
| Healthy | `check-circle-2` |
| User | `user` |
| Audit log | `scroll-text` |
| Archive | `archive` |
| Modmail | `inbox` |

### Emoji & unicode

- **No emoji in UI chrome.** (Audit log free‑text mod notes are the only place emoji may appear; they pass through as the mod typed them.)
- **No unicode glyphs as icons** — no `⚠`, no `✓`, no `▶`. Use Lucide.

### Logos & brand marks

A primary lockup (`assets/logo.svg`) and a square mark (`assets/mark.svg`) are included. Both are wordmark + a simplified radar sweep — built to read at 16px in a Reddit thread title row.

---

## Quick start for downstream agents

1. **Pull tokens** — link `colors_and_type.css` and use the CSS custom properties. Don't hard‑code hex values.
2. **Match density** — if a row feels comfortable on desktop, it's probably too tall for mobile. Test at 360px wide.
3. **Score against Devvit Blocks** — would this work without `position: fixed`, without `backdrop-filter`, with ≤ 1500 nodes? If no, simplify.
4. **Reserve severity colors** — Critical/High/Medium/Healthy mean *exactly one thing* and never mean "important" in a generic sense.
5. **No emoji, no gradients, no shadows on cards.** These three rules cover ~80% of the visual restraint.
