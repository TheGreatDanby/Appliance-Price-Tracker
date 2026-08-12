// Best-effort price extraction from a retailer page's HTML (or rendered text).
//
// IMPORTANT: these are heuristics, not per-site selectors — no two of these
// eleven sites use the same markup, and this file was written without being
// able to run it live against each one from inside the build sandbox. Expect
// to tune extractFromHtml/extractFromText after the first real Worker runs —
// call the site with ?debug=1 (see src/index.js) to see exactly what each
// strategy found and why one won or lost, then adjust here.

const PRICE_MIN = 400;   // sanity floor — ignore accessory/warranty-plan prices
const PRICE_MAX = 3000;  // sanity ceiling — ignore unrelated big-ticket items

function toNumber(str) {
  const n = parseFloat(String(str).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function inRange(n) {
  return typeof n === "number" && n >= PRICE_MIN && n <= PRICE_MAX;
}

// Strategy 1: JSON-LD structured data (<script type="application/ld+json">).
// Most e-commerce platforms (Shopify, Magento, custom carts) emit this —
// it's the most reliable source when present.
function extractFromJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates = [];
  for (const [, raw] of blocks) {
    let data;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    const nodes = Array.isArray(data) ? data : [data];
    for (const node of nodes) walkForPrice(node, candidates);
  }
  return candidates;
}

function walkForPrice(node, out, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return;
  if ("price" in node) {
    const n = toNumber(node.price);
    if (inRange(n)) out.push(n);
  }
  if ("lowPrice" in node) {
    const n = toNumber(node.lowPrice);
    if (inRange(n)) out.push(n);
  }
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (val && typeof val === "object") walkForPrice(val, out, depth + 1);
  }
}

// Strategy 2: common meta tags (Open Graph / microdata).
function extractFromMeta(html) {
  const candidates = [];
  const metaPatterns = [
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.,]+)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([\d.,]+)["']/i,
    /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([\d.,]+)["']/i,
  ];
  for (const re of metaPatterns) {
    const m = html.match(re);
    if (m) {
      const n = toNumber(m[1]);
      if (inRange(n)) candidates.push(n);
    }
  }
  return candidates;
}

// Strategy 3: raw "$1,234" / "$1234.00" text scan, filtered to a sane range.
// Used as a last resort — and the only option for rendered browser text,
// which has no HTML/JSON-LD to parse.
function extractFromText(text) {
  // Matches "$1299", "$1,299", "$1,299.00" — sites are inconsistent about
  // thousands separators (The Good Guys/Harvey Norman show "$1299" with none).
  const matches = [...text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{2})?)/g)];
  const candidates = matches
    .map((m) => toNumber(m[1]))
    .filter(inRange);
  return candidates;
}

// Combine strategies for a fetched HTML page. Prefers structured data,
// falls back to meta tags, falls back to the lowest sane dollar figure
// found in the raw text (page prices are usually the most prominent/first
// large figure; "lowest in range" tends to dodge inflated "was" prices that
// sit right next to the real one).
export function extractPriceFromHtml(html) {
  const jsonLd = extractFromJsonLd(html);
  if (jsonLd.length) return { price: Math.min(...jsonLd), source: "json-ld", candidates: jsonLd };

  const meta = extractFromMeta(html);
  if (meta.length) return { price: Math.min(...meta), source: "meta", candidates: meta };

  // Strip script/style blocks so the text scan doesn't pick up JSON blobs.
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = stripped.replace(/<[^>]+>/g, " ");
  const textMatches = extractFromText(text);
  if (textMatches.length) return { price: Math.min(...textMatches), source: "text-scan", candidates: textMatches };

  return { price: null, source: "none", candidates: [] };
}

// For Browser-Rendering pages: pass in page.evaluate(() => document.body.innerText).
export function extractPriceFromRenderedText(text) {
  const candidates = extractFromText(text);
  if (!candidates.length) return { price: null, source: "none", candidates: [] };
  // The visible price is usually the first sane figure near the top of the
  // page (before the Afterpay/Zip installment breakdown further down).
  return { price: candidates[0], source: "rendered-text", candidates };
}

// For "click a price-beat/reveal-price widget, then read the modal" flows
// (e.g. The Good Guys' "Price Check: Pay Less with PRICE BEAT"). Looks for
// the specific "YOU WILL PAY $X" phrasing first since that page also shows
// an unrelated "Lowest monitored online price today $Y" figure right next
// to it — falls back to the general text scan if that phrase isn't found.
export function extractPriceBeatFromText(text) {
  const m = text.match(/YOU WILL PAY\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
  if (m) {
    const n = toNumber(m[1]);
    if (inRange(n)) return { price: n, source: "price-beat-modal", candidates: [n] };
  }
  return extractPriceFromRenderedText(text);
}
