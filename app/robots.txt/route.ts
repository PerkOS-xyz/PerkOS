/**
 * GET /robots.txt
 *
 * Hand-written rather than Next's `MetadataRoute.Robots`, which only emits the
 * fields it knows (userAgent, allow, disallow, sitemap, host) and cannot carry
 * arbitrary directives. `Content-Signal` is one, so the typed helper could not
 * express it.
 *
 * Same rules as before: the landing is indexable, the signed-in app is not.
 * Those routes redirect to sign-in and are HTML for people — an agent should
 * reach the contract through /llms.txt, not by crawling the dashboard.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const DISALLOW = [
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
];

const BODY = [
  // How this content may be used, per the Content Signals proposal. `ai-input`
  // is yes on purpose: an agent reading the site to answer for a user is
  // exactly what the contract below is published for. `ai-train` is the one
  // that is a business decision rather than a technical one.
  "Content-Signal: search=yes, ai-input=yes, ai-train=no",
  "",
  "User-agent: *",
  "Allow: /",
  ...DISALLOW.map((path) => `Disallow: ${path}`),
  "",
  "# The agent contract. These are the paths meant for non-browser callers.",
  "Allow: /llms.txt",
  "Allow: /AGENTS.md",
  "Allow: /openapi.json",
  "Allow: /.well-known/",
  "",
  // Points agents at the capability manifest, the same way Sitemap points
  // crawlers at the page index.
  `Agentmap: ${SITE}/.well-known/ai-catalog.json`,
  `Sitemap: ${SITE}/sitemap.xml`,
  `Host: ${SITE}`,
  "",
].join("\n");

export function GET(): Response {
  return new Response(BODY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
