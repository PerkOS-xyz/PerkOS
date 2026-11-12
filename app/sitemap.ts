import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

/**
 * Public marketing sitemap. Signed-in application routes remain excluded by
 * robots; these URLs are intentionally written for search and discovery.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // `updated` is the date the page's content last changed. One date for every
  // page told crawlers that /faq and /token, published on 2026-11-12, were
  // three months old, so they had no reason to fetch them first. Update the
  // date when a page's content changes.
  const pages = [
    { path: "", updated: "2026-11-12", priority: 1, changeFrequency: "weekly" as const },
    { path: "/about", updated: "2026-08-10", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/ai-teams-for-small-business", updated: "2026-08-10", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/solutions", updated: "2026-08-10", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/pricing", updated: "2026-08-11", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/faq", updated: "2026-11-12", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/token", updated: "2026-11-12", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/runtime", updated: "2026-09-27", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/floor", updated: "2026-09-27", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/investors", updated: "2026-11-12", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/privacy", updated: "2026-08-10", priority: 0.4, changeFrequency: "yearly" as const },
    { path: "/solutions/restaurants", updated: "2026-08-10", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/solutions/real-estate", updated: "2026-08-10", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/solutions/ecommerce", updated: "2026-08-10", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/solutions/agencies", updated: "2026-08-10", priority: 0.8, changeFrequency: "monthly" as const },
  ];

  return pages.map(({ path, updated, priority, changeFrequency }) => ({
    url: `${SITE}${path}`,
    lastModified: new Date(updated),
    changeFrequency,
    priority,
  }));
}
