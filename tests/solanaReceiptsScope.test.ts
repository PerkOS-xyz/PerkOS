import { expect, it, vi } from "vitest";
const { paths, write } = vi.hoisted(() => ({ paths: [] as string[][], write: vi.fn() }));
vi.mock("../app/lib/firebase", () => ({ firebaseDb: () => ({}) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => { paths.push(path); return { withConverter: () => ({}) }; },
  doc: (_db: unknown, ...path: string[]) => { paths.push(path); return { withConverter: () => ({}) }; },
  getDoc: async () => ({ exists: () => false }),
  setDoc: write, updateDoc: write, serverTimestamp: () => 0,
  onSnapshot: () => () => {}, query: () => ({}), orderBy: () => ({}),
}));
import { getReceipt, subscribeReceipts } from "../app/lib/receiptsApi";

it("keeps read/subscription receipt paths separate by exact Solana account", async () => {
  for (const wallet of ["So11111111111111111111111111111111111111112", "so11111111111111111111111111111111111111112"]) {
    await getReceipt(wallet, "fixture");
    subscribeReceipts(wallet, () => {});
    expect(paths.at(-2)).toEqual(["wallets", wallet, "receipts", "fixture"]);
    expect(paths.at(-1)).toEqual(["wallets", wallet, "receipts"]);
  }
  expect(write).not.toHaveBeenCalled();
});
