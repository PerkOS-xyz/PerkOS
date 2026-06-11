import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

/**
 * Public sitemap. Only the marketing landing is indexable — the app routes
 * (dashboard/projects/agents/…) sit behind sign-in and are disallowed in
 * robots. Section anchors live on the landing; Google may surface them as
 * sitelinks over time from the page structure + the WebSite/Organization
 * schema in app/page.tsx.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
