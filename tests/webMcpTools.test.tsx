import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { WebMcpTools } from "../app/components/WebMcpTools";
import {
  PUBLIC_TOOL_SPECS,
  publicToolsBootstrapScript,
} from "../app/lib/webMcpPublicTools";

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

  it("gates the session tools on being signed in, and tears them down", () => {
    // Public tools are registered for everyone; the session tools are not.
    // A tool set left registered after sign-out would point at a session that
    // ended, which matters on a shared machine.
    expect(source).toContain("!isConnected");
    expect(source).toContain("withdraw(");
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

const account = vi.hoisted(() => ({ address: undefined as string | undefined, isConnected: false }));
vi.mock("../app/lib/useAppAccount", () => ({ useAppAccount: () => account }));

function captureTools() {
  const provideContext = vi.fn();
  Object.defineProperty(navigator, "modelContext", {
    value: { provideContext },
    configurable: true,
    writable: true,
  });
  return provideContext;
}

const names = (provide: ReturnType<typeof captureTools>) =>
  (provide.mock.calls.at(0)?.[0].tools ?? []).map((t: { name: string }) => t.name);

beforeEach(() => {
  account.address = undefined;
  account.isConnected = false;
});

describe("WebMCP tool registration", () => {
  it("gives an anonymous visitor the public tools", async () => {
    const provide = captureTools();
    render(<WebMcpTools />);
    await waitFor(() => expect(provide).toHaveBeenCalled());
    expect(names(provide)).toEqual(["perkos_how_to_connect", "perkos_list_agent_skills"]);
  });

  it("does not offer an anonymous visitor tools that can only fail", async () => {
    const provide = captureTools();
    render(<WebMcpTools />);
    await waitFor(() => expect(provide).toHaveBeenCalled());
    // Advertising a call that needs a session to a caller with no session
    // wastes its attempt and teaches it nothing about why.
    expect(names(provide).some((n: string) => n.startsWith("perkos_create"))).toBe(false);
  });

  it("adds the session tools once signed in, keeping the public ones", async () => {
    account.address = "0xabc";
    account.isConnected = true;
    const provide = captureTools();
    render(<WebMcpTools />);
    await waitFor(() => expect(provide).toHaveBeenCalled());
    const registered = names(provide);
    expect(registered).toContain("perkos_how_to_connect");
    expect(registered).toContain("perkos_list_projects");
    expect(registered).toContain("perkos_create_task");
  });

  it("registers nothing destructive", async () => {
    account.address = "0xabc";
    account.isConnected = true;
    const provide = captureTools();
    render(<WebMcpTools />);
    await waitFor(() => expect(provide).toHaveBeenCalled());
    for (const name of names(provide)) {
      expect(name).not.toMatch(/delete|remove|launch|pay|invite|transfer/i);
    }
  });
});

/**
 * Hosts implement one of two shapes. Requiring one specific method meant
 * refusing to register on a host that implemented the other, which from
 * outside looks exactly like having no tools at all.
 */
describe("registration works on either host API", () => {
  it("uses registerTool when the host has no provideContext", async () => {
    const registerTool = vi.fn();
    const unregisterTool = vi.fn();
    Object.defineProperty(navigator, "modelContext", {
      value: { registerTool, unregisterTool },
      configurable: true,
      writable: true,
    });

    const view = render(<WebMcpTools />);
    await waitFor(() => expect(registerTool).toHaveBeenCalled());
    expect(registerTool.mock.calls.map((c) => c[0].name)).toContain(
      "perkos_how_to_connect",
    );

    view.unmount();
    await waitFor(() => expect(unregisterTool).toHaveBeenCalled());
  });

  it("ignores a host object that implements neither", async () => {
    // Something present but unusable must behave like absent, not throw.
    Object.defineProperty(navigator, "modelContext", {
      value: {},
      configurable: true,
      writable: true,
    });
    expect(() => render(<WebMcpTools />)).not.toThrow();
  });
});

/**
 * Two failures found by driving a real browser against production: nothing was
 * registered at the load event, and the effect tore down and re-published on
 * every session change, so a consumer looking in between saw an empty set.
 */
describe("tools stay available", () => {
  it("does not publish an empty set while re-registering", async () => {
    const calls: string[][] = [];
    Object.defineProperty(navigator, "modelContext", {
      value: { provideContext: (c: { tools: { name: string }[] }) => calls.push(c.tools.map((t) => t.name)) },
      configurable: true,
      writable: true,
    });

    const view = render(<WebMcpTools />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));

    // Signing in mid-session must not blank the set on the way through.
    account.address = "0xabc";
    account.isConnected = true;
    view.rerender(<WebMcpTools />);
    await waitFor(() => expect(calls.length).toBeGreaterThan(1));

    for (const published of calls) {
      expect(published.length, "an empty set was published between registrations").toBeGreaterThan(0);
    }
  });

  it("unregisters dropped tools on a per-tool host", async () => {
    // registerTool accumulates, unlike provideContext, so a tool dropped from
    // the set outlives the session that created it unless removed by name.
    account.address = "0xabc";
    account.isConnected = true;
    const registerTool = vi.fn();
    const unregisterTool = vi.fn();
    Object.defineProperty(navigator, "modelContext", {
      value: { registerTool, unregisterTool },
      configurable: true,
      writable: true,
    });

    const view = render(<WebMcpTools />);
    await waitFor(() => expect(registerTool).toHaveBeenCalled());

    account.address = undefined;
    account.isConnected = false;
    view.rerender(<WebMcpTools />);

    await waitFor(() => expect(unregisterTool).toHaveBeenCalled());
    expect(unregisterTool.mock.calls.flat()).toContain("perkos_create_task");
  });
});

describe("the pre-hydration bootstrap", () => {
  it("registers the same tool names the component does", () => {
    // Two runtimes, one definition. Different names would leave a host with
    // duplicate or orphaned tools depending on which ran last.
    const script = publicToolsBootstrapScript();
    for (const spec of PUBLIC_TOOL_SPECS) {
      expect(script).toContain(spec.name);
    }
  });

  it("does nothing where WebMCP is absent", () => {
    const script = publicToolsBootstrapScript();
    expect(script).toContain("if(!c)return");
    // It runs inline on every page load, so it must not be able to throw.
    expect(script).toContain("try{");
  });

  it("only reads paths that are public", () => {
    for (const spec of PUBLIC_TOOL_SPECS) {
      expect(spec.path.startsWith("/")).toBe(true);
      expect(spec.path).not.toContain("/api/platform");
    }
  });
});
