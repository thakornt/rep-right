import type { MetadataRoute } from "next";

import { PRIVATE_PATHS, siteUrl } from "../lib/seo";

// Crawl everything public; stay out of the signed-in pages and the API proxy.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
