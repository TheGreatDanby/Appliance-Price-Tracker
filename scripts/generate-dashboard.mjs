import { readFile, writeFile, mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { renderDashboard } from "./dashboard.js";

const dataDir = fileURLToPath(new URL("../data/", import.meta.url));
const docsDir = fileURLToPath(new URL("../docs/", import.meta.url));

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const history = await readJson(dataDir + "history.json", []);
  const latest = await readJson(dataDir + "latest.json", []);
  const lastRun = await readJson(dataDir + "last-run.json", null);

  const html = renderDashboard({ history, latest, lastRun });

  await mkdir(docsDir, { recursive: true });
  await writeFile(docsDir + "index.html", html);
  console.log(`Wrote ${docsDir}index.html (${history.length} history rows, ${latest.length} current readings)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
