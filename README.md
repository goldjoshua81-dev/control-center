# Fresh $$ Control Center

A static, free-to-host dashboard for Joshua's money-making projects: POD shops, digital products, ads, experiments, the Deal Scout acquisition watchlist, and "Needs Joshua" items.

**One data file:** everything on the page comes from `data.json`. Totals (revenue, profit, ROAS, capital deployed, reserve) are calculated in the browser from that file, so they can't drift out of sync.

**No fake numbers:** every metric starts at a real `0`, and anything not running is marked `planned`, `building`, or `not live`. Watchlist figures are what sellers listed on Flippa/TrustMRR, labeled unverified.

## Files
| File | Purpose |
|---|---|
| `index.html`, `flowchart.html`, `improvements.html`, `style.css`, `pages.css`, `app.js` | Dashboard and focused operating pages (no build step) |
| `data.json` | **The only file to edit** |
| `other-bots.html`, `other.js` | "Other bots" page: Joshua's second Grok Bot account, from `data.json → other_account` (relayed manually; keep `as_of` current) |
| `combined.html`, `combined.js` | Phone-friendly combined view across both accounts (money, next 14 days, to-dos, shop one-liners, recurring bills) |
| `traffic.py` | Traffic history: `python3 traffic.py collect` appends dated readings (PrintPlz from the Shop Manager snapshot; Cloudflare Web Analytics when the token allows) to `data.json → traffic_history`; `add` for a manual reading; `show` for latest. Never estimate. |
| `cc-common.js` | Shared helpers for the two pages above (index.html still uses app.js only) |
| `update.py` | CLI to edit `data.json` safely (bumps `last_updated` to now in PT, validates) and publish |
| `screenshot.py` | Headless Chromium render to `screenshots/*.png` |
| `shots/` | Release screenshots for the flowchart and improvements pages |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Refreshing stats
```bash
cd /workspace/control-center
python3 update.py show                                   # summary
python3 update.py set shops.printplz.status live
python3 update.py set shops.printplz.orders 3
python3 update.py set shops.printplz.revenue 44.97
python3 update.py set shops.printplz.profit 15.09      # after Printify cost, Etsy fees, and ad spend
python3 update.py set shops.printplz.visits 412
python3 update.py set shops.printplz.top_products '[{"name":"Student Driver Magnet","orders":2}]'
python3 update.py set "ads.Etsy Ads.status" on
python3 update.py set "ads.Etsy Ads.spend" 10
python3 update.py set experiments.0.status winner         # winner | loser | testing | not live
python3 update.py set experiments.0.result "3 sales / 400 visits"
python3 update.py spend 15 "Etsy shop setup fee" --lane "Print-on-demand shops"
python3 update.py need "Approve sample order" "Check print quality" --priority high
python3 update.py done 0                                   # tick off needs_joshua item #0
python3 update.py lanes                                  # REQUIRED before any "no run today" / pin-count wording
python3 update.py publish -m "stats Oct 1"                 # git commit + push → Pages redeploys in ~1 min
```
Shops, ads, and experiments can be addressed by `id`, `name`/`channel` (or a unique prefix), or list index. You can also hand-edit `data.json` directly. Then run `python3 update.py touch` to bump the timestamp.

**Definitions:** *Capital deployed* is the sum of `budget.ledger` (setup fees, samples, subscriptions, acquisitions). *Cash reserve* is budget − deployed + net profit. *Conversion* is orders ÷ visits.

**Morning refresh rule:** run `python3 update.py lanes` first and take each lane's status from its newest dated file (Deal Scout `acquisitions/deal-scout/YYYY-MM-DD-run.md`, HostFees pins `affiliate/pins/posted.md`, PrintPlz `audit/order-checks/` and `audit/loop/`, WebsitePlz site files, plus Scott Bot's lanes: `handoffs/open-tasks-<today>-am.md` by 8:45 AM, `handoffs/email-sweep-<today>-am*.md` by 8:15 AM, `handoffs/nightly-rollup-<yesterday>.md` after 9:00 AM, `backups/emergency/gold-hq-<yesterday>.tar.gz`; LATE flags are display-only). Never write "no run" from an earlier wrap-up; if a lane's run is still in progress, say "in progress" and recheck later. `publish` refuses to push when the pages say "no … Deal Scout run" for a date that has a run file, or when a pin count differs from `posted.md` (`--force` overrides).

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
