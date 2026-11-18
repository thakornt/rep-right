import { describe, expect, it } from "vitest";

import { FORM_CUES } from "../content/form-cues";
import { EXERCISE_NAMES } from "../content/exercise-names";
import { exerciseCopy, pageMeta, siteUrl } from "../lib/seo";
import robots from "./robots";
import sitemap from "./sitemap";

const urls = () => sitemap().map((e) => new URL(e.url).pathname);

describe("sitemap", () => {
  it("lists the public pages and every exercise page", () => {
    const paths = urls();
    for (const p of ["/", "/exercises", "/programs", "/privacy", "/terms"]) expect(paths).toContain(p);
    for (const slug of Object.keys(FORM_CUES)) expect(paths).toContain(`/exercises/${slug}`);
  });

  it("leaves out the signed-in and utility pages", () => {
    const paths = urls();
    for (const p of ["/log", "/history", "/insights", "/settings", "/account", "/offline"]) {
      expect(paths).not.toContain(p);
    }
    expect(paths.some((p) => p.startsWith("/auth"))).toBe(false);
  });

  it("uses absolute addresses on one host", () => {
    const hosts = new Set(sitemap().map((e) => new URL(e.url).origin));
    expect(hosts).toEqual(new Set([siteUrl().origin]));
  });
});

describe("robots", () => {
  it("allows the site, keeps out private paths and points to the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/log", "/history", "/insights", "/settings"]));
    expect(r.sitemap).toBe(new URL("/sitemap.xml", siteUrl()).toString());
  });

  it("never blocks a page the sitemap lists", () => {
    const rule = (() => {
      const r = robots().rules;
      return Array.isArray(r) ? r[0] : r;
    })();
    const disallow = [rule.disallow ?? []].flat();
    for (const p of urls()) expect(disallow.some((d) => p.startsWith(d))).toBe(false);
  });
});

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, then Vercel's production domain, then local dev", () => {
    expect(
      siteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.com", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }).origin,
    ).toBe("https://example.com");
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }).origin).toBe("https://x.vercel.app");
    expect(siteUrl({}).origin).toBe("http://localhost:3100");
  });
});

describe("exercise page copy", () => {
  it("names every exercise with form content", () => {
    for (const slug of Object.keys(FORM_CUES)) expect(EXERCISE_NAMES[slug], slug).toBeDefined();
  });

  it("puts the Thai name first, then the English one, with no angles or lengths", () => {
    for (const slug of Object.keys(FORM_CUES)) {
      const { th, en } = EXERCISE_NAMES[slug];
      const copy = exerciseCopy(slug, "th")!;
      expect(copy.title.startsWith(`ท่า${th} (${en})`), slug).toBe(true);
      expect(copy.description).not.toMatch(/องศา|ซม\.|เซนติเมตร|°|cm/);
      // About 150 characters, so search results show it whole; the longest names run a little over.
      expect(copy.description.length).toBeLessThanOrEqual(170);
      expect(exerciseCopy(slug, "en")!.title.startsWith(en)).toBe(true);
    }
  });
});

describe("pageMeta", () => {
  const ogImage = (m: ReturnType<typeof pageMeta>) => [m.openGraph?.images].flat()[0] as { url: string };

  it("sets the canonical address and the site's card by default", () => {
    const m = pageMeta("th", { title: "t", description: "d", path: "/programs" });
    expect(m.alternates?.canonical).toBe("/programs");
    expect(ogImage(m).url).toBe("/th/opengraph-image");
  });

  it("uses the page's own card when named", () => {
    const m = pageMeta("en", {
      title: "t",
      description: "d",
      path: "/exercises/deadlift",
      imagePath: "/exercises/deadlift",
    });
    expect(ogImage(m).url).toBe("/en/exercises/deadlift/opengraph-image");
  });
});
