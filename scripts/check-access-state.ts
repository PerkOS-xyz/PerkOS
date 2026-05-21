/**
 * Dump every source the wallet-signin gate consults, so we can confirm
 * "only authorized wallets can enter" is actually enforced.
 *
 *   npx tsx --env-file=.env scripts/check-access-state.ts
 */

import { adminDb } from "../app/lib/firebaseAdmin";

async function main() {
  console.log("\n=== PerkOS access state check ===\n");

  // 1. config/access.publicMode
  const accessSnap = await adminDb().collection("config").doc("access").get();
  const publicMode = accessSnap.data()?.publicMode === true;
  console.log(`1. config/access.publicMode      → ${publicMode ? "TRUE ⚠️  (any wallet allowed!)" : "false ✓"}`);

  // 2. PERKOS_WHITELIST env
  const envRaw = process.env.PERKOS_WHITELIST ?? "";
  const envList = envRaw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[a-f0-9]{40}$/.test(s));
  console.log(`2. PERKOS_WHITELIST env          → ${envList.length} wallet(s)`);
  for (const w of envList) console.log(`     • ${w}`);

  // 3. /allowlist Firestore collection
  const snap = await adminDb().collection("allowlist").get();
  console.log(`3. Firestore /allowlist           → ${snap.size} wallet(s)`);
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`     • ${d.id}   (source: ${data.source ?? "—"})`);
  }

  // 4. super_admins (informational)
  const adminsSnap = await adminDb().collection("super_admins").get();
  console.log(`\n4. /super_admins                  → ${adminsSnap.size} wallet(s)`);
  for (const d of adminsSnap.docs) console.log(`     • ${d.id}`);

  console.log(`\n=== Net effect ===`);
  if (publicMode) {
    console.log("⚠️  PUBLIC MODE IS ON — gate is open to anyone.");
  } else {
    const total = new Set([...envList, ...snap.docs.map((d) => d.id)]).size;
    console.log(`Invite-only. ${total} unique wallet(s) can sign in.`);
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
