## Project

Sentinel is a Reddit moderation intelligence platform built on Devvit, combining three engines (Raid Radar, Memory, Health Score) on shared behavioral infrastructure.

## Read first

Read `sentinel-spec/01-product-decisions.md` before any task. That file is the project compass: every architectural choice has documented reasoning. Its decisions cannot be reversed without explicit lead approval.

## Non-negotiables

- Production-ready over impressive-looking
- Statistics over ML (anomaly detection, not machine learning)
- Opt-in over auto-action (reversible soft actions only)
- Reversible over destructive (no bans, no removals; audit log + undo always)
- No external databases (Devvit Redis only, bounded retention)
- Suggest, don't auto-ban (never automated ban or content removal)

## Folder map

- `sentinel-spec/` — Specification (source of truth): README, product decisions, architecture, engines, UI, onboarding, demo, listing.
- `.claude/agents/` — Named subagent definitions for team coordination.
- `src/` — TypeScript source: event ingestion, behavioral graph, three engines, dashboard.
- `sentinel-spec/00-delegation-log.md` — Lead's append-only delegation log and task context.

## Tech stack

- **Language**: TypeScript
- **Platform**: Devvit (@devvit/public-api)
- **Storage**: Devvit Redis only (no external databases)
- **UI**: Devvit Blocks (custom posts) + Forms (settings)
- **Triggers & scheduling**: Devvit event triggers and scheduler
- No ML libraries, no external APIs, no infrastructure overhead.

## Coding conventions

- TypeScript (language for all source code)
- File naming: kebab-case (following spec convention: 01-product-decisions.md, 02-architecture.md, etc.)

## How to work here

- Spawn briefs follow ROLE/MODEL/EFFORT/CONTEXT/TASK/OUTPUT/OUT OF SCOPE/PLAN APPROVAL format.
- Never reverse decisions in `01-product-decisions.md` — surface conflicts as Plan Review items for lead approval.
- Research Devvit capabilities first, code second. When unsure about Devvit APIs, explore before building.
- Output format must match what was requested. No scope creep.
