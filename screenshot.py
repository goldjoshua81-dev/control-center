#!/usr/bin/env python3
"""Render the dashboard headlessly and save PNGs (desktop + mobile). Usage: python3 screenshot.py [url]"""
import sys, subprocess, time, socket
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent
url = sys.argv[1] if len(sys.argv) > 1 else None
srv = None
if not url:
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); url = f"http://127.0.0.1:{port}/"
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, vp in (("desktop", {"width": 1280, "height": 900}), ("mobile", {"width": 390, "height": 844})):
            ctx = b.new_context(viewport=vp, device_scale_factor=2 if name == "mobile" else 1)
            # Login gate (gate.js) redirects unless sessionStorage cc_session=1; set before any page load.
            ctx.add_init_script("sessionStorage.setItem('cc_session','1')")
            pg = ctx.new_page()
            pg.goto(url); pg.wait_for_selector(".shop")
            out = HERE / "screenshots" / f"dashboard-{name}.png"; out.parent.mkdir(exist_ok=True)
            pg.screenshot(path=str(out), full_page=True); print(out)
        b.close()
finally:
    if srv: srv.terminate()
