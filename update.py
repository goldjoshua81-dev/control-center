#!/usr/bin/env python3
"""Fresh $$ Control Center updater. Edits data.json and can publish it.

Examples:
  python3 update.py show
  python3 update.py set shops.honk-twice.orders 3          # shops/ads/experiments addressable by id/name prefix or index
  python3 update.py set shops.honk-twice.status live
  python3 update.py set "ads.Etsy Ads.spend" 12.50
  python3 update.py set experiments.0.status winner         # winner | loser | testing | not live
  python3 update.py spend 15 "Etsy shop setup fee" --lane "Print-on-demand shops"
  python3 update.py need "Approve sample order" "Check print quality" --priority high
  python3 update.py done 0                                   # mark needs_joshua item #0 done
  python3 update.py touch                                    # bump last_updated only
  python3 update.py publish -m "daily stats"                 # git commit + push (GitHub Pages redeploys)
Every write bumps meta.last_updated to now (PT).
"""
import argparse, json, subprocess, sys, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
DATA = HERE / "data.json"
PT = ZoneInfo("America/Los_Angeles")
NUMERIC = {"orders", "revenue", "profit", "views", "visits", "listings_live", "listings_drafted",
           "spend", "attributed_revenue", "amount", "starting_capital", "listings"}

def load(): return json.loads(DATA.read_text())

def save(d):
    d["meta"]["last_updated"] = datetime.datetime.now(PT).isoformat(timespec="seconds")
    validate(d)
    tmp = DATA.with_suffix(".tmp"); tmp.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n"); tmp.replace(DATA)
    print("saved; last_updated =", d["meta"]["last_updated"])

def validate(d):
    for k in ("meta", "budget", "shops", "ads", "experiments", "acquisitions", "needs_joshua"):
        if k not in d: sys.exit(f"data.json missing '{k}'")
    for s in d["shops"]:
        for f in ("orders", "revenue", "profit", "views", "visits"):
            if not isinstance(s.get(f), (int, float)): sys.exit(f"shop {s.get('id')}: {f} must be a number")

def find(lst, key):
    if key.lstrip("-").isdigit(): return lst[int(key)]
    for x in lst:
        for f in ("id", "name", "channel"):
            if str(x.get(f, "")).lower() == key.lower(): return x
    hits = [x for x in lst if any(str(x.get(f, "")).lower().startswith(key.lower()) for f in ("id", "name", "channel"))]
    if len(hits) == 1: return hits[0]
    sys.exit(f"can't uniquely find '{key}' ({len(hits)} matches)")

def coerce(field, v):
    if v.lower() in ("true", "false"): return v.lower() == "true"
    if v.lower() == "null": return None
    if field in NUMERIC or v.replace(".", "", 1).lstrip("-").isdigit():
        try: return int(v) if v.lstrip("-").isdigit() else float(v)
        except ValueError: pass
    if v[:1] in "[{":
        return json.loads(v)
    return v

def cmd_set(d, path, value):
    parts = path.split("."); node = d
    for p in parts[:-1]:
        node = find(node, p) if isinstance(node, list) else node[p]
    last = parts[-1]
    if isinstance(node, list): sys.exit("path must end in a field name")
    node[last] = coerce(last, value)
    print(f"{path} = {node[last]!r}")

def cmd_show(d):
    sh = d["shops"]; led = sum(x["amount"] for x in d["budget"]["ledger"])
    print(f"Updated {d['meta']['last_updated']}")
    print(f"Revenue ${sum(s['revenue'] for s in sh):,.2f} | Profit ${sum(s['profit'] for s in sh):,.2f} | "
          f"Deployed ${led:,.2f} of ${d['budget']['starting_capital']:,}")
    for s in sh: print(f"  [{s['status']}] {s['name']}: {s['orders']} orders, ${s['revenue']} rev, {s['visits']} visits")
    for i, n in enumerate(d["needs_joshua"]): print(f"  need #{i} {'[x]' if n['done'] else '[ ]'} {n['task']}")

def cmd_publish(msg):
    def git(*a): return subprocess.run(["git", "-C", str(HERE), *a], capture_output=True, text=True)
    if git("rev-parse", "--git-dir").returncode: sys.exit("not a git repo; see README 'Publishing'")
    git("add", "-A")
    c = git("commit", "-m", msg)
    print(c.stdout.strip() or c.stderr.strip())
    if not git("remote").stdout.strip(): sys.exit("no git remote configured; committed locally only")
    p = git("push")
    print(p.stdout + p.stderr); sys.exit(p.returncode)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("show"); sub.add_parser("touch")
    s = sub.add_parser("set"); s.add_argument("path"); s.add_argument("value")
    s = sub.add_parser("spend"); s.add_argument("amount", type=float); s.add_argument("what"); s.add_argument("--lane", default=""); s.add_argument("--date", default="")
    s = sub.add_parser("need"); s.add_argument("task"); s.add_argument("why"); s.add_argument("--priority", default="medium", choices=["high", "medium", "low"])
    s = sub.add_parser("done"); s.add_argument("index", type=int)
    s = sub.add_parser("publish"); s.add_argument("-m", default="Update dashboard data")
    a = ap.parse_args()
    if a.cmd == "publish": return cmd_publish(a.m)
    d = load()
    if a.cmd == "show": return cmd_show(d)
    if a.cmd == "set": cmd_set(d, a.path, a.value)
    elif a.cmd == "spend":
        d["budget"]["ledger"].append({"date": a.date or datetime.datetime.now(PT).date().isoformat(), "what": a.what, "lane": a.lane, "amount": a.amount})
    elif a.cmd == "need": d["needs_joshua"].append({"task": a.task, "why": a.why, "priority": a.priority, "done": False})
    elif a.cmd == "done": d["needs_joshua"][a.index]["done"] = True
    save(d)

if __name__ == "__main__": main()
