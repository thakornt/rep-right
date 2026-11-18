import { describe, expect, it } from "vitest";

import { CATEGORIES, EQUIPMENT, MUSCLES, REGIONS, localized, muscleLabel, regionLabel } from "./exercise-groups";

describe("English labels", () => {
  it("exist for every category, muscle, piece of equipment and region", () => {
    for (const list of [CATEGORIES, MUSCLES, EQUIPMENT]) {
      localized(list, "en").forEach(([key, label], i) => {
        expect(key).toBe(list[i][0]);
        expect(label).not.toBe(list[i][1]);
        expect(label).toMatch(/^[\x20-\x7e]+$/);
      });
    }
    for (const [thai] of REGIONS) expect(regionLabel(thai, "en")).toMatch(/^[\x20-\x7e]+$/);
  });

  it("leave the Thai labels as they are", () => {
    expect(localized(MUSCLES, "th")).toBe(MUSCLES);
    expect(muscleLabel("quads", "th")).toBe("ต้นขาหน้า");
    expect(muscleLabel("quads", "en")).toBe("Quads");
  });
});
