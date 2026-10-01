# Fresh $$ Control Center

A static, free-to-host dashboard for Joshua's money-making projects: POD shops, digital products, ads, experiments, the Deal Scout acquisition watchlist, and "Needs Joshua" items.

**One data file:** everything on the page comes from `data.json`. Totals (revenue, profit, ROAS, capital deployed, reserve) are calculated in the browser from that file, so they can't drift out of sync.

**No fake numbers:** every metric starts at a real `0`, and anything not running is marked `planned`, `building`, or `not live`. Watchlist figures are what sellers listed on Flippa/TrustMRR, labeled unverified.

## Files
| File | Purpose |
|---|---|
| `index.html`, `style.css`, `app.js` | The page (no build step, no dependencies) |
| `data.json` | **The only file to edit** |
| `update.py` | CLI to edit `data.json` safely (bumps `last_updated` to now in PT, validates) and publish |
| `screenshot.py` | Headless Chromium render to `screenshots/*.png` |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Refreshing stats
```bash
cd /workspace/control-center
python3 update.py show                                   # summary
python3 update.py set shops.honk-twice.status live
python3 update.py set shops.honk-twice.orders 3
python3 update.py set shops.honk-twice.revenue 44.97
python3 update.py set shops.honk-twice.profit 15.09      # after Printify cost, Etsy fees, and ad spend
python3 update.py set shops.honk-twice.visits 412
python3 update.py set shops.honk-twice.top_products '[{"name":"Student Driver Magnet","orders":2}]'
python3 update.py set "ads.Etsy Ads.status" on
python3 update.py set "ads.Etsy Ads.spend" 10
python3 update.py set experiments.0.status winner         # winner | loser | testing | not live
python3 update.py set experiments.0.result "3 sales / 400 visits"
python3 update.py spend 15 "Etsy shop setup fee" --lane "Print-on-demand shops"
python3 update.py need "Approve sample order" "Check print quality" --priority high
python3 update.py done 0                                   # tick off needs_joshua item #0
python3 update.py publish -m "stats Oct 1"                 # git commit + push → Pages redeploys in ~1 min
```
Shops, ads, and experiments can be addressed by `id`, `name`/`channel` (or a unique prefix), or list index. You can also hand-edit `data.json` directly. Then run `python3 update.py touch` to bump the timestamp.

**Definitions:** *Capital deployed* is the sum of `budget.ledger` (setup fees, samples, subscriptions, acquisitions). *Cash reserve* is budget − deployed + net profit. *Conversion* is orders ÷ visits.

## Preview locally
`python3 -m http.server 8000`, then open http://localhost:8000. Opening `index.html` via `file://` won't load the JSON.
Screenshot: `/workspace/.venv-pw/bin/python screenshot.py`, or pass a URL to shoot the live site.

## Publishing (GitHub Pages, free)
```bash
gh auth login                      # as goldjoshua81-dev
gh repo create control-center --public --source . --push
gh api -X POST repos/goldjoshua81-dev/control-center/pages -f "source[branch]=main" -f "source[path]=/"
# Live at https://goldjoshua81-dev.github.io/control-center/
```
GitHub Pages on a **private** repo requires a paid plan (Pro/Team), so on a free account the repo has to be **public**. Alternatives that also work for free: Cloudflare Pages, Netlify, or Vercel (drag-and-drop this folder, or connect the repo).

## Privacy tradeoffs
- No password. The page has `noindex,nofollow`, so it's "unlisted": search engines are asked not to index it, but **anyone with the URL can view it**.
- On free GitHub, the **repo is public too**, so `data.json` and its full git history are readable by anyone. Never put secrets, API keys, addresses, emails, bank info, or customer data in it. Shop-level totals only.
- For real access control at no cost: Cloudflare Pages + Cloudflare Access (free for up to 50 users, email one-time-PIN login).
