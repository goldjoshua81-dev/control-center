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
             ["Paper P&L", O ? usd(O.paper_pnl) : "n/a", O ? (O.paper_pnl_note || "") : "", "k-red", "🎯"]];
  $("kpis").innerHTML = k.map(([l, v, s, c, i]) => `<div class="kpi ${c}"><div class="l"><span class="ki" aria-hidden="true">${i}</span>${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join("");

  // Deadlines
  const all = (D.key_dates || []).map(x => ({date: x.date, disp: x.date_display, event: x.event, who: "This account"}))
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
  const core = open.filter(n => !n.optional).sort((a, b) => ({high: 0, medium: 1, low: 2}[a.priority || "medium"] - {high: 0, medium: 1, low: 2}[b.priority || "medium"]));
  const opt = open.filter(n => n.optional);
  const td = n => `<div class="item"><div>⬜</div><div style="flex:1"><div class="x"><b>${esc(n.task.replace(/^Optional(ly)?:?\s*/i, ""))}</b></div><div class="w">${esc(n.who)}</div></div></div>`;
  $("todos").innerHTML = (core.length ? core.map(td).join("") : `<p class="empty">No core to-dos 🎉</p>`) +
    (opt.length ? `<details class="more"><summary>Optional (${opt.length})</summary>${opt.map(td).join("")}</details>` : "");

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
});
