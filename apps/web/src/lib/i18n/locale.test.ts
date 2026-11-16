import { describe, expect, it } from "vitest";

import { localeFromAcceptLanguage, pickLocale } from "./locale";

describe("localeFromAcceptLanguage", () => {
  it("is Thai when Thai is preferred", () => {
    expect(localeFromAcceptLanguage("th-TH,th;q=0.9,en;q=0.8")).toBe("th");
    expect(localeFromAcceptLanguage("th")).toBe("th");
  });

  it("is English when English comes first", () => {
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,th;q=0.8")).toBe("en");
  });

  it("goes by quality, not order", () => {
    expect(localeFromAcceptLanguage("en;q=0.5,th;q=0.9")).toBe("th");
  });

  it("skips languages the app does not have", () => {
    expect(localeFromAcceptLanguage("fr-FR,fr;q=0.9,th;q=0.8")).toBe("th");
    expect(localeFromAcceptLanguage("ja,zh;q=0.8")).toBe("en");
  });

  it("is English with no header", () => {
    expect(localeFromAcceptLanguage(null)).toBe("en");
    expect(localeFromAcceptLanguage("")).toBe("en");
  });
});

describe("pickLocale", () => {
  it("prefers the saved choice", () => {
    expect(pickLocale("en", "th-TH")).toBe("en");
    expect(pickLocale("th", "en-US")).toBe("th");
  });

  it("ignores an unknown cookie value", () => {
    expect(pickLocale("fr", "th-TH")).toBe("th");
  });
});
