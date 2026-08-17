// Retailer configuration for the Bosch Series 6 60cm Built-Under Dishwasher.
// method "fetch"   -> plain HTTP fetch, price pulled from HTML/JSON-LD (see extract.js)
// method "browser" -> rendered with Playwright (Chromium) for JS-heavy pages

export const RETAILERS = [
  {
    name: "Appliances Online",
    model: "SMU6HCS01A",
    url: "https://www.appliancesonline.com.au/product/bosch-serie-6-under-bench-dishwasher-smu6hcs01a/",
    method: "browser",
    note: "Moved from fetch to browser rendering on 14 Aug 2026 — a plain fetch was silently failing to find the price on this site (confirmed live: the price is present, so this is a bot-protection/rendering issue on the request side, not a missing price).",
  },
  {
    name: "Home Clearance",
    model: "SMU6HCS01A",
    url: "https://www.homeclearance.com.au/p/bosch-serie-6-serie-6-under-bench-dishwasher-smu6hcs01a",
    method: "browser",
    note: "Moved from fetch to browser rendering on 14 Aug 2026 — this is a JavaScript-rendered page; the price only appears after the page's own JS runs, so a plain fetch of the raw HTML never saw it.",
  },
  {
    name: "Home Clearance",
    model: "SMU6HAS01A",
    url: "https://www.homeclearance.com.au/p/bosch-serie-6-serie-6-under-bench-dishwasher-smu6has01a",
    method: "browser",
    note: "Moved from fetch to browser rendering on 14 Aug 2026 — same JS-rendering reason as the SMU6HCS01A listing above.",
  },
  {
    name: "eBay (AU)",
    model: "SMU6HAS01A",
    url: "https://www.ebay.com.au/itm/285950404503",
    method: "browser",
    note: "Third-party listing — may end/change seller at any time. Uses browser rendering, not plain fetch: eBay was confirmed (12 Aug 2026) to serve no JSON-LD/meta price tags and a stale price in its raw HTML text, different from what a real browser session sees — plain fetch silently pulled the wrong number.",
  },
  {
    name: "Crowdshop",
    model: "SMU6HCS01A",
    url: "https://crowdshop.com.au/bosch-60cm-under-bench-dishwasher-smu6hcs01a/",
    method: "fetch",
  },
  {
    name: "e&s",
    model: "SMU6HCS01A",
    url: "https://www.eands.com.au/bosch-smu6hcs01a-serie-6-stainless-steel-built-under-dishwasher",
    method: "fetch",
  },
  {
    name: "Bing Lee",
    model: "SMU6HCS01A",
    url: "https://www.binglee.com.au/products/bosch-smu6hcs01a-60cm-built-under-dishwasher",
    method: "browser",
    note: "Moved from fetch to browser rendering on 14 Aug 2026 — a plain fetch was getting HTTP 403 (bot-blocked), confirmed live that the page and price load fine in a real/JS-executing browser.",
  },
  {
    name: "Signature Appliances",
    model: "SMU6HCS01A",
    url: "https://www.signatureappliances.com.au/products/serie-6-60cm-built-under-dishwasher-smu6hcs01a",
    method: "browser",
    note: "Moved from fetch to browser rendering on 14 Aug 2026 — a plain fetch was getting HTTP 403 (bot-blocked), confirmed live that the page and price load fine in a real/JS-executing browser.",
  },
  {
    name: "Rick Hart Outlet",
    model: "SMU6HCS01A",
    url: "https://rickhartoutlet.com.au/products/bosch-serie-6-built-under-dishwasher-smu6hcs01a",
    method: "fetch",
    note: "Despite the 'Outlet' branding this has been brand-new stock, not a factory second — re-verify condition each run.",
  },
  {
    name: "Berloni Appliances",
    model: "SMU6HAS01A",
    url: "https://www.berloniappliances.com.au/bosch-60cm-stainless-steel-built-under-dishwasher-series-6-smu6has01a/",
    method: "fetch",
  },
  {
    name: "Winnings Appliances",
    model: "SMU6HCS01A",
    url: "https://www.winnings.com.au/p/bosch-serie-6-serie-6-under-bench-dishwasher-smu6hcs01a",
    method: "browser",
    note: "Moved from fetch to browser rendering on 17 Aug 2026 — confirmed the raw HTML has zero price text (fully client-rendered), which is why it was returning 'price not found' despite the price being visible on the live page. (It was already listed as browser-rendered in the dashboard notes text, but the retailer config here was never actually updated to match — this closes that gap.)",
  },
  {
    name: "The Good Guys",
    model: "SMU6HCS01A",
    url: "https://www.thegoodguys.com.au/bosch-series-6-built-under-dishwasher-stainless-steel-smu6hcs01a",
    method: "browser",
  },
  {
    name: "The Good Guys (Price Beat)",
    model: "SMU6HCS01A",
    url: "https://www.thegoodguys.com.au/bosch-series-6-built-under-dishwasher-stainless-steel-smu6hcs01a",
    method: "unavailable",
    note: "The Good Guys removed the click-to-reveal 'PRICE BEAT' modal from this product page (confirmed 14 Aug 2026) — it's now a 'SEEN IT CHEAPER? call 1300 942 765' phone-in guarantee instead, which can't be checked automatically. This row is kept so a human can call and compare, rather than showing a stale/misleading auto-checked price.",
  },
  {
    name: "Harvey Norman",
    model: "SMU6HCS01A",
    url: "https://www.harveynorman.com.au/bosch-60cm-series-6-built-under-dishwasher-with-home-connect-stainless-steel.html",
    method: "browser",
  },
  // JB Hi-Fi doesn't stock this built-under model as of Aug 2026 — kept here
  // (method "search") so the dashboard shows it and a human can re-check;
  // the worker doesn't attempt to auto-resolve a product URL for it.
  {
    name: "JB Hi-Fi",
    model: null,
    url: "https://www.jbhifi.com.au/collections/bosch-dishwashers",
    method: "unavailable",
    note: "Doesn't stock the built-under model — only Series 6 freestanding, as of last check.",
  },
];

// Fixed categorical hue order — validated CVD-safe adjacent sequence.
// Assign in this order as new series appear; never reorder or cycle.
export const CHART_PALETTE = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
];
