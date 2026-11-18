import { describe, expect, it } from "vitest";

import { REGION_LABELS, REGION_LABELS_EN, ROLE_LABELS, ROLE_LABELS_EN } from "./muscles";
import { PRESS_CONTENT } from "./press";
import { PRESS_CONTENT_EN, pressContent } from "./press-en";

const THAI = /[฀-๿]/;

describe("English 3D viewer copy", () => {
  it("covers every exercise with the same parts as the Thai", () => {
    expect(Object.keys(PRESS_CONTENT_EN).sort()).toEqual(Object.keys(PRESS_CONTENT).sort());
    for (const [exercise, th] of Object.entries(PRESS_CONTENT)) {
      const en = PRESS_CONTENT_EN[exercise as keyof typeof PRESS_CONTENT];
      expect(Object.keys(en.cues).sort(), exercise).toEqual(Object.keys(th.cues).sort());
      expect(en.notice, exercise).toHaveLength(th.notice.length);
      expect(Boolean(en.lowering), exercise).toBe(Boolean(th.lowering));
      expect(en.grips?.length, exercise).toBe(th.grips?.length);
      const text = [...Object.values(en.cues), en.top, en.bottom, en.rising, en.lowering ?? "", ...en.notice];
      for (const g of en.grips ?? []) text.push(g.label, g.text);
      for (const line of text) expect(line, exercise).not.toMatch(THAI);
    }
  });

  it("names every muscle region and role in English", () => {
    expect(Object.keys(REGION_LABELS_EN).sort()).toEqual(Object.keys(REGION_LABELS).sort());
    expect(Object.keys(ROLE_LABELS_EN).sort()).toEqual(Object.keys(ROLE_LABELS).sort());
    for (const label of Object.values(REGION_LABELS_EN)) expect(label).not.toMatch(THAI);
  });

  it("picks the language", () => {
    expect(pressContent("crunch", "th")).toBe(PRESS_CONTENT.crunch);
    expect(pressContent("crunch", "en")).toBe(PRESS_CONTENT_EN.crunch);
  });
});
