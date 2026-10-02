const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const usd = n => (n < 0 ? "-$" : "$") + Math.abs(+n || 0).toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 2});
const pct = n => isFinite(n) ? (n * 100).toFixed(1) + "%" : "n/a";
const pill = s => `<span class="pill ${esc(String(s).replace(/\s+/g, "").toLowerCase())}">${esc(s)}</span>`;
const sum = (a, k) => a.reduce((t, x) => t + (+x[k] || 0), 0);
const table = (el, cols, rows, empty) => {
  if (!rows.length) { $(el).innerHTML = `<tr><td class="empty">${empty}</td></tr>`; return; }
  $(el).className = "stack";
  $(el).innerHTML = `<thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr>${cols.map(c => `<td data-l="${c[0]}"><span class="cv">${c[1](r)}</span></td>`).join("")}</tr>`).join("") + "</tbody>";
};
function fmtPT(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"}) + " PT";
}
function render(D) {
  document.title = D.meta.title; $("title").textContent = D.meta.title;
  $("updated").textContent = "Last updated: " + fmtPT(D.meta.last_updated) + " · run by " + D.meta.assistant;
  if (D.meta.status_note) { $("statusNote").hidden = false; $("statusNote").textContent = D.meta.status_note; }
  const shops = D.shops, ads = D.ads, budget = D.budget.starting_capital;
  const deployed = sum(D.budget.ledger, "amount");
  const rev = sum(shops, "revenue"), profit = sum(shops, "profit"), orders = sum(shops, "orders");
  const adSpend = sum(ads, "spend"), adRev = sum(ads, "attributed_revenue");
  const live = shops.filter(s => s.status === "live").length;
  const reserve = budget - deployed + profit;
  const k = [
    ["Total revenue", usd(rev), `${orders} orders`],
    ["Net profit", usd(profit), "after product cost, fees & ads"],
    ["Capital deployed", usd(deployed), `of ${usd(budget)} budget`],
    ["Cash reserve", usd(reserve), "budget − deployed + profit"],
    ["Ad ROAS", adSpend ? (adRev / adSpend).toFixed(2) + "x" : "n/a", `${usd(adSpend)} spent`],
    ["Shops live", `${live} / ${shops.length}`, live ? "" : "not live yet"],
  ];
  const kc = [["k-yellow", "💵"], ["k-teal", "📈"], ["k-orange", "🚀"], ["k-asphalt", "🏦"], ["k-red", "🎯"], ["k-mint", "🏪"]];
  $("kpis").innerHTML = k.map(([l, v, s], i) => `<div class="kpi ${kc[i][0]}"><div class="l"><span class="ki" aria-hidden="true">${kc[i][1]}</span>${l}</div><div class="v">${v}</div><div class="s">${esc(s)}</div></div>`).join("");
  $("capLabel").textContent = `${usd(deployed)} / ${usd(budget)} (${pct(deployed / budget)})`;
  $("capBar").style.width = Math.min(100, deployed / budget * 100) + "%";
  $("alloc").innerHTML = "Planned split: " + D.budget.planned_allocation.map(a => `<span>${esc(a.lane)}: <b>${usd(a.amount)}</b></span>`).join("");

  $("shops").innerHTML = shops.map(s => {
    const conv = s.visits ? pct(s.orders / s.visits) : "n/a";
    const top = s.top_products?.length ? "<ol>" + s.top_products.map(p => `<li>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a>` : esc(p.name)}${p.price ? ` · ${esc(p.price)}` : ""}${p.orders != null ? ` (${p.orders} orders)` : ""}${p.section ? ` · ${esc(p.section)}` : ""}</li>`).join("") + "</ol>" : `<p class="empty">No sales yet</p>`;
    return `<div class="card shop"><div class="row between"><h3>${esc(s.name)}</h3>${pill(s.status === "live" ? "live" : s.status)}</div>
      <div class="t">${esc(s.type)} · ${esc(s.platform)}${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener">open</a>` : ""}</div>
      <div class="muted">${esc(s.status_note || "")}</div>
      <div class="stats"><div><b>${s.orders}</b><small>Orders</small></div><div><b>${usd(s.revenue)}</b><small>Revenue</small></div><div><b>${usd(s.profit)}</b><small>Profit</small></div>
      <div><b>${(s.views||0).toLocaleString()}</b><small>Views</small></div><div><b>${(s.visits||0).toLocaleString()}</b><small>Visits</small></div><div><b>${conv}</b><small>Conversion</small></div></div>
      <div class="muted">Listings: ${s.listings_live} live / ${s.listings_drafted} drafted</div><b style="font-size:13px">${s.id === "printplz" ? "Active Etsy listings (Shop Manager)" : "Top products"}</b>${top}</div>`;
  }).join("");

  const projects = D.projects || [];
  $("projects").innerHTML = projects.map(p => `<div class="card shop"><div class="row between"><h3>${esc(p.name)}</h3>${pill(p.status)}</div>
    <div class="t">${esc(p.type)}${p.url ? ` · <a href="${esc(p.url)}" target="_blank" rel="noopener">open</a>` : ""}</div>
    <div class="muted">${esc(p.status_note || "")}</div>
    ${p.pages != null ? `<div class="stats"><div><b>${p.pages}</b><small>Pages</small></div><div><b>${p.calculators}</b><small>Calculators</small></div><div><b>${p.gift_guides}</b><small>Gift guides</small></div><div><b>${p.fee_explainers}</b><small>Fee explainers</small></div><div><b>${p.pins_ready}</b><small>Pins ready</small></div>${p.pins_published != null ? `<div><b>${p.pins_published}</b><small>Pins published</small></div>` : ""}</div>` : ""}
    ${p.budget_limit ? `<div class="muted">Daily research budget: ${esc(p.budget_limit)}</div>` : ""}</div>`).join("");

  table("ads", [["Channel", r => esc(r.channel)], ["Status", r => pill(r.status)], ["Spend", r => usd(r.spend)], ["Revenue", r => usd(r.attributed_revenue)], ["Orders", r => r.orders], ["ROAS", r => r.spend ? (r.attributed_revenue / r.spend).toFixed(2) + "x" : "n/a"]], ads, "No ad channels yet");
  table("exps", [["Niche / test", r => `<b>${esc(r.name)}</b><div class="muted">${esc(r.note)}</div>`], ["Shop", r => esc(r.shop)], ["Listings", r => r.listings], ["Status", r => pill(r.status)], ["Result", r => r.result ? esc(r.result) : '<span class="empty">no data yet</span>']], D.experiments, "No experiments yet");
  $("acqNote").textContent = D.acquisitions.note + " Source: " + D.acquisitions.source + ".";
  table("acq", [["Asset", r => r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)], ["Price", r => esc(r.price)], ["Listed profit", r => esc(r.listed_profit)], ["Closes", r => esc(r.closes)], ["Fits $5k?", r => r.fits_budget ? "✅ yes" : "no"], ["Status", r => pill(r.status)]], D.acquisitions.watchlist, "Watchlist empty");
  table("ledger", [["Date", r => esc(r.date)], ["What", r => esc(r.what)], ["Lane", r => esc(r.lane || "")], ["Amount", r => usd(r.amount)]], D.budget.ledger, "$0 spent so far");

  const needs = D.needs_joshua.slice().sort((a, b) => a.done - b.done);
  $("needs").innerHTML = needs.length ? needs.map(n => `<div class="item ${n.done ? "done" : ""}"><div>${n.done ? "✅" : "⬜"}</div><div style="flex:1"><div class="x"><b>${esc(n.task)}</b></div><div class="w">${esc(n.why)}</div></div><div>${pill(n.done ? "done" : n.priority)}</div></div>`).join("") : `<p class="empty">Nothing needed right now 🎉</p>`;
}
fetch("data.json?t=" + Date.now()).then(r => r.json()).then(render).catch(e => {
  $("updated").textContent = "Could not load data.json. Open via a web server (python3 -m http.server), not file://";
});
