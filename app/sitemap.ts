import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

/**
 * Public marketing sitemap. Signed-in application routes remain excluded by
 * robots; these URLs are intentionally written for search and discovery.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-08-09");
  const pages = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/ai-teams-for-small-business", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.4, changeFrequency: "yearly" as const },
    { path: "/solutions/restaurants", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/solutions/real-estate", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/solutions/ecommerce", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/solutions/agencies", priority: 0.8, changeFrequency: "monthly" as const },
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
