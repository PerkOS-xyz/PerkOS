import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/components/WebMcpTools.tsx"),
  "utf8",
);

/**
 * WebMCP tools act as the signed-in user, and any agent in that tab can reach
 * them. The safety of the feature is entirely in which tools exist, so these
 * assert the boundary rather than the mechanics.
 */
describe("WebMCP tools", () => {
  it("exposes reads and a single create, nothing destructive", () => {
    expect(source).toContain("perkos_list_projects");
    expect(source).toContain("perkos_list_tasks");
    expect(source).toContain("perkos_create_task");

    // Irreversible or money-spending actions must not be reachable by an
    // agent that misread an instruction.
    for (const forbidden of ["DELETE", "agents/launch", "billing", "members", "deprovision"]) {
      expect(source, `must not expose ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("registers only while signed in", () => {
    // A tool set left registered after sign-out would point at a session that
    // ended, which matters on a shared machine.
    expect(source).toContain("!isConnected");
    expect(source).toContain("provideContext({ tools: [] })");
  });

  it("degrades silently where WebMCP does not exist", () => {
    // Most browsers have no navigator.modelContext. The site must behave
    // identically there, with no warning and no broken feature.
    expect(source).toContain("typeof navigator === \"undefined\"");
    expect(source).toContain("typeof candidate.provideContext === \"function\"");
  });

  it("goes through the same API the UI uses", () => {
    // Nothing here may bypass the API's own authorization.
    expect(source).toContain("authedFetch");
    expect(source).not.toContain("firestore");
  });
});
