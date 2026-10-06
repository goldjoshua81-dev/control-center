loadData(D => {
  const O = D.other_account || null;
  const todayPT = new Date().toLocaleDateString("en-CA", {timeZone: "America/Los_Angeles"});
  const plus = n => { const d = new Date(todayPT + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const horizon = plus(14);
  $("updated").textContent = "This account: " + fmtPT(D.meta.last_updated) + (O ? " · Other bots: as of " + O.as_of : "");
  if (O) { $("relayNote").hidden = false; $("relayNote").textContent = "Other-bots data is relayed manually from Joshua's second Grok Bot account, as of " + O.as_of + ". It doesn't update on its own."; }

  // Money
  const rev = sum(D.shops, "revenue") + (O ? +O.revenue || 0 : 0);
  const spendA = sum(D.budget.ledger, "amount"), spendB = O ? +O.spend_total || 0 : 0;
  const k = [["Revenue (both)", usd(rev), `${sum(D.shops, "orders")} real orders`, "k-yellow", "💵"],
             ["Spent (both)", usd(spendA + spendB), `this ${usd(spendA)} · other ${usd(spendB)}`, "k-orange", "🚀"],
             ["Paper P&L (paper only)", O ? usd(O.paper_pnl) : "n/a", O ? (O.paper_pnl_note || "") : "", "k-red", "🎯"]];
  if (D.business_costs) k.splice(2, 0, ["Monthly burn (both)", usd(D.business_costs.monthly_total) + "/mo", D.business_costs.items.map(x => `${usd(x.monthly)} ${x.item.replace(/^Grok Bot /, "").replace(/ plan/, "")}`).join(" + ") + ` · vs ${usd(rev)} revenue`, "k-red", "🔥"]);
  $("kpis").innerHTML = k.map(([l, v, s, c, i]) => `<div class="kpi ${c}"><div class="l"><span class="ki" aria-hidden="true">${i}</span>${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join("");

  // Deadlines
  const all = (D.key_dates || []).filter(x => !x.account).map(x => ({date: x.date, disp: x.date_display, event: x.event, who: "This account"}))
    .concat(O ? O.deadlines.filter(x => x.date_iso).map(x => ({date: x.date_iso, disp: x.date, event: x.event + (x.details ? " — " + x.details : ""), who: "Other bots"})) : [])
    .sort((a, b) => a.date.localeCompare(b.date));
  const soon = all.filter(x => x.date >= todayPT && x.date <= horizon), later = all.filter(x => x.date > horizon);
  const dl = r => `<div class="item"><div style="min-width:92px"><b>${esc(r.disp)}</b></div><div style="flex:1"><div class="x">${esc(r.event)}</div><div class="w">${esc(r.who)}</div></div></div>`;
  $("deadlines").innerHTML = (soon.length ? soon.map(dl).join("") : `<p class="empty">Nothing due in the next 14 days</p>`) +
    (later.length ? `<details class="more"><summary>Later (${later.length})</summary>${later.map(dl).join("")}</details>` : "");

  // To-dos
  const mine = D.needs_joshua.filter(n => !n.bot_work).map(n => ({...n, who: "This account"}));
  const theirs = O ? O.needs_joshua.map(n => ({...n, who: "Other bots"})) : [];
  const open = mine.concat(theirs).filter(n => !n.done);
  const pr = {high: 0, medium: 1, low: 2};
  const core = open.filter(n => !n.optional).sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || ((a.rank || 99) - (b.rank || 99)) || (pr[a.priority || "medium"] - pr[b.priority || "medium"]));
  const opt = open.filter(n => n.optional);
  const td = n => `<div class="item"><div>⬜</div><div style="flex:1"><div class="x"><b>${n.rank ? `#${n.rank} · ` : ""}${esc(n.task.replace(/^Optional(ly)?:?\s*/i, ""))}</b></div><div class="w">${esc(n.who)}</div></div></div>`;
  $("todos").innerHTML = (core.length ? core.map(td).join("") : `<p class="empty">No core to-dos 🎉</p>`) +
    (opt.length ? `<details class="more"><summary>Optional (${opt.length})</summary>${opt.map(td).join("")}</details>` : "");

  // Decisions (both accounts)
  const decs = (D.decisions_pending || []).map(x => ({...x, who: "This account"})).concat(O ? (O.decisions_pending || []).map(x => ({...x, who: "Other bots"})) : []);
  if (decs.length) {
    $("decSec").hidden = false;
    $("decisions").innerHTML = decs.map(x => `<div class="item"><div>🤔</div><div style="flex:1"><div class="x"><b>${esc(x.decision)}</b></div><div class="w">${esc(x.who)} · ${esc(x.lane || "")}${x.note ? " · " + esc(x.note) : ""}</div></div></div>`).join("");
  }

  // Shops & sites
  const line = (name, status, txt, who) => `<div class="item"><div style="flex:1"><div class="x"><b>${esc(name)}</b> <span class="muted">· ${esc(who)}</span></div><div class="w">${esc(txt)}</div></div><div>${pill(status)}</div></div>`;
  const rows = D.shops.map(s => line(s.name, s.status, s.one_liner || `${s.listings_live} listings · ${s.orders} orders`, "This account"))
    .concat((D.projects || []).map(p => line(p.name, p.status, p.one_liner || p.type, "This account")))
    .concat(O ? O.shops.map(s => line(s.name, s.status, s.one_liner || s.note, "Other bots")) : []);
  $("shops").innerHTML = rows.join("");

  // Bills
  const bills = (D.recurring_bills || []).map(b => ({...b, who: "This account"})).concat(O ? O.bills.map(b => ({...b, who: "Other bots"})) : []);
  $("bills").innerHTML = bills.length ? bills.map(r => `<div class="item"><div style="flex:1"><div class="x"><b>${esc(r.item)}</b> <span class="muted">· ${esc(r.who)}</span></div><div class="w">${esc(r.amount)} · ${esc(r.when)}</div></div></div>`).join("") : `<p class="empty">No bills recorded</p>`;
  if (O && O.combined_ads_note) $("adsNote").textContent = O.combined_ads_note;

  // Traffic tiles (views / visits / impressions) from traffic_sources + traffic_history
  const TS = D.traffic_sources || [], TH = D.traffic_history || [];
  if (TS.length) {
    const shortDate = iso => new Date(iso).toLocaleString("en-US", {timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}) + " PT";
    const series = (id, m) => TH.filter(r => r.source === id && r.metric === m).sort((a, b) => a.date.localeCompare(b.date));
    const delta = s => s.length > 1 ? s[s.length - 1].value - s[s.length - 2].value : null;
    const dtxt = (v, s) => v == null ? "first reading" : `${v > 0 ? "▲ +" : v < 0 ? "▼ " : "± "}${v.toLocaleString()} vs ${shortDate(s[s.length - 2].date)}`;
    const spark = s => {
      if (s.length < 2) return "";
      const w = 90, h = 24, vals = s.map(r => +r.value), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
      const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / span * (h - 4)).toFixed(1)}`).join(" ");
      return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    };
    let total = 0, totalPrev = 0, totalHasPrev = false, inc = 0;
    const colors = ["k-teal", "k-mint", "k-yellow", "k-orange", "k-asphalt", "k-red"];
    const tiles = TS.map((s, i) => {
      const p = series(s.id, s.primary), q = s.secondary ? series(s.id, s.secondary) : [];
      const head = `<div class="l">${esc(s.name)}</div>`;
      if (!p.length) return `<div class="kpi ${colors[i % colors.length]} tr-off">${head}<div class="v tr-na">${esc(s.status === "relayed manually" ? "no data yet" : "not tracked yet")}</div><div class="s">${esc(s.account)}${s.status === "relayed manually" ? " · relayed manually" : ""}</div></div>`;
      const last = p[p.length - 1], d = delta(p);
      inc++; total += +last.value; if (d != null) { totalPrev += +p[p.length - 2].value; totalHasPrev = true; } else totalPrev += +last.value;
      const sec = q.length ? `<div class="s">${(+q[q.length - 1].value).toLocaleString()} ${esc(s.secondary)}${delta(q) != null ? ` (${delta(q) >= 0 ? "+" : ""}${delta(q)})` : ""}</div>` : "";
      return `<div class="kpi ${colors[i % colors.length]}">${head}<div class="v">${(+last.value).toLocaleString()} <small class="tr-m">${esc(s.primary)} · ${esc(last.window)}</small></div>
        <div class="s">${dtxt(d, p)}</div>${sec}${spark(p)}<div class="s tr-asof">as of ${shortDate(last.date)}</div></div>`;
    });
    const tdelta = totalHasPrev ? total - totalPrev : null;
    const totalTile = `<div class="kpi k-asphalt"><div class="l">🌐 Combined total</div><div class="v">${total.toLocaleString()}</div>
      <div class="s">${tdelta == null ? "" : (tdelta > 0 ? "▲ +" : tdelta < 0 ? "▼ " : "± ") + tdelta.toLocaleString() + " vs previous"}</div>
      <div class="s">Includes ${inc} of ${TS.length} sources (each source's main metric)</div></div>`;
    $("traffic").innerHTML = totalTile + tiles.join("");
    const miss = TS.filter(s => !series(s.id, s.primary).length);
    $("trafficMissing").innerHTML = miss.length ? `<details class="more"><summary>Not tracked yet (${miss.length})</summary>${miss.map(s => `<div class="item"><div style="flex:1"><div class="x"><b>${esc(s.name)}</b> <span class="muted">· ${esc(s.account)}</span></div><div class="w">${esc(s.needs)}</div></div></div>`).join("")}</details>` : "";
    $("trafficNote").textContent = "Rolling-window readings (e.g. Etsy views over the last 7 days), recorded only when actually read. Change compares each reading to the one before it.";
  }
});
