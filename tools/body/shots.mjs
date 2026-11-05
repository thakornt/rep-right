// Stills of a 3D exercise page at each view and depth, to look at before showing a
// pose change. Needs the dev server on port 3100, Chrome, and playwright-core:
//   npm --prefix apps/web install --no-save playwright-core
//   node tools/body/shots.mjs hammer-curl out/hc "0,0.5,1"
// HIDE_PINS=1 hides the numbered spots, which can cover a joint.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");

const [slug, prefix, depths = "0,0.5,1"] = process.argv.slice(2);
if (!slug || !prefix) throw new Error("usage: shots.mjs <exercise-slug> <output-prefix> [depths]");
mkdirSync(dirname(prefix), { recursive: true });

const VIEWS = [
  ["ด้านข้าง", "side"],
  ["ด้านหน้า", "front"],
  ["ด้านหลัง", "back"],
  ["เฉียง 45°", "angle"],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 700, height: 1000 }, deviceScaleFactor: 1.5 });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 300)));
await page.goto(`http://localhost:3100/exercises/${slug}`, { waitUntil: "load" });
await page.waitForSelector("canvas", { timeout: 60000 });
await page.waitForTimeout(3000);
await page.click('button[aria-label="หยุด"]');
if (process.env.HIDE_PINS) await page.addStyleTag({ content: 'button[aria-label^="จุดจัดท่า"]{display:none!important}' });
for (const depth of depths.split(",")) {
  for (const [label, name] of VIEWS) {
    await page.locator('input[type="range"]').fill(depth);
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(1200);
    await page.locator("canvas").screenshot({ path: `${prefix}_${name}_${depth}.png` });
  }
}
await browser.close();
