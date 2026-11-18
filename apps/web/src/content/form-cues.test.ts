import { describe, expect, it } from "vitest";

import { FORM_CUES } from "./form-cues";
import { FORM_CUES_EN, WAYS_FOR_TEST, formCues, localizedWays } from "./form-cues-en";

const THAI = /[฀-๿]/;

describe("English form cues", () => {
  it("cover every exercise with as many points and mistakes as the Thai", () => {
    expect(Object.keys(FORM_CUES_EN).sort()).toEqual(Object.keys(FORM_CUES).sort());
    for (const [slug, th] of Object.entries(FORM_CUES)) {
      const en = FORM_CUES_EN[slug];
      expect(en.cues, slug).toHaveLength(th.cues.length);
      expect(en.mistakes, slug).toHaveLength(th.mistakes.length);
      for (const line of [...en.cues, ...en.mistakes]) expect(line, slug).not.toMatch(THAI);
    }
  });

  it("cover every option on the exercise pages, in the same order", () => {
    for (const [th, en] of WAYS_FOR_TEST) {
      expect(en.map((w) => w.key)).toEqual(th.map((w) => w.key));
      en.forEach((w, i) => {
        expect(w.label).not.toMatch(THAI);
        expect(w.form.cues).toHaveLength(th[i].form.cues.length);
        expect(w.form.mistakes).toHaveLength(th[i].form.mistakes.length);
      });
      expect(localizedWays(th, "th")).toBe(th);
      expect(localizedWays(th, "en")).toBe(en);
    }
  });

  it("pick the language, and nothing for an unknown exercise", () => {
    expect(formCues("crunch", "th")).toBe(FORM_CUES.crunch);
    expect(formCues("crunch", "en")).toBe(FORM_CUES_EN.crunch);
    expect(formCues("no-such-lift", "en")).toBeUndefined();
  });
});
