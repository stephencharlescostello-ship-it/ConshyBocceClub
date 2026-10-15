// Lighthouse mobile audit against a production build. Usage: npm run build && node scripts/lighthouse.mjs [baseUrl]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? process.env.LH_BASE_URL ?? "http://localhost:3100";
const pages = ["/", "/standings", "/schedule", "/rules", "/events"];
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lighthouse");
fs.mkdirSync(outDir, { recursive: true });

// Prefer Playwright's Chromium so no system Chrome is needed.
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const home = process.env.HOME ?? "";
  const cache = path.join(home, "Library/Caches/ms-playwright");
  try {
    const dirs = fs.readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort();
    for (const d of dirs.reverse()) {
      const mac = path.join(cache, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      const mac2 = path.join(cache, d, "chrome-mac/Chromium.app/Contents/MacOS/Chromium");
      if (fs.existsSync(mac)) return mac;
      if (fs.existsSync(mac2)) return mac2;
    }
  } catch {}
  return undefined;
}
const chrome = findChrome();
const summary = [];
for (const p of pages) {
  const name = p === "/" ? "home" : p.slice(1).replace(/\//g, "_");
  const out = path.join(outDir, `${name}.json`);
  const args = ["lighthouse", `${base}${p}`, "--output=json", "--output=html", `--output-path=${path.join(outDir, name)}`, "--quiet", "--chrome-flags=--headless=new --no-sandbox", "--form-factor=mobile", "--screenEmulation.mobile", "--only-categories=performance,accessibility,best-practices,seo"];
  await new Promise((resolve, reject) => {
    const child = spawn("npx", args, { stdio: "inherit", env: { ...process.env, CHROME_PATH: chrome ?? process.env.CHROME_PATH ?? "" } });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`lighthouse exited ${code} for ${p}`))));
  });
  const report = JSON.parse(fs.readFileSync(out.replace(".json", ".report.json"), "utf8"));
  const cats = report.categories;
  const row = { page: p, performance: Math.round(cats.performance.score * 100), accessibility: Math.round(cats.accessibility.score * 100), bestPractices: Math.round(cats["best-practices"].score * 100), seo: Math.round(cats.seo.score * 100), lcp: report.audits["largest-contentful-paint"].displayValue, installable: report.audits["installable-manifest"]?.score ?? null };
  summary.push(row);
  console.log(row);
}
fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.table(summary);
