---
name: sentinel-design
description: Use this skill to generate well-branded interfaces and assets for Sentinel, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

# Sentinel — design skill

Sentinel is a **Reddit moderation intelligence dashboard built on Devvit**. It lives as a single pinned custom post at the top of a subreddit and surfaces three detection engines — Raid Radar, Memory, Health Score — through a single severity ladder and a write-once audit log.

Read **`README.md`** first — it contains the full content-fundamentals, visual-foundations, and iconography rules. Then browse:

- `colors_and_type.css` — design tokens (link this from any HTML you produce)
- `assets/` — logo (`logo.svg`), square mark (`mark.svg`)
- `ui_kits/sentinel-dashboard/` — the canonical pinned custom post recreated in React + JSX
- `preview/` — small cards demonstrating each token / component cluster

## Usage

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out of this skill and link `colors_and_type.css`. Match the constraints below.

If working on production Devvit code, read `README.md` and use the tokens as the source of truth — never hard-code hex values.

If the user invokes this skill without other guidance, ask what they want to build (a new alert variant? a comparison surface? a marketing one-pager?), then act as an expert designer who outputs HTML artifacts or production code, depending on the need.

## Five rules that cover 80% of the design

1. **Dark-mode first.** Light mode is a fallback.
2. **Severity colors are reserved.** Critical/High/Medium/Healthy mean *exactly one thing* — they never become decorative.
3. **No emoji, no gradients on surfaces, no drop shadows on cards.** This is a production tool.
4. **Devvit Blocks budget.** No `position: fixed` (use sticky), no `backdrop-filter`, no modals (use inline expands/drawers), ≤ 1500 nodes per render.
5. **Mobile Reddit app is the dominant surface.** Touch targets ≥ 44px, no hover-only affordances, single column on narrow widths.

## Voice

- Numbers lead. *"38 new accounts from r/external hit '[thread]' in 90 seconds. Confidence 89%."*
- Headline + evidence + confidence. The badge and the rail carry urgency; the copy never amplifies it.
- Sentence case everywhere. ALL CAPS only for severity badges and tab labels.
- Direct, factual, restrained. The product narrates; the mod decides.

## Emoji policy — small, locked vocabulary

Not "no emoji" — *functional* emoji only. Six glyphs, each with one meaning:

| `🛡` brand | `⚠` ban-evader headline | `✅` empty success | `ℹ` info banner | `✓` signal pill | `↑↓` trend |

No others, ever. Severity color carries urgency, not the copy.

## Components available in the UI kit

`AlertCard`, `KpiTile`, `SeverityBadge`, `TabBar`, `RiskGauge`, `ClusterGraph`, `ComparisonPanel`, `AuditLogRow`, `Chip`, `Button`, `Icon` (Lucide wrapper), `PostFrame` (Reddit chrome). All are in `ui_kits/sentinel-dashboard/*.jsx`. Lift them whole — don't reinvent.
