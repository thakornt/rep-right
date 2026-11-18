import type { MetadataRoute } from "next";

import { PUBLIC_PATHS, exercisePaths, siteUrl } from "../lib/seo";

// Every public page, for search engines. Signed-in pages (log, history, insights, settings)
// are left out: they say robots: { index: false } and robots.ts keeps crawlers away.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [...PUBLIC_PATHS, ...exercisePaths()].map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: "monthly",
    priority: path === "/" ? 1 : path.startsWith("/exercises/") ? 0.8 : 0.5,
  }));
}
