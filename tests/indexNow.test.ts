import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { INDEXNOW_KEY, buildIndexNowPayload, sitemapUrls } from "../app/lib/indexNow";

/**
 * IndexNow verifies ownership by fetching `/<key>.txt` and comparing its body
 * with the key in the request. If the constant and the file drift apart,
 * every submission fails with 403 and nothing says why, so pin them together.
 */
describe("IndexNow", () => {
  it("serves a key file whose body is exactly the key", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    const body = readFileSync(join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`), "utf8");
    expect(body).toBe(INDEXNOW_KEY);
  });

  it("builds a payload for one host and drops URLs on other hosts", () => {
    const payload = buildIndexNowPayload("https://perkos.xyz", [
      "https://perkos.xyz",
      "https://perkos.xyz/token",
      "https://perkos.xyz/token",
      "https://app.perkos.xyz/dashboard",
      "not a url",
    ]);
    expect(payload).toEqual({
      host: "perkos.xyz",
      key: INDEXNOW_KEY,
      keyLocation: `https://perkos.xyz/${INDEXNOW_KEY}.txt`,
      urlList: ["https://perkos.xyz", "https://perkos.xyz/token"],
    });
  });

  it("reads every loc from a sitemap", () => {
    const xml =
      '<?xml version="1.0"?><urlset><url><loc>https://perkos.xyz</loc></url>' +
      "<url><loc> https://perkos.xyz/faq </loc><lastmod>2026-11-12</lastmod></url></urlset>";
    expect(sitemapUrls(xml)).toEqual(["https://perkos.xyz", "https://perkos.xyz/faq"]);
  });
});
