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

function currentPricesRows(latest) {
  return latest
    .map((r) => {
      const price = r.price == null
        ? `<span class="price">—</span>`
        : `<span class="price">${fmtPrice(r.price)}</span>`;
      const status = r.price == null
        ? `<span class="badge badge-na">${esc(r.error || "Not found")}</span>`
        : `<span class="badge badge-good">OK</span>`;
      return `<tr>
          <td>${esc(r.retailer)}</td>
          <td>${esc(r.model || "—")}</td>
          <td>${price}</td>
          <td>${status}</td>
          <td>${fmtDate(r.date)}</td>
          <td><a class="link" href="${esc(r.url)}" target="_blank" rel="noopener">View</a></td>
        </tr>`;
    })
    .join("\n");
}

function historyRows(history) {
  const sorted = [...history].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return sorted
    .slice(0, 200) // cap the rendered table — full history still lives in KV/api
    .map(
      (h) => `<tr><td>${fmtDate(h.date)}</td><td>${esc(h.retailer)}</td><td>${esc(h.model || "—")}</td><td>${fmtPrice(h.price)}</td></tr>`
    )
    .join("\n");
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
  th { color:var(--text-dim); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
  tr:last-child td { border-bottom:none; }
  .price { font-weight:600; font-size:15px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:600; }
  .badge-good { background:rgba(62,207,142,.15); color:var(--good); }
  .badge-na { background:rgba(154,161,172,.12); color:var(--text-dim); }
  .note { color:var(--text-dim); font-size:13px; line-height:1.6; }
  .footer { color:var(--text-dim); font-size:12px; text-align:center; margin-top:24px; }
  a.link { color:var(--accent); text-decoration:none; font-size:12px; }
  a.link:hover { text-decoration:underline; }
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
    <table>
      <thead><tr><th>Retailer</th><th>Model</th><th>Price</th><th>Status</th><th>Last checked</th><th>Link</th></tr></thead>
      <tbody>${latest.length ? currentPricesRows(latest) : `<tr><td colspan="6" class="note">No data yet — trigger a check via /api/run or wait for the next scheduled run.</td></tr>`}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Price History Log</h2>
    <table>
      <thead><tr><th>Date</th><th>Retailer</th><th>Model</th><th>Price</th></tr></thead>
      <tbody>${history.length ? historyRows(history) : `<tr><td colspan="4" class="note">No history yet.</td></tr>`}</tbody>
    </table>
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
    <h2>Notes</h2>
    <div class="note">
      ${low ? `Lowest price found: <strong>${fmtPrice(low.price)} at ${esc(low.retailer)}</strong> (${esc(low.model || "")}, ${fmtDate(low.date)}).<br><br>` : ""}
      <strong>The Good Guys and Harvey Norman</strong> are checked with a real Chromium browser via Playwright (their prices only render via client-side JS).<br><br>
      Price extraction is best-effort — see <code>scripts/extract.js</code>. Run <code>node scripts/check-prices.mjs</code> locally and check the console output to see what each retailer's check actually found.<br><br>
      Last automated run: <strong>${lastRun ? new Date(lastRun.ranAt).toLocaleString("en-AU", { timeZone: "Australia/Brisbane" }) + " (Brisbane time)" : "never"}</strong>.
    </div>
  </div>

  <div class="footer">Bosch Series 6 Built-Under Dishwasher Price Tracker · GitHub Actions + GitHub Pages</div>
</div>

<script>
var priceData = ${JSON.stringify(chartData)};
var seriesColors = ${JSON.stringify(colorFor)};

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
