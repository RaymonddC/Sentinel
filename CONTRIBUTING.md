# Contributing to Sentinel

Sentinel is a Devvit app for Reddit moderation intelligence. This guide gets you from a fresh clone to a working dev environment where you can playtest on your own subreddit and submit PRs.

---

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Node.js | **22+** (check: `node -v`) |
| OS | WSL2 (Windows), Linux, or macOS |
| Reddit account | Must be **developer-verified** (email + phone confirmed at reddit.com/prefs) |
| GitHub access | Read access to the repo; write access to push feature branches |
| npm | Included with Node; used for all package management |

> **Windows users**: Run everything inside WSL2. Native Windows shells are not supported by the Devvit CLI.

---

## One-time setup

```bash
# 1. Clone the repo
git clone https://github.com/RaymonddC/Sentinel.git
cd Sentinel

# 2. Install project dependencies
npm install

# 3. Install the Devvit CLI globally
npm install -g devvit

# 4. Authenticate with Reddit (opens browser OAuth)
devvit login
```

After `devvit login` completes, your credentials are cached locally. You won't need to re-login until the token expires or you explicitly log out.

---

## Create your own test subreddit

Each developer needs a private test subreddit to install and playtest Sentinel. Devvit installs are **per-subreddit**, so you get completely isolated Redis state.

1. Go to [reddit.com/subreddits/create](https://www.reddit.com/subreddits/create)
2. Choose a unique name (e.g., `sentinel_yourname_test`)
3. Set visibility to **Private** or **Restricted** (required for hackathon apps; must be ≤ 200 members)
4. **Do NOT mark it as Adult Content / NSFW** — this enables a content gate that hides the Sentinel custom post behind a warning overlay
5. Make sure your account has **full moderator permissions** on the sub

---

## How collaboration works

**Important:** Devvit currently has no built-in multi-developer feature. Each Devvit app slug is owned by exactly one Reddit account. There is no "add collaborator" option in the developer portal as of 2026-05.

So contributors **share the codebase** (this GitHub repo) but **each run their own Devvit app slug** under their own Reddit dev account.

### One-time setup for a new contributor

1. Register your own Devvit slug. From your clone:

   ```bash
   # Edit devvit.yaml to change the slug to something globally unique.
   # Example: if your Reddit username is u/raysmithy, use `sentinel-raysmithy`.
   ```

2. Tell git to ignore your local slug change so you don't accidentally commit it:

   ```bash
   git update-index --skip-worktree devvit.yaml
   ```

   This is the right tool for "tracked file with local-only modifications" — `.gitignore` wouldn't work because the file is already tracked.

3. Verify:

   ```bash
   git status   # devvit.yaml should NOT appear as modified
   ```

4. Then continue with the daily dev loop below — `devvit upload`, `devvit playtest`, etc. — under your own slug.

### Reverting skip-worktree (if you ever need to)

```bash
git update-index --no-skip-worktree devvit.yaml
git checkout devvit.yaml   # discard local slug edit and restore the canonical slug
```

### Coordinating uploads

- Only the **repo owner** uploads under the canonical `sentinel-h` slug (this is the slug pinned to the production install path / future app-store listing).
- Other contributors test on their own slugs and submit changes via pull request.
- After PR merge, the repo owner runs `devvit upload` against `sentinel-h` to ship the merged code to the canonical app.

---

## Daily dev loop

```bash
# 1. Create a feature branch
git checkout -b feat/your-feature

# 2. Edit code in src/

# 3. Run tests — must pass before uploading
npm test

# 4. Type-check — must pass before uploading
npm run typecheck

# 5. Upload a new version to Devvit
devvit upload

# 6. Start live-reload playtesting on your sub
devvit playtest r/<your-test-sub>

# 7. In your browser, open your sub with the playtest param:
#    https://www.reddit.com/r/<your-test-sub>/?playtest=<your-slug>
#    Refresh after code changes — playtest mode hot-reloads the UI
```

> **Tip**: `devvit playtest` saves you from manually uploading + installing on every change. Leave it running in a terminal while you edit.

---

## Branching and PRs

- **Branch off `main`**: `git checkout -b feat/your-feature`
- **One PR per coherent change** — small PRs are reviewed faster
- **CI runs automatically** on every push and PR (see below)
- CI blocks merge if `npm run typecheck` or `npm test` fails
- Prefix branch names: `feat/`, `fix/`, `chore/`, `docs/`

---

## Running specific things

### Tests

```bash
# Run all tests
npm test

# Run a single test file
npx vitest run src/__tests__/perf.test.ts

# Watch mode (re-runs on save)
npm run test:watch
```

Test runner is **Vitest**. Tests are colocated with source (`*.test.ts` files).

### Type checking

```bash
npm run typecheck
# equivalent to: npx tsc --noEmit
```

### Performance budget tests

```bash
npx vitest run src/__tests__/perf.test.ts
```

The perf test suite enforces algorithmic complexity budgets on hot paths (signal evaluation, behavioral queries). These must pass before any PR that touches engine code.

### Lint

```bash
npm run lint
```

> Note: ESLint is not fully configured yet (the `lint` script currently echoes a placeholder). If you want to add ESLint, open an issue first — we'll configure it project-wide rather than per-contributor.

---

## Spec is the source of truth

All design decisions live in `sentinel-spec/`:

| File | Purpose |
|---|---|
| `sentinel-spec/00-architectural-summary.md` | Start here — high-level overview |
| `sentinel-spec/01-product-decisions.md` | **Compass file** — documents every architectural choice |
| `sentinel-spec/00-delegation-log.md` | Project history and task log |
| `sentinel-spec/research/` | Devvit capability research and API findings |

**Never reverse decisions in `sentinel-spec/01-product-decisions.md`**. If you see a conflict between the spec and the code, surface it in your PR description as a "Plan Review" item — don't silently resolve it.

---

## Known gotchas

### NSFW / Adult Content gate hides the dashboard

If your test subreddit is marked "Adult Content", Reddit wraps the Sentinel custom post in a content gate. The dashboard post exists but users see a blur + "View NSFW content" overlay instead. Fix: go to subreddit settings → uncheck "Adult Content".

### `?playtest=<slug>` is required in dev mode

When playtesting, the dev version of the app is only visible with the `?playtest=<your-slug>` URL parameter (use the slug from your `devvit.yaml`). Without it, you'll see the latest **published** version (or nothing if you haven't published). Always open:
```
https://www.reddit.com/r/<your-test-sub>/?playtest=<your-slug>
```

### AppInstall trigger only fires on first install

The `AppInstall` event fires when Sentinel is first installed on a sub. It creates the pinned dashboard post and sets up initial state. If you uninstall and reinstall, it fires again. If you just `devvit upload` a new version, the trigger does **not** re-fire — existing state is preserved. To fully reset a test sub, uninstall via `devvit uninstall r/<your-test-sub>` and then reinstall.

### Redis state is per-installation

Each subreddit has its own isolated Redis namespace. Two developers on different test subs can't share data, which is intentional — it gives everyone a clean sandbox.

### No external databases

Sentinel uses Devvit Redis exclusively. Don't add external API calls, databases, or network requests to production code paths. This is a project non-negotiable.

---

## Deployment / uploading new versions

CI validates code automatically on every push, but **deployment to Devvit requires a manual step** (Devvit's CLI uses browser OAuth and does not support headless/token-based authentication for CI pipelines as of 2026-05).

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full post-merge deploy checklist.

---

## How to get help

- **Open a GitHub issue** for bugs or questions
- **Read `sentinel-spec/00-delegation-log.md`** for project history and prior decisions
- **Read `sentinel-spec/research/`** for Devvit capability findings (Redis limits, scheduler limits, API surface)
- If a spec decision seems wrong, raise it in a PR comment — don't silently override it
