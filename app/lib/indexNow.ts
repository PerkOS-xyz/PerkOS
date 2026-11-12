/**
 * IndexNow: tell Bing (and the other engines that share IndexNow) the moment
 * a page changes, instead of waiting for their crawler to come back.
 *
 * Bing matters more than its market share suggests: ChatGPT search runs on
 * Bing's index, and on 2026-11-12 Bing did not rank perkos.xyz in its top
 * five for "PerkOS".
 *
 * The key is public by design. IndexNow proves we own the host by fetching
 * `https://perkos.xyz/<key>.txt`, which must contain exactly the key, so the
 * key file lives in `public/` and `tests/indexNow.test.ts` keeps the two in
 * step. Rotating the key means changing both.
 */
export const INDEXNOW_KEY = "51dd76d8c4dda7ba916ba5b603fd025c";

/** The shared endpoint; it forwards to every participating engine. */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

/**
 * Builds the POST body for a list of URLs on one site. URLs on any other
 * host are dropped: IndexNow rejects the whole request if one of them does
 * not match `host`.
 */
export function buildIndexNowPayload(site: string, urls: string[]): IndexNowPayload {
  const origin = new URL(site);
  const urlList = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === origin.host;
    } catch {
      return false;
    }
  });
  return {
    host: origin.host,
    key: INDEXNOW_KEY,
    keyLocation: `${origin.origin}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

/** Pulls every `<loc>` out of a sitemap.xml body. */
export function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}
