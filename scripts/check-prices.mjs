// Runs the daily price check: fetch-based retailers concurrently, then
// Playwright (Chromium) sequentially for the JS-rendered ones. Writes
// results to data/*.json, which the GitHub Actions workflow then commits.

import { readFile, writeFile, mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { RETAILERS } from "./retailers.js";
import { extractPriceFromHtml, extractPriceFromRenderedText } from "./extract.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const historyPath = dataDir + "history.json";
const latestPath = dataDir + "latest.json";
const lastRunPath = dataDir + "last-run.json";
const lastDropsPath = dataDir + "last-drops.json";

function todayISO(offsetHours = 10) {
  // Brisbane is UTC+10 year-round (no DST) — stamp with the Brisbane date
  // regardless of what UTC moment the workflow actually runs at.
  const now = new Date(Date.now() + offsetHours * 3600 * 1000);
  return now.toISOString().slice(0, 10);
}

async function checkFetchRetailer(retailer) {
  try {
    const res = await fetch(retailer.url, { headers: { "User-Agent": UA } });
    if (!res.ok) return { ...retailer, price: null, error: `HTTP ${res.status}` };
    const html = await res.text();
    const result = extractPriceFromHtml(html);
    return { ...retailer, price: result.price, source: result.source };
  } catch (err) {
    return { ...retailer, price: null, error: String(err) };
  }
}

async function checkBrowserRetailer(retailer, browser) {
  const page = await browser.newPage({ userAgent: UA });
  try {
    await page.goto(retailer.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500); // let late-rendering price widgets settle
    const text = await page.evaluate(() => document.body.innerText);
    const result = extractPriceFromRenderedText(text);
    return { ...retailer, price: result.price, source: result.source };
  } catch (err) {
    return { ...retailer, price: null, error: String(err) };
  } finally {
    await page.close();
  }
}

async function main() {
  const date = todayISO();
  const checkable = RETAILERS.filter((r) => r.method === "fetch" || r.method === "browser");
  const fetchRetailers = checkable.filter((r) => r.method === "fetch");
  const browserRetailers = checkable.filter((r) => r.method === "browser");

  console.log(`Checking ${fetchRetailers.length} fetch retailers + ${browserRetailers.length} browser retailers for ${date}...`);

  const fetchResults = await Promise.all(fetchRetailers.map(checkFetchRetailer));

  let browserResults = [];
  if (browserRetailers.length) {
    const browser = await chromium.launch();
    for (const r of browserRetailers) {
      browserResults.push(await checkBrowserRetailer(r, browser));
    }
    await browser.close();
  }

  const unavailable = RETAILERS.filter((r) => r.method === "unavailable")
    .map((r) => ({ ...r, price: null, error: r.note || "not available from this retailer" }));

  const results = [...fetchResults, ...browserResults, ...unavailable];

  await mkdir(dataDir, { recursive: true });

  let history = [];
  try {
    history = JSON.parse(await readFile(historyPath, "utf-8"));
  } catch {
    // no history yet — first run
  }

  const latest = [];
  const drops = [];

  for (const r of results) {
    if (r.price == null) {
      latest.push({ retailer: r.name, model: r.model, price: null, url: r.url, date, error: r.error || "price not found" });
      console.log(`  ${r.name}: not found (${r.error || "no price"})`);
      continue;
    }

    const prevBest = history
      .filter((h) => h.retailer === r.name && h.model === r.model && h.date < date)
      .reduce((min, h) => (min == null ? h.price : Math.min(min, h.price)), null);

    history.push({ date, retailer: r.name, model: r.model, price: r.price, url: r.url });
    latest.push({ retailer: r.name, model: r.model, price: r.price, url: r.url, date });
    console.log(`  ${r.name}: $${r.price} (via ${r.source})`);

    if (prevBest != null && r.price < prevBest) {
      drops.push({ retailer: r.name, model: r.model, oldPrice: prevBest, newPrice: r.price, url: r.url });
    }
  }

  await writeFile(historyPath, JSON.stringify(history, null, 2));
  await writeFile(latestPath, JSON.stringify(latest, null, 2));
  await writeFile(lastRunPath, JSON.stringify({ date, ranAt: new Date().toISOString() }, null, 2));
  await writeFile(lastDropsPath, JSON.stringify(drops, null, 2));

  if (drops.length) {
    console.log("\nPRICE DROPS DETECTED:");
    for (const d of drops) console.log(`  ${d.retailer} (${d.model}): $${d.oldPrice} -> $${d.newPrice}`);
  } else {
    console.log("\nNo price drops today.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
