/**
 * Migrate the alpha-access whitelist from the env var into Firestore.
 *
 * Run with:
 *   cd MiniApp && npx tsx --env-file=.env scripts/seed-allowlist.ts
 *
 * Optional flags:
 *   --wallets=0xabc,0xdef   Override env var; comma-separated list to seed.
 *   --note="early team"     Attach a note field to every doc.
 *   --dry-run               Show what would be written, don't write anything.
 *
 * Idempotent: writes use `merge: true`, so re-running is safe.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "../app/lib/firebaseAdmin";

type Args = {
  wallets: string[];
  note?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  let wallets: string[] = [];
  let note: string | undefined;
  let dryRun = false;

  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") {
      dryRun = true;
    } else if (raw.startsWith("--wallets=")) {
      wallets = raw
        .slice("--wallets=".length)
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
    } else if (raw.startsWith("--note=")) {
      note = raw.slice("--note=".length);
    }
  }

  if (wallets.length === 0) {
    wallets = (process.env.NEXT_PUBLIC_PERKOS_WHITELIST ?? "")
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
  }

  return { wallets, note, dryRun };
}

function normalize(address: string): string {
  return address.toLowerCase();
}

async function main() {
  const { wallets, note, dryRun } = parseArgs(process.argv);

  if (wallets.length === 0) {
    console.error(
      "No wallets to seed. Set NEXT_PUBLIC_PERKOS_WHITELIST or pass --wallets=0xabc,0xdef"
    );
    process.exit(1);
  }

  const unique = Array.from(new Set(wallets.map(normalize)));

  console.log(`\nSeeding ${unique.length} wallet(s) into /allowlist`);
  console.log(`Source: ${note ? `note="${note}"` : "(no note)"}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}\n`);

  for (const address of unique) {
    console.log(`  • ${address}`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing written.");
    return;
  }

  const db = adminDb();
  const batch = db.batch();
  const now = Timestamp.now();

  for (const address of unique) {
    const ref = db.collection("allowlist").doc(address);
    batch.set(
      ref,
      {
        walletAddress: address,
        source: process.env.NEXT_PUBLIC_PERKOS_WHITELIST
          ? "env-migration"
          : "manual-cli",
        note: note ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await batch.commit();

  console.log(`\nWrote ${unique.length} doc(s) to /allowlist.`);
}

main().catch((err) => {
  console.error("\nSeed failed:");
  console.error(err);
  process.exit(1);
});
