# Bosch Series 6 Dishwasher Price Tracker — GitHub Actions + GitHub Pages

Twice-daily price tracker for the Bosch Series 6 60cm Built-Under Dishwasher
(SMU6HCS01A / SMU6HAS01A) across 13 AU retailers, running entirely on
**free** GitHub infrastructure — no Cloudflare, no paid services.

- A scheduled GitHub Actions workflow runs twice a day, checks every
  retailer (plain HTTP fetch for most, a real headless Chromium via
  Playwright for the JS-rendered or bot-protected sites), and commits
  the results back to the repo.
- The same workflow regenerates a static dashboard (`docs/index.html`),
  which GitHub Pages serves for free.
- History is stored as plain JSON in `data/` — no database, fully
  version-controlled, human-readable.

This repo comes pre-seeded with the price data already gathered
(11–12 Aug 2026) so the dashboard isn't empty on day one.

## Setup (all free, ~10 minutes)

1. **Create a new GitHub repo** (public or private — Actions minutes and
   Pages are free either way for a repo this small) and push this folder's
   contents to it:
   ```bash
   cd dishwasher-tracker-gh
   git init
   git add .
   git commit -m "Initial dishwasher price tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Allow the workflow to push commits.** GitHub → your repo → Settings →
   Actions → General → "Workflow permissions" → select **Read and write
   permissions** → Save. (Without this, the daily commit-back step fails —
   the workflow's default token is read-only otherwise.)

3. **Enable GitHub Pages.** GitHub → your repo → Settings → Pages →
   under "Build and deployment", set Source to **Deploy from a branch**,
   branch **main**, folder **/docs** → Save. GitHub will give you a URL
   like `https://<your-username>.github.io/<your-repo>/`.

4. **Trigger the first run manually** (don't wait for the schedule):
   GitHub → your repo → Actions tab → "Twice-daily dishwasher price check" →
   Run workflow. Watch it go green, then visit your Pages URL.

That's it — from then on it runs automatically every day at 8:00am and
8:00pm Brisbane time (`0 10,22 * * *` UTC in the workflow file) and
updates the same page.

## Running it locally (optional, for testing/tuning)

```bash
npm install
npx playwright install --with-deps chromium
npm run check-and-build   # runs the price check, then regenerates docs/index.html
open docs/index.html      # or just double-click it
```

## Files

- `.github/workflows/daily-price-check.yml` — the schedule (cron + manual
  trigger), and the steps: install → check prices → rebuild dashboard →
  commit & push if anything changed.
- `scripts/retailers.js` — the list of retailers/URLs/models to check.
- `scripts/extract.js` — best-effort price extraction (JSON-LD → meta tags
  → raw text scan). **Read the comment at the top of this file** — every
  retailer's HTML is different, and this was written without being able to
  run it live against each site from the build sandbox. Some will likely
  need a tweak after the first real run.
- `scripts/check-prices.mjs` — does the actual checking (fetch or
  Playwright per retailer) and writes `data/*.json`.
- `scripts/dashboard.js` / `scripts/generate-dashboard.mjs` — renders
  `data/*.json` into the static `docs/index.html` GitHub Pages serves.
- `data/history.json` — every price ever recorded (append-only).
- `data/latest.json` — the most recent reading per retailer/model.
- `data/last-run.json`, `data/last-drops.json` — bookkeeping for the
  dashboard's "last checked" line and any detected price drops.

## Tuning extraction

Run `npm run check` locally and read the console output — it prints the
price found (and which strategy found it: `json-ld`, `meta`, `text-scan`,
or `rendered-text`) for every retailer, or an error if nothing was found.
If a price looks wrong (e.g. it picked up a payment-plan installment or a
"was" price instead of the real one), open `scripts/extract.js` and either
tighten the JSON-LD/meta matching, or special-case that one retailer by
name in `scripts/check-prices.mjs`.

## Getting notified of price drops

`data/last-drops.json` is written fresh on every run — empty array `[]` if
nothing dropped, otherwise a list of `{ retailer, model, oldPrice,
newPrice, url }`. The workflow doesn't currently send a notification, but
if you want one:

- **Simplest:** add a step to the workflow that checks if
  `data/last-drops.json` isn't `[]` and sends a request to a free
  notification webhook (e.g. a Slack/Discord incoming webhook, or a service
  like ntfy.sh) — happy to add this if you tell me which channel you'd
  like it sent to.
- GitHub will also email you automatically if the workflow run itself
  fails (e.g. a retailer's page structure changed enough that the check
  errors out) — that's on by default, no setup needed.

## Cost

Genuinely free for a tracker this size:

- **GitHub Actions:** public repos get unlimited minutes; private repos
  get 2,000 free minutes/month — this job takes roughly 1–2 minutes/day
  (~30–60 min/month), well inside the free allowance either way.
- **GitHub Pages:** free for public repos (and private repos on the
  free plan get Pages too, just not custom domains on some plan tiers).
- **Playwright/Chromium:** runs inside the Actions runner, no separate
  service or account needed.

No credit card, no Cloudflare account, nothing paid.
