import type { Metadata } from "next";

/**
 * Metadata for a public marketing page: its own canonical URL, Open Graph and
 * Twitter card.
 *
 * Next merges metadata shallowly, so a page that sets only `alternates` still
 * inherits the root layout's `openGraph` whole, including `url` pointing at
 * the home page. Every shared or previewed page then claimed to be the home
 * page (og:url https://perkos.xyz, og:title of the landing), which search and
 * answer engines read as a duplicate. Each page passes its own path here, and
 * the image is repeated because a child `openGraph` replaces the parent's.
 */
const SITE_NAME = "PerkOS AI";
const IMAGE = {
  url: "/banner.png",
  width: 2371,
  height: 1421,
  alt: "PerkOS AI: AI teams for small businesses",
};

export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      images: [IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      site: "@perk_os",
      creator: "@perk_os",
      title: fullTitle,
      description,
      images: [IMAGE.url],
    },
  };
}
