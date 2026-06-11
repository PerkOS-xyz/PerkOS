import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

/**
 * Let crawlers index the public landing; keep the signed-in app out of the
 * index (those routes redirect to sign-in and aren't useful results).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/projects",
        "/tasks",
        "/agents",
        "/chat",
        "/organizations",
        "/settings",
        "/onboarding",
        "/sign-in",
        "/continue",
        "/companies/",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
