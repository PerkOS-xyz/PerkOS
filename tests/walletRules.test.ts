// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { isSolanaWalletAddress } from "@perkos/shared-types";
import { localEmulator } from "./helpers/localEmulator";

// Public synthetic fixtures, including two valid identities differing by case.
const owner = "So11111111111111111111111111111111111111112";
const variant = "so11111111111111111111111111111111111111112";
const evm = "0xabcdefabcdef1234567890123456789012345678";
const project = `wallets/${owner}/projects/rules-project`;
const org = `wallets/${owner}/organizations/rules-org`;
const projectId = "demo-artizen-workspace"; // Same local demo as the existing CI suite.

describe("rules harness safety", () => {
  it.each([undefined, "example.com:8080", "127.0.0.1:0", "localhost:65536", "localhost:8080/path", "user@localhost:8080"])("rejects non-loopback or malformed emulator setting %s", value => {
    expect(() => localEmulator(value)).toThrow("loopback");
  });
  it("accepts explicit loopback ports and uses valid Solana case-variant fixtures", () => {
    expect(localEmulator("127.0.0.1:8187")).toEqual({ host: "127.0.0.1", port: 8187 });
    expect(isSolanaWalletAddress(owner)).toBe(true);
    expect(isSolanaWalletAddress(variant)).toBe(true);
  });
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("wallet Firestore rule isolation", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId, firestore: {
      ...localEmulator(process.env.FIRESTORE_EMULATOR_HOST), rules: readFileSync("firestore.rules", "utf8"),
    } });
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      for (const address of [owner, variant, evm]) {
        await setDoc(doc(db, `wallets/${address}/profile/main`), { name: "Private fixture" });
        await setDoc(doc(db, `allowlist/${address}`), { status: "active" });
      }
      await setDoc(doc(db, project), { orgId: "rules-org", name: "Fixture project" });
      await setDoc(doc(db, org), { name: "Fixture org" });
      for (const path of ["tasks/task", "docs/note", "docs/note/blocks/block", "messages/post", "agentMembers/fixture", "coordination/entry"]) {
        await setDoc(doc(db, `${project}/${path}`), { value: "fixture" });
      }
      await setDoc(doc(db, "agents/rules-fixture"), { private: "synthetic" });
      await setDoc(doc(db, "provision_jobs/rules-job"), { walletAddress: owner });
      await setDoc(doc(db, "provision_jobs/rules-job/log/event"), { status: "queued" });
    });
  }, 30000);
  afterAll(async () => { await env?.cleanup(); });

  it.each([owner, variant, evm])("allows only exact owner profile writes and reads (%s)", async address => {
    const db = env.authenticatedContext(address).firestore();
    const path = `wallets/${address}/profile/main`;
    await assertSucceeds(updateDoc(doc(db, path), { name: "Updated fixture" }));
    await assertSucceeds(getDoc(doc(db, path)));
    for (const other of [owner, variant, evm].filter(value => value !== address)) {
      await assertFails(getDoc(doc(db, `wallets/${other}/profile/main`)));
      await assertFails(setDoc(doc(db, `wallets/${other}/profile/injected`), { injected: true }));
    }
  });

  it("denies unauthenticated and collection-wide workspace access", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), `${project}/tasks/task`)));
    await assertFails(getDocs(collection(env.authenticatedContext(owner).firestore(), "wallets")));
  });

  it("does not grant other-wallet access from wallet claims or a shared-project pointer", async () => {
    const db = env.authenticatedContext(variant, { walletAddress: owner, walletChain: "solana", role: "admin" }).firestore();
    await assertSucceeds(setDoc(doc(db, `wallets/${variant}/sharedProjects/rules-pointer`), { ownerWallet: owner, projectId: "rules-project", role: "owner" }));
    await assertFails(getDoc(doc(db, project)));
    await assertFails(updateDoc(doc(db, `${project}/tasks/task`), { value: "forged" }));
  });

  it("allows a viewer to read but not edit or promote itself", async () => {
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `${project}/members/${variant}`), { role: "viewer", status: "active" }));
    const db = env.authenticatedContext(variant).firestore();
    await assertSucceeds(getDoc(doc(db, project)));
    await assertSucceeds(getDocs(collection(db, `${project}/tasks`)));
    await assertSucceeds(getDoc(doc(db, `${project}/docs/note/blocks/block`)));
    await assertFails(updateDoc(doc(db, `${project}/tasks/task`), { value: "viewer edit" }));
    await assertFails(updateDoc(doc(db, `${project}/members/${variant}`), { role: "owner" }));
    await env.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), `${project}/members/${variant}`)));
  });

  it("allows editor task/docs writes but not roster edits, org moves or private profile access", async () => {
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `${project}/members/${evm}`), { role: "editor", status: "active" }));
    const db = env.authenticatedContext(evm).firestore();
    await assertSucceeds(updateDoc(doc(db, project), { name: "Edited fixture" }));
    await assertSucceeds(updateDoc(doc(db, `${project}/tasks/task`), { value: "editor task" }));
    await assertSucceeds(updateDoc(doc(db, `${project}/docs/note/blocks/block`), { value: "editor note" }));
    await assertFails(updateDoc(doc(db, project), { orgId: "other-org" }));
    await assertFails(setDoc(doc(db, `${project}/members/${variant}`), { role: "owner" }));
    await assertFails(updateDoc(doc(db, `${project}/agentMembers/fixture`), { value: "edited" }));
    await assertFails(getDoc(doc(db, `wallets/${owner}/profile/main`)));
  });

  it("lets members read the coordination log but never write it", async () => {
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `${project}/members/${evm}`), { role: "editor", status: "active" }));
    const editor = env.authenticatedContext(evm).firestore();
    await assertSucceeds(getDoc(doc(editor, `${project}/coordination/entry`)));
    await assertFails(setDoc(doc(editor, `${project}/coordination/forged`), { kind: "system", text: "forged" }));
    await assertFails(updateDoc(doc(editor, `${project}/coordination/entry`), { value: "edited" }));
    const outsider = env.authenticatedContext(variant).firestore();
    await assertFails(getDoc(doc(outsider, `${project}/coordination/entry`)));
    await env.withSecurityRulesDisabled(context => deleteDoc(doc(context.firestore(), `${project}/members/${evm}`)));
  });

  it("revokes membership even if discovery pointers still exist", async () => {
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `${project}/members/${evm}`), { role: "editor", status: "removed" }));
    const db = env.authenticatedContext(evm).firestore();
    await assertSucceeds(setDoc(doc(db, `wallets/${evm}/sharedProjects/stale`), { ownerWallet: owner, projectId: "rules-project" }));
    await assertFails(getDoc(doc(db, project)));
    await assertFails(getDoc(doc(db, `${project}/tasks/task`)));
    await assertFails(updateDoc(doc(db, `${project}/tasks/task`), { value: "revoked" }));
  });

  it("respects organization roles and exact member IDs", async () => {
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `${org}/members/${variant}`), { role: "viewer", status: "active" }));
    const viewer = env.authenticatedContext(variant).firestore();
    await assertSucceeds(getDoc(doc(viewer, org)));
    await assertSucceeds(getDoc(doc(viewer, `${project}/tasks/task`)));
    await assertFails(updateDoc(doc(viewer, `${project}/tasks/task`), { value: "org viewer" }));
    const other = env.authenticatedContext(evm).firestore();
    await assertFails(getDoc(doc(other, org)));
    await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), `${org}/members/${variant}`), { status: "revoked" }));
    await assertFails(getDoc(doc(viewer, `${project}/tasks/task`)));
  });

  it("keeps allowlist, global agents and provisioning state server-owned", async () => {
    const db = env.authenticatedContext(owner).firestore();
    await assertSucceeds(getDoc(doc(db, `allowlist/${owner}`)));
    await assertFails(updateDoc(doc(db, `allowlist/${owner}`), { role: "admin", ecsEnabled: true }));
    await assertFails(getDoc(doc(db, `allowlist/${variant}`)));
    await assertFails(getDoc(doc(db, "agents/rules-fixture")));
    await assertFails(updateDoc(doc(db, "agents/rules-fixture"), { role: "owner" }));
    await assertSucceeds(getDoc(doc(db, "provision_jobs/rules-job/log/event")));
    await assertFails(getDoc(doc(env.authenticatedContext(variant).firestore(), "provision_jobs/rules-job")));
    await assertFails(updateDoc(doc(db, "provision_jobs/rules-job"), { status: "ready" }));
  });

  it("uses exact wallet ownership for handles and prevents registry enumeration", async () => {
    const db = env.authenticatedContext(owner).firestore();
    const other = env.authenticatedContext(variant).firestore();
    await assertSucceeds(setDoc(doc(db, "usernames/rules-fixture"), { wallet: owner }));
    await assertSucceeds(getDoc(doc(other, "usernames/rules-fixture")));
    await assertFails(updateDoc(doc(other, "usernames/rules-fixture"), { wallet: variant }));
    await assertFails(setDoc(doc(other, "usernames/forged-fixture"), { wallet: owner }));
    await assertFails(getDocs(collection(db, "usernames")));
  });

  it.each([owner, evm])("keeps credits and ledger server-owned even for the exact owner (%s)", async address => {
    const db = env.authenticatedContext(address).firestore();
    for (const name of ["billing_account", "billing_ledger"]) {
      const path = `wallets/${address}/${name}/rules-entry`;
      await assertFails(setDoc(doc(db, path), { creditsUsd: 999, lifetimeToppedUpUsd: 999 }));
      await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), path), { creditsUsd: 1 }));
      await assertSucceeds(getDoc(doc(db, path)));
      await assertFails(updateDoc(doc(db, path), { creditsUsd: 999 }));
      await assertFails(deleteDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, `${path}/nested/forged`), { amountUsd: 999 }));
    }
  });

  it("preserves conversation metadata but denies Firestore chat bodies even to the owner", async () => {
    const db = env.authenticatedContext(owner).firestore();
    const path = `wallets/${owner}/conversations/rules-chat`;
    await assertSucceeds(setDoc(doc(db, path), { title: "Fixture metadata" }));
    await assertSucceeds(getDoc(doc(db, path)));
    await assertSucceeds(getDocs(collection(db, `wallets/${owner}/conversations`)));
    await assertFails(setDoc(doc(db, `${path}/messages/forged`), { text: "must not be stored here" }));
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), `${path}/messages/legacy`), { text: "synthetic legacy content" }));
    await assertFails(getDoc(doc(db, `${path}/messages/legacy`)));
    await assertFails(getDocs(collection(db, `${path}/messages`)));
    await assertSucceeds(deleteDoc(doc(db, path)));
  });

  it("allows receipt creation and a single anchor without allowing rewrite or deletion", async () => {
    const db = env.authenticatedContext(owner).firestore();
    const receipt = doc(db, `wallets/${owner}/receipts/rules-receipt`);
    await assertSucceeds(setDoc(receipt, { manifest: { version: 1 }, signature: "synthetic" }));
    await assertSucceeds(getDoc(receipt));
    await assertFails(updateDoc(receipt, { signature: "tampered" }));
    await assertFails(updateDoc(receipt, { anchor: "invalid" }));
    await assertSucceeds(updateDoc(receipt, { anchor: { chainId: 1, contractAddress: "fixture", receiptId: "fixture", txHash: "fixture" } }));
    await assertFails(updateDoc(receipt, { anchor: { chainId: 2, contractAddress: "fixture", receiptId: "fixture", txHash: "replacement" } }));
    await assertFails(deleteDoc(receipt));
  });
});

describe.skipIf(!process.env.FIREBASE_STORAGE_EMULATOR_HOST)("wallet Storage rule isolation", () => {
  let env: RulesTestEnvironment;
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId, storage: {
      ...localEmulator(process.env.FIREBASE_STORAGE_EMULATOR_HOST), rules: readFileSync("storage.rules", "utf8"),
    } });
  }, 30000);
  afterAll(async () => { await env?.cleanup(); });
  const bytes = new Uint8Array([1, 2, 3]);

  it.each([owner, variant, evm])("isolates attachment reads and writes by exact wallet (%s)", async address => {
    const path = `attachments/${address}/rules-conversation/file.txt`;
    const storage = env.authenticatedContext(address).storage();
    await assertSucceeds(uploadBytes(ref(storage, path), bytes, { contentType: "text/plain" }));
    await assertSucceeds(getBytes(ref(storage, path)));
    const other = env.authenticatedContext(address === owner ? variant : owner).storage();
    await assertFails(getBytes(ref(other, path)));
    await assertFails(uploadBytes(ref(other, path), bytes));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
  });

  it("denies attachments at or above the 25 MiB cap", async () => {
    const storage = env.authenticatedContext(owner).storage();
    await assertFails(uploadBytes(ref(storage, `attachments/${owner}/rules-conversation/too-large`), new Uint8Array(25 * 1024 * 1024)));
  }, 30000);

  it("allows public avatar reads, but only the owner can upload an image", async () => {
    const path = `avatars/${owner}/rules-avatar.png`;
    const storage = env.authenticatedContext(owner).storage();
    await assertSucceeds(uploadBytes(ref(storage, path), bytes, { contentType: "image/png" }));
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), path)));
    await assertFails(uploadBytes(ref(env.authenticatedContext(variant).storage(), path), bytes, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(storage, path), bytes, { contentType: "text/html" }));
    await assertFails(uploadBytes(ref(storage, path), new Uint8Array(5 * 1024 * 1024), { contentType: "image/png" }));
  }, 30000);

  it("denies unauthenticated uploads and unknown paths", async () => {
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), `attachments/${owner}/rules-conversation/anonymous`), bytes));
    await assertFails(uploadBytes(ref(env.authenticatedContext(owner).storage(), `unknown/${owner}/file`), bytes));
  });
});
