// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

// Run with a demo-only local emulator; never a live Firebase project.
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("Artizen canonical write boundaries", () => {
  let env: RulesTestEnvironment;
  const owner = "fixture-owner"; const pid = "template-fixture"; const agent = "Artizen-fixture";
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    env = await initializeTestEnvironment({ projectId: "demo-artizen-workspace", firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") } });
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, `project_template_instances/${owner}--${pid}`), { templateId: "artizen-creator-update" });
      await setDoc(doc(db, `agents/${agent}`), { executionMode: "artizen-on-demand" });
      await setDoc(doc(db, `wallets/${owner}/agents/${agent}`), { executionMode: "artizen-on-demand", executionProjectId: pid });
      await setDoc(doc(db, `wallets/${owner}/projects/${pid}`), { executionMode: "artizen-on-demand", agentIds: [agent], orgId: "org" });
      await setDoc(doc(db, `wallets/${owner}/projects/${pid}/tasks/result`), { status: "Review", humanApproved: false });
      await setDoc(doc(db, `wallets/${owner}/projects/${pid}/members/editor`), { role: "editor", status: "active" });
    });
  }, 30000);
  afterAll(async () => { await env?.cleanup(); });
  it("owner can read but cannot forge task approval, roster or agent mode", async () => {
    const db = env.authenticatedContext(owner).firestore();
    await assertSucceeds(getDoc(doc(db, `wallets/${owner}/projects/${pid}/tasks/result`)));
    await assertFails(updateDoc(doc(db, `wallets/${owner}/projects/${pid}/tasks/result`), { status: "Done", humanApproved: true }));
    await assertFails(updateDoc(doc(db, `wallets/${owner}/projects/${pid}`), { executionMode: "generic", agentIds: [] }));
    await assertFails(updateDoc(doc(db, `wallets/${owner}/agents/${agent}`), { executionMode: "generic" }));
    await assertFails(setDoc(doc(db, `wallets/${owner}/projects/${pid}/tasks/extra`), { status: "Backlog" }));
  });
  it("editor cannot bypass the template controller; unrelated users cannot read tasks", async () => {
    const editor = env.authenticatedContext("editor").firestore();
    await assertSucceeds(getDoc(doc(editor, `wallets/${owner}/projects/${pid}/tasks/result`)));
    await assertFails(updateDoc(doc(editor, `wallets/${owner}/projects/${pid}/tasks/result`), { status: "Done" }));
    await assertFails(getDoc(doc(env.authenticatedContext("stranger").firestore(), `wallets/${owner}/projects/${pid}/tasks/result`)));
    await assertFails(setDoc(doc(editor, `project_template_instances/${owner}--${pid}`), { templateId: "generic" }));
  });
  it("normal owner workspace edits and project notes still work", async () => {
    const db = env.authenticatedContext(owner).firestore();
    await assertSucceeds(setDoc(doc(db, `wallets/${owner}`), { name: "Creator" }));
    await assertSucceeds(setDoc(doc(db, `wallets/${owner}/projects/normal/tasks/task`), { status: "Backlog" }));
    await assertSucceeds(setDoc(doc(db, `wallets/${owner}/agents/normal`), { name: "Normal" }));
    await assertSucceeds(setDoc(doc(db, `wallets/${owner}/projects/${pid}/docs/note`), { text: "Project note" }));
  });
});
