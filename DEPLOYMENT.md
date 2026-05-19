# Deployment — Manual Upload Guide

## Why manual?

Devvit's CLI authenticates via **browser OAuth** (Reddit's login flow). As of May 2026, there is no headless/token-based authentication path for CI pipelines — no `DEVVIT_TOKEN` env var, no auth-file injection, no non-interactive mode. Automated deployment via GitHub Actions is not possible without browser automation.

CI validates code on every push (see `.github/workflows/ci.yml`). Deployment to Devvit happens manually after merging to `main`.

---

## Post-merge deploy checklist

Run these steps after a PR merges to `main`:

```bash
# 1. Switch to main and pull the latest
git switch main
git pull

# 2. Verify tests and typecheck are still clean on your machine
npm test
npm run typecheck

# 3. Upload a new version to Devvit
devvit upload
```

`devvit upload` pushes a new version of `sentinel-h` to Reddit's app registry, but **uploaded versions do NOT auto-install to existing subs** — they sit at status `Uploaded` until explicitly installed. Each install pin to a specific version.

To roll out the new version to a sub:

```bash
# Promote latest version to one specific sub:
devvit install r/<sub-name>

# Or, for development with live reload:
devvit playtest r/<sub-name>
```

Audit installed versions in the dev portal (`developers.reddit.com/apps/sentinel-h` → App Versions tab). Production deployment to a real mod-team sub will need to `devvit install r/<sub>` explicitly after every upload.

---

## Publishing a new public version (app store / listing)

If this version should be available in the Devvit app directory or submitted for Reddit review:

```bash
devvit publish
```

Then follow the submission prompts. Reddit's review team approves new versions before they appear publicly in the app directory. Internal (test sub) usage does not require review.

---

## Verify after deploy

After uploading, confirm the new version works on your test sub:

- [ ] Open `https://www.reddit.com/r/<your-test-sub>/?playtest=sentinel-h` and check the dashboard post renders
- [ ] Trigger a test event (post a comment, post a new thread) and confirm signals register in the dashboard
- [ ] Confirm the audit log renders (no blank panels)
- [ ] Check the Sentinel menu item appears under the mod tools (three-dot menu on a post)
- [ ] No JavaScript console errors (check browser devtools)

If something looks broken after upload, the fastest recovery is to check the Devvit console logs:

```bash
devvit logs r/<your-test-sub>
```

---

## Who can upload?

Only the Reddit account that owns the `sentinel-h` app slug (currently `RaymonddC`) or a **collaborator** added via [developers.reddit.com](https://developers.reddit.com) → Apps → `sentinel-h` → Settings → Collaborators.

If you're a collaborator, you can run `devvit upload` too — just make sure you're logged in with the right Reddit account (`devvit whoami` to check).

---

## Future: if Devvit adds headless auth

If Reddit adds `DEVVIT_TOKEN` or a CI-friendly auth flow in a future CLI version:

1. Add `DEVVIT_TOKEN` (or whatever the env var is named) as a GitHub Actions repository secret
2. Write `.github/workflows/deploy.yml` triggered on `push: branches: [main]`
3. Steps: `checkout` → `setup-node` → `npm ci` → `devvit upload` (with the token env var set)
4. Update this file and `CONTRIBUTING.md` accordingly

Watch the [Devvit changelog](https://developers.reddit.com/docs/changelog) for updates.
