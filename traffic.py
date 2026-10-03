#!/usr/bin/env python3
"""Traffic history for the Control Center (views / visits / impressions per venture).

Readings live in data.json:
  traffic_sources  - one entry per venture/store tile (id, name, account, primary metric, status, how to get data)
  traffic_history  - dated readings: {date, source, metric, value, window, method}

Rules: only record numbers actually read from a real source, with the time they were read. Never estimate.

Usage:
  python3 traffic.py show                                   # latest reading per source/metric
  python3 traffic.py add printplz views 31 --window 7d --method "Etsy Shop Manager stats" [--date 2026-10-04T08:00:00-07:00]
  python3 traffic.py collect                                # pull what the box can read on its own:
        - PrintPlz: data/printplz-live-listings.json (views_7d / visits_7d written by the Shop Manager refresh)
        - HostFees / WebsitePlz: Cloudflare Web Analytics via GraphQL, if CLOUDFLARE_API_TOKEN has Account Analytics: Read
  python3 traffic.py collect --publish                      # ... then git commit + push (GitHub Pages redeploys)
A reading is skipped if the same source+metric+date already exists, so collect is safe to run repeatedly.
"""
import argparse, datetime, json, os, sys, urllib.request, urllib.error
sys.dont_write_bytecode = True
from pathlib import Path
from zoneinfo import ZoneInfo
sys.path.insert(0, str(Path(__file__).resolve().parent))
import update  # reuse load/save/validate (save bumps meta.last_updated)

HERE = Path(__file__).resolve().parent
PT = ZoneInfo("America/Los_Angeles")
CF = "https://api.cloudflare.com/client/v4"

def add(d, source, metric, value, date, window="", method=""):
    if not any(s["id"] == source for s in d.get("traffic_sources", [])):
        sys.exit(f"unknown source '{source}' (see traffic_sources in data.json)")
    h = d.setdefault("traffic_history", [])
    if any(r["source"] == source and r["metric"] == metric and r["date"] == date for r in h):
        print(f"skip (already recorded): {source} {metric} @ {date}"); return False
    h.append({"date": date, "source": source, "metric": metric, "value": value, "window": window, "method": method})
    h.sort(key=lambda r: (r["source"], r["metric"], r["date"]))
    print(f"added: {source} {metric} = {value} ({window}) @ {date}"); return True

def collect_printplz(d):
    f = HERE / "data" / "printplz-live-listings.json"
    if not f.exists(): print("printplz: no Shop Manager snapshot file"); return 0
    s = json.loads(f.read_text()); n = 0
    for m in ("views", "visits"):
        v = s.get(m + "_7d")
        if isinstance(v, (int, float)) and s.get("checked_at"):
            n += add(d, "printplz", m, v, s["checked_at"], "7d", "Etsy Shop Manager stats (snapshot data/printplz-live-listings.json)")
    return n

def _cf(path=None, gql=None):
    tok = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not tok: raise RuntimeError("CLOUDFLARE_API_TOKEN not set")
    h = {"Authorization": "Bearer " + tok, "Content-Type": "application/json"}
    req = urllib.request.Request(CF + (path or "/graphql"), data=json.dumps(gql).encode() if gql else None, headers=h)
    return json.load(urllib.request.urlopen(req, timeout=30))

def collect_cloudflare(d):
    """Web Analytics visits + page views, last 7 days, per host that has a Web Analytics site."""
    want = {s["cf_host"]: s["id"] for s in d.get("traffic_sources", []) if s.get("cf_host")}
    if not want: return 0
    try:
        acc = _cf("/accounts")["result"][0]["id"]
        sites = _cf(f"/accounts/{acc}/rum/site_info/list").get("result") or []
    except Exception as e:
        print("cloudflare: can't list Web Analytics sites:", e); return 0
    tags = {}
    for s in sites:
        host = s.get("host") or (s.get("ruleset") or {}).get("zone_name")
        if host in want: tags[want[host]] = s["site_tag"]
    for host, sid in want.items():
        if sid not in tags: print(f"cloudflare: no Web Analytics site for {host} (enable Web Analytics for it)")
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    start = now - datetime.timedelta(days=7)
    q = """query($a:String!,$t:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){
      rumPageloadEventsAdaptiveGroups(limit:1,filter:{siteTag:$t,datetime_geq:$s,datetime_lt:$e}){count sum{visits}}}}}"""
    n = 0
    for sid, tag in tags.items():
        r = _cf(gql={"query": q, "variables": {"a": acc, "t": tag, "s": start.isoformat().replace("+00:00", "Z"), "e": now.isoformat().replace("+00:00", "Z")}})
        if r.get("errors"):
            print(f"cloudflare {sid}: {r['errors'][0].get('message')} (token needs Account > Account Analytics: Read)"); continue
        g = r["data"]["viewer"]["accounts"][0]["rumPageloadEventsAdaptiveGroups"]
        views = g[0]["count"] if g else 0; visits = g[0]["sum"]["visits"] if g else 0
        when = now.astimezone(PT).isoformat(timespec="seconds")
        n += add(d, sid, "visits", visits, when, "7d", "Cloudflare Web Analytics (GraphQL)")
        n += add(d, sid, "views", views, when, "7d", "Cloudflare Web Analytics (GraphQL)")
    return n

def show(d):
    h = d.get("traffic_history", [])
    for s in d.get("traffic_sources", []):
        rows = sorted([r for r in h if r["source"] == s["id"]], key=lambda r: r["date"])
        if not rows: print(f"[{s['status']}] {s['name']}: no readings · {s.get('needs', '')}"); continue
        for m in sorted({r["metric"] for r in rows}):
            mr = [r for r in rows if r["metric"] == m]
            prev = f" (prev {mr[-2]['value']} @ {mr[-2]['date']})" if len(mr) > 1 else ""
            print(f"[{s['status']}] {s['name']} {m} {mr[-1]['window']}: {mr[-1]['value']} @ {mr[-1]['date']}{prev}")

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("show")
    a = sub.add_parser("add"); a.add_argument("source"); a.add_argument("metric"); a.add_argument("value", type=float)
    a.add_argument("--date", default=""); a.add_argument("--window", default=""); a.add_argument("--method", default="manual")
    c = sub.add_parser("collect"); c.add_argument("--publish", action="store_true")
    o = ap.parse_args(); d = update.load()
    if o.cmd == "show": return show(d)
    if o.cmd == "add":
        v = int(o.value) if o.value.is_integer() else o.value
        changed = add(d, o.source, o.metric, v, o.date or datetime.datetime.now(PT).isoformat(timespec="seconds"), o.window, o.method)
    else:
        changed = collect_printplz(d) + collect_cloudflare(d)
    if changed: update.save(d)
    else: print("no new readings")
    if o.cmd == "collect" and o.publish and changed: update.cmd_publish("Traffic readings " + datetime.datetime.now(PT).strftime("%b %-d %H:%M PT"))

if __name__ == "__main__": main()
