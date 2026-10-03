// Shared helpers for other-bots.html and combined.html (index.html uses app.js on its own).
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const usd = n => (n < 0 ? "-$" : "$") + Math.abs(+n || 0).toLocaleString("en-US", {minimumFractionDigits: 0, maximumFractionDigits: 2});
const pill = s => `<span class="pill ${esc(String(s).replace(/\s+/g, "").toLowerCase())}">${esc(s)}</span>`;
const sum = (a, k) => a.reduce((t, x) => t + (+x[k] || 0), 0);
const table = (el, cols, rows, empty) => {
  if (!rows.length) { $(el).innerHTML = `<tr><td class="empty">${empty}</td></tr>`; return; }
  $(el).className = "stack";
  $(el).innerHTML = `<thead><tr>${cols.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr>${cols.map(c => `<td data-l="${c[0]}"><span class="cv">${c[1](r)}</span></td>`).join("")}</tr>`).join("") + "</tbody>";
};
function fmtPT(iso) {
  return new Date(iso).toLocaleString("en-US", {timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"}) + " PT";
}
const todoItem = (n, pr) => `<div class="item ${n.done ? "done" : ""}"><div>${n.done ? "✅" : "⬜"}</div><div style="flex:1"><div class="x"><b>${esc(n.task)}</b></div><div class="w">${esc(n.why)}</div></div><div>${pill(n.done ? "done" : pr)}</div></div>`;
function loadData(render) {
  fetch("data.json?t=" + Date.now()).then(r => r.json()).then(render).catch(e => {
    console.warn(e); const u = $("updated"); if (u) u.textContent = "Could not load data.json (open via a web server, not file://)";
  });
}
