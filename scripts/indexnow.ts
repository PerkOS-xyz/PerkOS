/**
 * Tell IndexNow (Bing and the engines that share it) that the public pages
 * changed. Run it after a deploy, once the new pages are live:
 *
 *   npx tsx scripts/indexnow.ts --dry-run     # show what would be sent
 *   npx tsx scripts/indexnow.ts               # send it
 *
 * It reads the live sitemap, so it only announces URLs that actually answer,
 * and it checks the key file first: IndexNow fetches it to prove we own the
 * host, and a missing key file makes every submission fail with 403.
 */
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  buildIndexNowPayload,
  sitemapUrls,
} from "../app/lib/indexNow";

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const keyUrl = `${SITE}/${INDEXNOW_KEY}.txt`;
  const keyRes = await fetch(keyUrl);
  const keyBody = (await keyRes.text()).trim();
  if (!keyRes.ok || keyBody !== INDEXNOW_KEY) {
    throw new Error(
      `Key file ${keyUrl} answered ${keyRes.status} with the wrong content. Deploy it before submitting.`,
    );
  }

  const sitemapRes = await fetch(`${SITE}/sitemap.xml`);
  if (!sitemapRes.ok) throw new Error(`sitemap.xml answered ${sitemapRes.status}`);
  const payload = buildIndexNowPayload(SITE, sitemapUrls(await sitemapRes.text()));
  if (payload.urlList.length === 0) throw new Error("The sitemap listed no URLs on this host.");

  console.log(`${payload.urlList.length} URLs for ${payload.host}:`);
  for (const url of payload.urlList) console.log(`  ${url}`);

  if (dryRun) {
    console.log("\nDry run: nothing sent.");
    return;
  }

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  // 200 and 202 both mean accepted; 202 is "received, key check pending".
  console.log(`\nIndexNow answered ${res.status} ${res.statusText}`);
  if (res.status !== 200 && res.status !== 202) {
    console.log(await res.text());
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
