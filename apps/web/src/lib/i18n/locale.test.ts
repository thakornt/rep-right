import { describe, expect, it } from "vitest";

import { pickLocale } from "./locale";

describe("pickLocale", () => {
  it("is Thai when the visitor has not picked a language", () => {
    expect(pickLocale(undefined)).toBe("th");
    expect(pickLocale(null)).toBe("th");
  });

  it("keeps the saved choice", () => {
    expect(pickLocale("en")).toBe("en");
    expect(pickLocale("th")).toBe("th");
  });

  it("ignores an unknown cookie value", () => {
    expect(pickLocale("fr")).toBe("th");
  });
});
