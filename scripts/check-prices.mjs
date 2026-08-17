// Runs the daily price check: fetch-based retailers concurrently, then
// Playwright (Chromium) sequentially for the JS-rendered ones. Writes
// results to data/*.json, which the GitHub Actions workflow then commits.

import { readFile, writeFile, mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { RETAILERS } from "./retailers.js";
import { extractPriceFromHtml, extractPriceFromRenderedText, extractPriceBeatFromText, looksLikeBotChallenge } from "./extract.js";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const historyPath = dataDir + "history.json";
const latestPath = dataDir + "latest.json";
const lastRunPath = dataDir + "last-run.json";
const lastDropsPath = dataDir + "last-drops.json";

function brisbaneNow(offsetHours = 10) {
  // Brisbane is UTC+10 year-round (no DST) — shift so the ISO getters below
  // read as Brisbane wall-clock regardless of what UTC moment this runs at.
  return new Date(Date.now() + offsetHours * 3600 * 1000);
}

function todayISO() {
  return brisbaneNow().toISOString().slice(0, 10);
}

function nowHHMM() {
  return brisbaneNow().toISOString().slice(11, 16);
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

async function checkBrowserRetailer(retailer, context) {
  const page = await context.newPage();
  try {
    await page.goto(retailer.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000); // let late-rendering price widgets settle

    let text = await page.evaluate(() => document.body.innerText);
    let result = extractPriceFromRenderedText(text, retailer.model);

    // Some sites (JS-heavy carts, bot-checked pages) render the real price
    // widget on a delay after networkidle fires — give it one more beat
    // before giving up, rather than reporting a false "not found".
    if (result.price == null) {
      await page.waitForTimeout(2500);
      text = await page.evaluate(() => document.body.innerText);
      result = extractPriceFromRenderedText(text, retailer.model);
    }

    if (result.price == null && looksLikeBotChallenge(text)) {
      return { ...retailer, price: null, error: "blocked by bot-protection challenge page" };
    }

    return { ...retailer, price: result.price, source: result.source };
  } catch (err) {
    return { ...retailer, price: null, error: String(err) };
  } finally {
    await page.close();
  }
}

// Same as checkBrowserRetailer, but clicks a reveal-price element first
// (e.g. The Good Guys' "Price Check: Pay Less with PRICE BEAT" modal) and
// reads the price out of whatever that click reveals.
async function checkBrowserClickRetailer(retailer, context) {
  const page = await context.newPage();
  try {
    await page.goto(retailer.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    const clickTarget = page.getByText(retailer.clickText, { exact: false }).first();
    await clickTarget.click({ timeout: 10000 });
    await page.waitForTimeout(1200); // let the modal/panel render

    const text = await page.evaluate(() => document.body.innerText);
    const result = extractPriceBeatFromText(text);
    return { ...retailer, price: result.price, source: result.source };
  } catch (err) {
    return { ...retailer, price: null, error: String(err) };
  } finally {
    await page.close();
  }
}

async function main() {
  const date = todayISO();
  const time = nowHHMM();
  const checkable = RETAILERS.filter((r) => r.method === "fetch" || r.method === "browser" || r.method === "browser-click");
  const fetchRetailers = checkable.filter((r) => r.method === "fetch");
  const browserRetailers = checkable.filter((r) => r.method === "browser");
  const browserClickRetailers = checkable.filter((r) => r.method === "browser-click");

  console.log(`Checking ${fetchRetailers.length} fetch retailers + ${browserRetailers.length} browser retailers + ${browserClickRetailers.length} click-through retailers for ${date}...`);

  const fetchResults = await Promise.all(fetchRetailers.map(checkFetchRetailer));

  let browserResults = [];
  let browserClickResults = [];
  if (browserRetailers.length || browserClickRetailers.length) {
    // A handful of retailer sites (eBay, Harvey Norman, Bing Lee, Signature
    // Appliances) sit behind bot-protection that treats default headless
    // Chromium differently from a normal browser session. These launch args
    // + context settings mimic a real desktop Chrome session more closely —
    // not foolproof against sophisticated bot-scoring (eBay in particular
    // may still occasionally block), but it's the best a static GitHub
    // Actions runner can do without a paid unblocking proxy.
    const browser = await chromium.launch({
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1366, height: 900 },
      locale: "en-AU",
      timezoneId: "Australia/Brisbane",
      extraHTTPHeaders: { "Accept-Language": "en-AU,en;q=0.9" },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    for (const r of browserRetailers) {
      browserResults.push(await checkBrowserRetailer(r, context));
    }
    for (const r of browserClickRetailers) {
      browserClickResults.push(await checkBrowserClickRetailer(r, context));
    }
    await browser.close();
  }

  const unavailable = RETAILERS.filter((r) => r.method === "unavailable")
    .map((r) => ({ ...r, price: null, error: r.note || "not available from this retailer" }));

  const results = [...fetchResults, ...browserResults, ...browserClickResults, ...unavailable];

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
      latest.push({ retailer: r.name, model: r.model, price: null, url: r.url, date, time, error: r.error || "price not found" });
      console.log(`  ${r.name}: not found (${r.error || "no price"})`);
      continue;
    }

    const prevBest = history
      .filter((h) => h.retailer === r.name && h.model === r.model && h.date < date)
      .reduce((min, h) => (min == null ? h.price : Math.min(min, h.price)), null);

    history.push({ date, retailer: r.name, model: r.model, price: r.price, url: r.url });
    latest.push({ retailer: r.name, model: r.model, price: r.price, url: r.url, date, time });
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
