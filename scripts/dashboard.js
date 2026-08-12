import { CHART_PALETTE } from "./retailers.js";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtPrice(n) {
  return n == null ? "—" : `$${n.toLocaleString("en-AU")}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function seriesKey(retailer, model) {
  return model ? `${retailer} — ${model}` : retailer;
}

function lowestPrice(history) {
  if (!history.length) return null;
  return history.reduce((min, h) => (min == null || h.price < min.price ? h : min), null);
}

export function renderDashboard({ history, latest, lastRun }) {
  const low = lowestPrice(history);
  const allSeriesNames = [...new Set(history.map((h) => seriesKey(h.retailer, h.model)))];

  // The categorical palette is only validated CVD-safe up to 8 hues in a
  // fixed, non-cycled order — never wrap past that or two series silently
  // get the same color. Past 8, keep the series with the lowest latest
  // price (the ones actually worth watching on a trend line) and fold the
  // rest out of the chart — they're still fully listed in the tables above.
  let seriesNames = allSeriesNames;
  let foldedCount = 0;
  if (allSeriesNames.length > CHART_PALETTE.length) {
    const latestPriceFor = {};
    for (const h of [...history].sort((a, b) => (a.date > b.date ? 1 : -1))) {
      latestPriceFor[seriesKey(h.retailer, h.model)] = h.price;
    }
    seriesNames = [...allSeriesNames]
      .sort((a, b) => (latestPriceFor[a] ?? Infinity) - (latestPriceFor[b] ?? Infinity))
      .slice(0, CHART_PALETTE.length);
    foldedCount = allSeriesNames.length - seriesNames.length;
  }

  const colorFor = {};
  seriesNames.forEach((name, i) => { colorFor[name] = CHART_PALETTE[i]; });

  const chartData = history
    .filter((h) => seriesNames.includes(seriesKey(h.retailer, h.model)))
    .map((h) => ({ date: h.date, series: seriesKey(h.retailer, h.model), price: h.price }));

  // Data for the client-rendered, sortable/foldable Current Prices table.
  const currentPricesData = latest.map((r) => ({
    retailer: r.retailer,
    model: r.model || null,
    price: r.price,
    status: r.price == null ? "N/A" : "OK",
    statusTooltip: r.price == null ? (r.error || "Price not found") : "",
    date: r.date || null,
    time: r.time || null,
    url: r.url || null,
  }));

  // Data for the client-rendered, foldable Price History Log.
  const historyRowsData = [...history]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 500) // sane cap — full history still lives in data/history.json
    .map((h) => ({ date: h.date, retailer: h.retailer, model: h.model || null, price: h.price }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bosch Series 6 Built-Under Dishwasher — Price Tracker</title>
<style>
  :root {
    --bg: #0f1115; --panel: #171a21; --panel-2: #1e222b; --border: #2a2f3a;
    --text: #e8eaed; --text-dim: #9aa1ac; --accent: #4fa3ff;
    --good: #3ecf8e; --bad: #ff6b6b; --neutral: #f2c94c;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; padding:32px 20px 60px; }
  .wrap { max-width:920px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 4px; }
  .subtitle { color:var(--text-dim); font-size:14px; margin-bottom:28px; }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:20px 22px; margin-bottom:18px; }
  .card h2 { font-size:15px; margin:0 0 14px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.04em; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--border); }
  th { color:var(--text-dim); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.03em; white-space:nowrap; }
  tr:last-child td { border-bottom:none; }
  .price { font-weight:600; font-size:15px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
  .badge-good { background:rgba(62,207,142,.15); color:var(--good); }
  .badge-na { background:rgba(154,161,172,.12); color:var(--text-dim); cursor:help; }
  .note { color:var(--text-dim); font-size:13px; line-height:1.6; }
  .footer { color:var(--text-dim); font-size:12px; text-align:center; margin-top:24px; }
  a.link { color:var(--accent); text-decoration:none; font-size:12px; }
  a.link:hover { text-decoration:underline; }

  th.sortable { cursor:pointer; user-select:none; }
  th.sortable:hover { color:var(--text); }
  th.sortable .arrow { display:inline-block; margin-left:4px; opacity:.4; font-size:10px; }
  th.sortable.active .arrow { opacity:1; color:var(--accent); }

  .table-wrap.expanded { max-height:420px; overflow-y:auto; display:block; }
  .table-wrap.expanded table { width:100%; }
  tr.folded { display:none; }
  .fold-toggle {
    display:inline-flex; align-items:center; gap:6px; margin-top:12px;
    background:var(--panel-2); border:1px solid var(--border); color:var(--text);
    font-size:12px; padding:6px 12px; border-radius:999px; cursor:pointer;
  }
  .fold-toggle:hover { border-color:var(--accent); }
  .fold-toggle .chev { transition:transform .15s ease; display:inline-block; }
  .fold-toggle.expanded .chev { transform:rotate(180deg); }

  .viz-root { position:relative; }
  .chart-grid { stroke:#2a2f3a; stroke-width:1; }
  .chart-baseline { stroke:#3a3f4a; stroke-width:1; }
  .chart-tick { fill:var(--text-dim); font-size:11px; }
  .chart-line { fill:none; stroke-width:2; }
  .chart-point { stroke:var(--panel); stroke-width:2; cursor:pointer; }
  .chart-tooltip { position:absolute; pointer-events:none; background:var(--panel-2); border:1px solid var(--border); border-radius:8px; padding:8px 10px; font-size:12px; line-height:1.5; color:var(--text); box-shadow:0 4px 14px rgba(0,0,0,.4); opacity:0; transform:translate(-50%,-110%); transition:opacity .12s; z-index:10; white-space:nowrap; }
  .chart-legend { display:flex; flex-wrap:wrap; gap:12px 18px; margin-top:16px; }
  .chart-legend-item { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--text-dim); }
  .chart-legend-swatch { width:10px; height:10px; border-radius:2px; flex-shrink:0; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Bosch Series 6 Built-Under Dishwasher</h1>
  <div class="subtitle">Daily price watch across major AU retailers · Runs automatically via a scheduled GitHub Actions workflow</div>

  <div class="card">
    <h2>Current Prices</h2>
    <div class="table-wrap" id="current-prices-wrap">
      <table>
        <thead>
          <tr>
            <th class="sortable" data-key="retailer">Retailer<span class="arrow">▲</span></th>
            <th class="sortable" data-key="model">Model<span class="arrow">▲</span></th>
            <th class="sortable" data-key="price">Price<span class="arrow">▲</span></th>
            <th class="sortable" data-key="status">Status<span class="arrow">▲</span></th>
            <th class="sortable" data-key="checked">Last checked<span class="arrow">▲</span></th>
            <th>Link</th>
          </tr>
        </thead>
        <tbody id="current-prices-body"></tbody>
      </table>
    </div>
    <button class="fold-toggle" id="current-prices-toggle" type="button"></button>
  </div>

  <div class="card">
    <h2>Price History Log</h2>
    <div class="table-wrap" id="history-wrap">
      <table>
        <thead><tr><th>Date</th><th>Retailer</th><th>Model</th><th>Price</th></tr></thead>
        <tbody id="history-body"></tbody>
      </table>
    </div>
    <button class="fold-toggle" id="history-toggle" type="button"></button>
  </div>

  <div class="card">
    <h2>Price Trend</h2>
    <div class="viz-root" id="price-chart-root">
      <div id="price-chart"></div>
      <div class="chart-legend" id="price-chart-legend"></div>
    </div>
    <div class="note" style="margin-top:14px;">
      Hover a point for the exact price and date.${foldedCount ? ` Showing the ${seriesNames.length} cheapest retailer/model combinations to keep the chart's colors distinguishable — ${foldedCount} more are tracked in the tables above but folded out of this chart.` : ""}
    </div>
  </div>

  <div class="card">
    <h2>Model Comparison</h2>
    <table>
      <thead><tr><th>Spec</th><th>SMU6HCS01A</th><th>SMU6HAS01A</th></tr></thead>
      <tbody>
        <tr><td>RRP</td><td>$1,799</td><td>$1,599</td></tr>
        <tr><td>Place settings</td><td>15</td><td>15</td></tr>
        <tr><td>Noise level</td><td>44 dB</td><td>44 dB</td></tr>
        <tr><td>Energy rating</td><td>4 stars</td><td>4 stars</td></tr>
        <tr><td>Water rating (WELS)</td><td>5.5 stars</td><td>5.0 stars</td></tr>
        <tr><td>Cutlery tray</td><td>VarioDrawer™ (3rd-level drawer)</td><td>Standard cutlery basket (no drawer)</td></tr>
        <tr><td>Top basket</td><td>RackmaticPlus™ — 3-stage height adjust</td><td>Rackmatic — height adjustable</td></tr>
        <tr><td>Drying</td><td>Heat exchanger + Extra Clean Zone</td><td>Heat exchanger + Extra Dry option + Extra Clean Zone</td></tr>
        <tr><td>Home Connect (Wi-Fi)</td><td>Yes</td><td>Yes</td></tr>
        <tr><td>AquaStop flood protection</td><td>Yes (lifetime)</td><td>Yes (lifetime)</td></tr>
        <tr><td>Finish</td><td>Brushed steel anti-fingerprint</td><td>Brushed steel anti-fingerprint</td></tr>
      </tbody>
    </table>
    <div class="note" style="margin-top:14px;">
      The main real-world difference is the <strong>VarioDrawer cutlery drawer</strong> — SMU6HCS01A has a third-level sliding drawer for cutlery/utensils instead of a basket, and a slightly higher water-efficiency rating (5.5★ vs 5.0★). SMU6HAS01A is the otherwise near-identical, slightly older/cheaper variant without the drawer, which is why its RRP sits about $200 lower. Both are 15-place-setting, Wi-Fi-enabled, 44dB Series 6 built-under models.
    </div>
  </div>

  <div class="card">
    <h2>Notes</h2>
    <div class="note">
      ${low ? `Lowest price found: <strong>${fmtPrice(low.price)} at ${esc(low.retailer)}</strong> (${esc(low.model || "")}, ${fmtDate(low.date)}).<br><br>` : ""}
      <strong>The Good Guys, Harvey Norman, and eBay</strong> are all checked with a real Chromium browser via Playwright rather than a plain fetch. eBay was moved to this method on 12 Aug 2026 after its price was found to be wrong: a plain fetch got no JSON-LD/meta price data and fell back to a stale dollar figure in the raw HTML text ($1,214) that didn't match what a real browser session showed ($1,385 — confirmed live). Earlier eBay readings in the history log predate this fix and may be inaccurate.<br><br>
      Price extraction is best-effort — see <code>scripts/extract.js</code>. Run <code>node scripts/check-prices.mjs</code> locally and check the console output to see what each retailer's check actually found.<br><br>
      Last automated run: <strong>${lastRun ? new Date(lastRun.ranAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " (Brisbane time)" : "never"}</strong>.
    </div>
  </div>

  <div class="footer">Bosch Series 6 Built-Under Dishwasher Price Tracker · GitHub Actions + GitHub Pages</div>
</div>

<script>
var priceData = ${JSON.stringify(chartData)};
var seriesColors = ${JSON.stringify(colorFor)};
var currentPricesData = ${JSON.stringify(currentPricesData)};
var historyRowsData = ${JSON.stringify(historyRowsData)};
var FOLD_COUNT = 3;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function fmtPriceJs(n) { return n == null ? "—" : "$" + n.toLocaleString("en-AU"); }
function fmtDateJs(iso) {
  if (!iso) return "—";
  var d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ---- Current Prices: sortable + foldable (single table, extra rows just hidden) ----
(function () {
  var sort = { key: "price", dir: "asc" };

  function rowHtml(r, folded) {
    var priceHtml = '<span class="price">' + fmtPriceJs(r.price) + '</span>';
    var statusHtml = r.status === "OK"
      ? '<span class="badge badge-good">OK</span>'
      : '<span class="badge badge-na" title="' + esc(r.statusTooltip) + '">N/A</span>';
    var checked = r.date ? fmtDateJs(r.date) + (r.time ? " " + r.time : "") : "—";
    var link = r.url ? '<a class="link" href="' + esc(r.url) + '" target="_blank" rel="noopener">View</a>' : "—";
    return '<tr class="' + (folded ? "folded" : "") + '"><td>' + esc(r.retailer) + "</td><td>" + esc(r.model || "—") + "</td><td>" + priceHtml +
      "</td><td>" + statusHtml + "</td><td>" + checked + "</td><td>" + link + "</td></tr>";
  }

  function sortedRows() {
    var rows = currentPricesData.slice();
    var key = sort.key, dir = sort.dir === "asc" ? 1 : -1;
    rows.sort(function (a, b) {
      var av = a[key], bv = b[key];
      if (key === "checked") { av = (a.date || "") + " " + (a.time || ""); bv = (b.date || "") + " " + (b.time || ""); }
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls always last regardless of direction
      if (bv == null) return -1;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }

  var wrap = document.getElementById("current-prices-wrap");
  var toggle = document.getElementById("current-prices-toggle");

  function render() {
    var rows = sortedRows();
    var restCount = Math.max(0, rows.length - FOLD_COUNT);

    document.getElementById("current-prices-body").innerHTML = rows
      .map(function (r, i) { return rowHtml(r, i >= FOLD_COUNT && !wrap.classList.contains("expanded")); })
      .join("");

    if (!restCount) {
      toggle.style.display = "none";
    } else {
      toggle.style.display = "inline-flex";
      var expanded = wrap.classList.contains("expanded");
      toggle.innerHTML = (expanded ? "Show top " + FOLD_COUNT : "Show all " + rows.length + " (" + restCount + " more)") + ' <span class="chev">▾</span>';
    }

    document.querySelectorAll("th.sortable").forEach(function (th) {
      th.classList.toggle("active", th.dataset.key === sort.key);
      var arrow = th.querySelector(".arrow");
      if (th.dataset.key === sort.key) arrow.textContent = sort.dir === "asc" ? "▲" : "▼";
      else arrow.textContent = "▲";
    });
  }

  document.querySelectorAll("th.sortable").forEach(function (th) {
    th.addEventListener("click", function () {
      var key = th.dataset.key;
      if (sort.key === key) sort.dir = sort.dir === "asc" ? "desc" : "asc";
      else { sort.key = key; sort.dir = "asc"; }
      render();
    });
  });

  toggle.addEventListener("click", function () {
    var expanding = !wrap.classList.contains("expanded");
    wrap.classList.toggle("expanded", expanding);
    toggle.classList.toggle("expanded", expanding);
    render();
  });

  render();
})();

// ---- Price History Log: foldable, newest first (single table) ----
(function () {
  function rowHtml(h, folded) {
    return '<tr class="' + (folded ? "folded" : "") + '"><td>' + fmtDateJs(h.date) + "</td><td>" + esc(h.retailer) + "</td><td>" + esc(h.model || "—") + "</td><td>" + fmtPriceJs(h.price) + "</td></tr>";
  }

  var wrap = document.getElementById("history-wrap");
  var toggle = document.getElementById("history-toggle");
  var restCount = Math.max(0, historyRowsData.length - FOLD_COUNT);

  function render() {
    var expanded = wrap.classList.contains("expanded");
    document.getElementById("history-body").innerHTML = historyRowsData.length
      ? historyRowsData.map(function (h, i) { return rowHtml(h, i >= FOLD_COUNT && !expanded); }).join("")
      : '<tr><td colspan="4" class="note">No history yet.</td></tr>';

    if (!restCount) {
      toggle.style.display = "none";
    } else {
      toggle.style.display = "inline-flex";
      toggle.innerHTML = (expanded ? "Show top " + FOLD_COUNT : "Show all " + historyRowsData.length + " (" + restCount + " more)") + ' <span class="chev">▾</span>';
    }
  }

  toggle.addEventListener("click", function () {
    var expanding = !wrap.classList.contains("expanded");
    wrap.classList.toggle("expanded", expanding);
    toggle.classList.toggle("expanded", expanding);
    render();
  });

  render();
})();

function renderPriceChart() {
  var container = document.getElementById('price-chart');
  var legendEl = document.getElementById('price-chart-legend');
  if (!priceData.length) { container.innerHTML = '<div class="note">No history yet.</div>'; return; }
  var seriesNames = Object.keys(seriesColors);
  var dates = Array.from(new Set(priceData.map(function (d) { return d.date; }))).sort();

  var W = 860, H = 300, padL = 60, padR = 20, padT = 16, padB = 36;
  var plotW = W - padL - padR, plotH = H - padT - padB;

  var prices = priceData.map(function (d) { return d.price; });
  var minP = Math.min.apply(null, prices), maxP = Math.max.apply(null, prices);
  var pad = Math.max(20, (maxP - minP) * 0.2);
  minP = Math.floor((minP - pad) / 10) * 10;
  maxP = Math.ceil((maxP + pad) / 10) * 10;

  function xPos(dateStr) {
    if (dates.length === 1) return padL + plotW / 2;
    var idx = dates.indexOf(dateStr);
    return padL + (idx / (dates.length - 1)) * plotW;
  }
  function yPos(price) { return padT + plotH - ((price - minP) / (maxP - minP)) * plotH; }

  var ticks = 4, gridSvg = '';
  for (var i = 0; i <= ticks; i++) {
    var price = minP + (maxP - minP) * (i / ticks);
    var yy = yPos(price);
    gridSvg += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" class="chart-grid" />';
    gridSvg += '<text x="' + (padL - 8) + '" y="' + (yy + 4) + '" text-anchor="end" class="chart-tick">$' + Math.round(price).toLocaleString() + '</text>';
  }

  var xLabels = '';
  dates.forEach(function (d) {
    var dd = new Date(d + 'T00:00:00');
    xLabels += '<text x="' + xPos(d) + '" y="' + (H - 10) + '" text-anchor="middle" class="chart-tick">' + dd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + '</text>';
  });

  var linesSvg = '', pointsSvg = '';
  seriesNames.forEach(function (name) {
    var color = seriesColors[name];
    var pts = priceData.filter(function (d) { return d.series === name && d.price != null; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (pts.length > 1) {
      var d = pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + ' ' + xPos(p.date) + ' ' + yPos(p.price); }).join(' ');
      linesSvg += '<path d="' + d + '" class="chart-line" style="stroke:' + color + '" />';
    }
    pts.forEach(function (p) {
      pointsSvg += '<circle cx="' + xPos(p.date) + '" cy="' + yPos(p.price) + '" r="5" class="chart-point" style="fill:' + color + '" data-series="' + name + '" data-price="' + p.price + '" data-date="' + p.date + '" />';
    });
  });

  container.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Price trend chart">' +
      gridSvg +
      '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) + '" y2="' + (padT + plotH) + '" class="chart-baseline" />' +
      linesSvg + pointsSvg + xLabels +
    '</svg>' +
    '<div class="chart-tooltip" id="price-chart-tooltip"></div>';

  legendEl.innerHTML = seriesNames.map(function (name) {
    return '<div class="chart-legend-item"><span class="chart-legend-swatch" style="background:' + seriesColors[name] + '"></span>' + name + '</div>';
  }).join('');

  var tooltip = document.getElementById('price-chart-tooltip');
  container.querySelectorAll('.chart-point').forEach(function (pt) {
    pt.addEventListener('mouseenter', function () {
      var rect = container.getBoundingClientRect();
      var scaleX = rect.width / W, scaleY = rect.height / H;
      var cx = parseFloat(pt.getAttribute('cx')), cy = parseFloat(pt.getAttribute('cy'));
      var dateLabel = new Date(pt.dataset.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
      tooltip.innerHTML = '<strong>' + pt.dataset.series + '</strong><br>' + dateLabel + '<br>$' + Number(pt.dataset.price).toLocaleString();
      tooltip.style.left = (cx * scaleX) + 'px';
      tooltip.style.top = (cy * scaleY) + 'px';
      tooltip.style.opacity = '1';
    });
    pt.addEventListener('mouseleave', function () { tooltip.style.opacity = '0'; });
  });
}
renderPriceChart();
</script>
</body>
</html>`;
}
