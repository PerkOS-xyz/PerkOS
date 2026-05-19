/**
 * List every doc in /allowlist. Quick sanity check after seeding.
 *
 *   cd MiniApp && npx tsx --env-file=.env scripts/list-allowlist.ts
 */

import { adminDb } from "../app/lib/firebaseAdmin";

async function main() {
  const snapshot = await adminDb().collection("allowlist").get();

  if (snapshot.empty) {
    console.log("/allowlist is empty.");
    return;
  }

  console.log(`\n/allowlist — ${snapshot.size} doc(s):\n`);
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`  • ${doc.id}`);
    console.log(`      source:    ${data.source ?? "—"}`);
    console.log(`      note:      ${data.note ?? "—"}`);
    console.log(`      createdAt: ${data.createdAt?.toDate?.().toISOString() ?? "—"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
