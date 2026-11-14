/**
 * Public pages that never need the wallet: the landing, the guides, the
 * industry pages and the reference pages. They render without the Dynamic
 * wallet SDK, which is most of the JavaScript a visitor would otherwise
 * download before the page settles. Sign-in and the app keep it.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/ai-agents-for-business",
  "/ai-teams-for-small-business",
  "/agentic-business",
  "/pricing",
  "/faq",
  "/tokens",
  "/investors",
  "/privacy",
  "/runtime",
  "/floor",
  "/solutions",
]);

export function isPublicPagePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PATHS.has(path) || path.startsWith("/solutions/");
}
