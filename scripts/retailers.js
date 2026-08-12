// Retailer configuration for the Bosch Series 6 60cm Built-Under Dishwasher.
// method "fetch"   -> plain HTTP fetch, price pulled from HTML/JSON-LD (see extract.js)
// method "browser" -> rendered with Playwright (Chromium) for JS-heavy pages

export const RETAILERS = [
  {
    name: "Appliances Online",
    model: "SMU6HCS01A",
    url: "https://www.appliancesonline.com.au/product/bosch-serie-6-under-bench-dishwasher-smu6hcs01a/",
    method: "fetch",
  },
  {
    name: "Home Clearance",
    model: "SMU6HCS01A",
    url: "https://www.homeclearance.com.au/p/bosch-serie-6-serie-6-under-bench-dishwasher-smu6hcs01a",
    method: "fetch",
  },
  {
    name: "Home Clearance",
    model: "SMU6HAS01A",
    url: "https://www.homeclearance.com.au/p/bosch-serie-6-serie-6-under-bench-dishwasher-smu6has01a",
    method: "fetch",
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
    method: "fetch",
  },
  {
    name: "Signature Appliances",
    model: "SMU6HCS01A",
    url: "https://www.signatureappliances.com.au/products/serie-6-60cm-built-under-dishwasher-smu6hcs01a",
    method: "fetch",
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
    method: "fetch",
  },
  {
    name: "The Good Guys",
    model: "SMU6HCS01A",
    url: "https://www.thegoodguys.com.au/bosch-series-6-built-under-dishwasher-stainless-steel-smu6hcs01a",
    method: "browser",
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
