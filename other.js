loadData(D => {
  const O = D.other_account;
  $("updated").textContent = "Data as of " + O.as_of + " · page built from data.json (last saved " + fmtPT(D.meta.last_updated) + ")";
  $("oaAsOf").textContent = "Data as of " + O.as_of + ". Not live-synced; it changes only when Joshua relays a new report.";
  $("oaNote").textContent = O.source_note || "";
  const k = [["Revenue", usd(O.revenue), "friend/demo sale excluded", "k-yellow", "💵"], ["Spent", usd(O.spend_total), O.spend_note || "", "k-orange", "🚀"],
             ["Paper P&L", usd(O.paper_pnl), "combined week (approx.)", "k-red", "🎯"], ["Shops live", `${O.shops.filter(s => s.status === "live").length} / ${O.shops.length}`, "", "k-mint", "🏪"]];
  $("oaKpis").innerHTML = k.map(([l, v, s, c, i]) => `<div class="kpi ${c}"><div class="l"><span class="ki" aria-hidden="true">${i}</span>${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join("");
  $("oaShops").innerHTML = O.shops.map(s => `<div class="card shop"><div class="row between"><h3>${esc(s.name)}</h3>${pill(s.status)}</div>
    <div class="t">${esc(s.type)}${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener">open</a>` : ""}</div>
    <div class="muted">${esc(s.note)}</div>${s.listings.length ? "<ol>" + s.listings.map(l => `<li>${esc(l)}</li>`).join("") + "</ol>" : `<p class="empty">No live listings</p>`}</div>`).join("");
  const needs = O.needs_joshua.slice().sort((a, b) => (a.done - b.done) || ((a.optional ? 1 : 0) - (b.optional ? 1 : 0)));
  $("oaNeeds").innerHTML = needs.map(n => todoItem(n, n.optional ? "low" : "medium")).join("");
  $("oaLanesNote").textContent = O.paper_lanes_note || "";
  table("oaLanes", [["Lane", r => `<b>${esc(r.lane)}</b>`], ["Bankroll", r => esc(r.bankroll)], ["Equity", r => esc(r.equity)], ["Note", r => esc(r.note)]], O.paper_lanes, "No lanes reported");
  table("oaDeadlines", [["Date", r => `<b>${esc(r.date)}</b>`], ["Milestone", r => esc(r.event)], ["Details", r => esc(r.details)]], O.deadlines, "No deadlines reported");
  table("oaBills", [["Item", r => esc(r.item)], ["Amount", r => esc(r.amount)], ["When", r => esc(r.when)]], O.bills, "No bills reported");
  $("oaAds").textContent = O.combined_ads_note || "";
});
