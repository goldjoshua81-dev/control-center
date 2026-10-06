#!/usr/bin/env python3
"""Fresh $$ Control Center updater. Edits data.json and can publish it.

Examples:
  python3 update.py show
  python3 update.py set shops.printplz.orders 3          # shops/ads/experiments addressable by id/name prefix or index
  python3 update.py set shops.printplz.status live
  python3 update.py set "ads.Etsy Ads.spend" 12.50
  python3 update.py set experiments.0.status winner         # winner | loser | testing | not live
  python3 update.py spend 15 "Etsy shop setup fee" --lane "Print-on-demand shops"
  python3 update.py need "Approve sample order" "Check print quality" --priority high
  python3 update.py done 0                                   # mark needs_joshua item #0 done
  python3 update.py touch                                    # bump last_updated only
  python3 update.py lanes                                    # newest dated file per lane (check BEFORE writing "no run")
  python3 update.py publish -m "daily stats"                 # git commit + push (GitHub Pages redeploys); blocked if pages contradict lane files
Every write bumps meta.last_updated to now (PT).
"""
import argparse, json, re, subprocess, sys, datetime
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


# ---- Lane freshness: check each lane's newest dated files BEFORE writing "no run" wording ----
WS = Path("/workspace")
def _mt(p): return datetime.datetime.fromtimestamp(p.stat().st_mtime, PT)
def _newest(paths):
    paths = [p for p in paths if p.is_file()]
    return max(paths, key=lambda p: p.stat().st_mtime) if paths else None
def lane_status():
    """Return {lane: {"latest": date str, "at": PT time, "file": path, ...}} from files on disk. Never guesses."""
    out = {}
    runs = sorted((WS / "acquisitions/deal-scout").glob("20??-??-??-run.md"))
    if runs:
        f = runs[-1]; first = f.read_text(errors="ignore").splitlines()[0] if f.stat().st_size else ""
        top = ""
        for line in f.read_text(errors="ignore").splitlines():
            if line.startswith("| 1 |"):
                top = re.sub(r"\*\*|\(.*", "", line.split("|")[2]).strip(" ,"); break
        out["Deal Scout"] = {"latest": f.name[:10], "at": _mt(f).strftime("%b %-d %-I:%M %p PT"), "file": str(f),
                             "runs": [r.name[:10] for r in runs[-5:]], "top_pick": top, "title": first.lstrip("# ")}
    posted = WS / "affiliate/pins/posted.md"
    if posted.exists():
        t = posted.read_text(errors="ignore")
        days = re.findall(r"Published (\d{4}-\d{2}-\d{2})", t)
        out["HostFees pins"] = {"latest": days[-1] if days else "", "at": _mt(posted).strftime("%b %-d %-I:%M %p PT"),
                                "file": str(posted), "posted": len(set(re.findall(r"pinterest\.com/pin/\d+", t)))}
    for lane, pat in (("PrintPlz order check", "pod-shops/printplz/audit/order-checks/*.md"),
                      ("PrintPlz polish loop", "pod-shops/printplz/audit/loop/20??-??-??-*.md")):
        f = _newest(list(WS.glob(pat)))
        if f: out[lane] = {"latest": _mt(f).date().isoformat(), "at": _mt(f).strftime("%b %-d %-I:%M %p PT"), "file": str(f)}
    site = WS / "websiteplz-site"
    if site.exists():
        f = _newest([p for p in site.rglob("*") if ".git" not in p.parts and "node_modules" not in p.parts])
        if f: out["WebsitePlz site"] = {"latest": _mt(f).date().isoformat(), "at": _mt(f).strftime("%b %-d %-I:%M %p PT"), "file": str(f)}
    return out

def cmd_lanes(as_json=False):
    st = lane_status()
    if as_json: print(json.dumps(st, indent=2, ensure_ascii=False)); return
    today = datetime.datetime.now(PT).date().isoformat()
    for lane, s in st.items():
        flag = "RAN TODAY" if s["latest"] == today else "last " + s["latest"]
        extra = "".join(f" · {k}={v}" for k, v in s.items() if k in ("posted", "top_pick", "runs"))
        print(f"{lane}: {flag} ({s['at']}) {s['file']}{extra}")

STALE_RUN = re.compile(r"\bno (?:new )?(?:overnight )?(?:(?:\w{3} )?\w{3} \d{1,2} )?(?:Deal Scout )?run\b", re.I)
def freshness_problems():
    """Block publishing 'no run' wording or a pin count that contradicts the lane files."""
    st, probs = lane_status(), []
    text = "\n".join((HERE / n).read_text(errors="ignore") for n in ("data.json", "flowchart.html", "improvements.html"))
    ds = st.get("Deal Scout")
    if ds:
        d = datetime.date.fromisoformat(ds["latest"]); tag = f"{d:%b} {d.day}"
        for m in STALE_RUN.finditer(text):
            ctx = text[max(0, m.start() - 60): m.end() + 60]
            md = re.search(r"(\w{3}) (\d{1,2})", m.group(0))
            has_file = False
            if md:
                try:
                    dd = datetime.datetime.strptime(f"{md.group(1)} {md.group(2)} {d.year}", "%b %d %Y").date()
                    has_file = (WS / f"acquisitions/deal-scout/{dd.isoformat()}-run.md").exists()
                except ValueError: pass
            if "Deal Scout" in ctx and (has_file or "Deal Scout" in m.group(0)):
                probs.append(f"Deal Scout: page says {m.group(0)!r} but {ds['file']} exists (latest run {ds['latest']})")
    pins = st.get("HostFees pins")
    if pins:
        D = json.loads((HERE / "data.json").read_text())
        hf = next((p for p in D.get("projects", []) if p.get("id") == "hostfees"), {})
        if hf.get("pins_published") is not None and hf["pins_published"] != pins["posted"]:
            probs.append(f"HostFees pins: data.json pins_published={hf['pins_published']} but posted.md lists {pins['posted']}")
        for m in re.finditer(r"(\d+) of 49", text):
            if int(m.group(1)) != pins["posted"]:
                probs.append(f"HostFees pins: page text says '{m.group(0)}' but posted.md lists {pins['posted']}"); break
    return probs

def cmd_publish(msg, force=False):
    probs = freshness_problems()
    if probs and not force:
        print("Not publishing: lane files contradict the dashboard. Fix the wording, or rerun with --force.")
        for p in probs: print("  -", p)
        sys.exit(2)
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
    s = sub.add_parser("publish"); s.add_argument("-m", default="Update dashboard data"); s.add_argument("--force", action="store_true")
    s = sub.add_parser("lanes", help="show each lane's newest dated files (run before writing any 'no run' wording)"); s.add_argument("--json", action="store_true")
    a = ap.parse_args()
    if a.cmd == "publish": return cmd_publish(a.m, a.force)
    if a.cmd == "lanes": return cmd_lanes(a.json)
    d = load()
    if a.cmd == "show": return cmd_show(d)
    if a.cmd == "set": cmd_set(d, a.path, a.value)
    elif a.cmd == "spend":
        d["budget"]["ledger"].append({"date": a.date or datetime.datetime.now(PT).date().isoformat(), "what": a.what, "lane": a.lane, "amount": a.amount})
    elif a.cmd == "need": d["needs_joshua"].append({"task": a.task, "why": a.why, "priority": a.priority, "done": False})
    elif a.cmd == "done": d["needs_joshua"][a.index]["done"] = True
    save(d)

if __name__ == "__main__": main()
