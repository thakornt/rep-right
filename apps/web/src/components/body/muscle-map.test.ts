// The muscle map must hold every region the app can colour, and only those.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import { expect, test } from "vitest";

import { REGION_COUNT, REGION_IDS } from "./muscles";

const CLOTH_STEP = 32; // the upper bits say shorts or shoes

function regionPixels() {
  const png = fs.readFileSync(path.join(__dirname, "../../../public/models/muscles.png"));
  let at = 8;
  let width = 0;
  const data: Buffer[] = [];
  while (at < png.length) {
    const size = png.readUInt32BE(at);
    const tag = png.toString("latin1", at + 4, at + 8);
    if (tag === "IHDR") width = png.readUInt32BE(at + 8);
    if (tag === "IDAT") data.push(png.subarray(at + 8, at + 8 + size));
    at += 12 + size;
  }
  const raw = zlib.inflateSync(Buffer.concat(data));
  const counts = new Map<number, number>();
  for (let i = 0; i < raw.length; i++) {
    if (i % (width + 1) === 0) continue; // row filter byte
    const region = raw[i] % CLOTH_STEP;
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return counts;
}

test("the map holds every region the app can colour, and no other", () => {
  const counts = regionPixels();
  for (const [name, id] of Object.entries(REGION_IDS)) {
    expect(counts.get(id) ?? 0, name).toBeGreaterThan(1000);
    expect(id).toBeLessThan(REGION_COUNT);
  }
  const known = new Set<number>([0, ...Object.values(REGION_IDS)]);
  expect([...counts.keys()].filter((id) => !known.has(id))).toEqual([]);
});
