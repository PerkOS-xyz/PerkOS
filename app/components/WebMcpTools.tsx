"use client";

import { useEffect, useRef } from "react";

import { useAppAccount } from "../lib/useAppAccount";
import {
  NO_ARGUMENTS,
  PUBLIC_TOOL_SPECS,
} from "../lib/webMcpPublicTools";

/**
 * Exposes PerkOS actions to an agent running inside the user's own browser,
 * via the WebMCP API.
 *
 * ## Two tiers, and why
 *
 * PUBLIC tools register for everyone, signed in or not. They read documents
 * this site already serves to anonymous callers, so they hand an agent that
 * just arrived a way to learn how PerkOS works without guessing at URLs. They
 * expose nothing a visitor could not fetch directly.
 *
 * SESSION tools act as the SIGNED-IN USER. That is the point of WebMCP — the
 * agent is in the person's browser, working on their behalf — but it means
 * anything registered there is reachable by any agent in that tab. So that
 * set is deliberately narrow:
 *
 *  - reads, and one create
 *  - nothing destructive: no deletes, no launching agents, nothing that spends
 *    money, no changes to who is in an organization. Those either cost real
 *    money or cannot be undone, and an agent that misreads an instruction
 *    should not be able to reach them.
 *  - registered only while signed in, and torn down on sign-out, so a shared
 *    machine does not leave tools pointing at a session that ended.
 *
 * Nothing here bypasses the API's own authorization: every call goes through
 * the same endpoints the UI uses, with the same token and the same checks.
 */

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
};

/**
 * Hosts expose one of two shapes: a bulk `provideContext`, or a per-tool
 * `registerTool` with `unregisterTool`. We accept either. Requiring one
 * specific method meant refusing to register on a host that implemented the
 * other, which looks identical from outside to having no tools at all.
 */
type ModelContext = {
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
  registerTool?: (tool: WebMcpTool) => void;
  unregisterTool?: (name: string) => void;
};

function modelContext(): ModelContext | null {
  if (typeof navigator === "undefined") return null;
  const candidate = (navigator as Navigator & { modelContext?: ModelContext })
    .modelContext;
  if (!candidate) return null;
  const usable =
    typeof candidate.provideContext === "function" ||
    typeof candidate.registerTool === "function";
  return usable ? candidate : null;
}

/**
 * Publish a tool set through whichever API this host provides.
 *
 * `previous` matters only for per-tool hosts: `provideContext` replaces the
 * whole set, but `registerTool` accumulates, so anything dropped from the set
 * has to be unregistered explicitly or it outlives the session that created
 * it.
 */
function publish(context: ModelContext, tools: WebMcpTool[], previous: WebMcpTool[] = []): void {
  if (typeof context.provideContext === "function") {
    context.provideContext({ tools });
    return;
  }
  const current = new Set(tools.map((tool) => tool.name));
  previous
    .filter((tool) => !current.has(tool.name))
    .forEach((tool) => context.unregisterTool?.(tool.name));
  tools.forEach((tool) => context.registerTool?.(tool));
}

/** Withdraw everything we published, in the matching style. */
function withdraw(tools: WebMcpTool[]): void {
  const context = modelContext();
  if (!context) return;
  if (typeof context.provideContext === "function") {
    context.provideContext({ tools: [] });
    return;
  }
  tools.forEach((tool) => context.unregisterTool?.(tool.name));
}

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }],
});

export function WebMcpTools() {
  const { address, isConnected } = useAppAccount();

  /**
   * What is currently published, so teardown can withdraw exactly that.
   *
   * It also keeps the effect from tearing down on every dependency change.
   * Cleanup used to withdraw and then re-publish, which left a window where a
   * consumer looking at the wrong moment saw an empty tool set — observed in
   * a real browser as tools, then nothing, then tools again.
   */
  const publishedRef = useRef<WebMcpTool[]>([]);

  // Withdraw once, when the component actually goes away — not on every
  // change of session.
  useEffect(() => {
    return () => {
      withdraw(publishedRef.current);
      publishedRef.current = [];
    };
  }, []);

  useEffect(() => {
    const context = modelContext();
    // Absent in browsers without WebMCP. Nothing to register, nothing to warn
    // about: the site works the same either way.
    if (!context) return;

    async function fetchPublic(path: string) {
      const response = await fetch(path, { headers: { accept: "*/*" } });
      if (!response.ok) throw new Error(`${response.status} fetching ${path}`);
      return response.text();
    }

    /**
     * Available without signing in, because an agent that has just landed
     * needs to learn the rules before it can follow them. The same specs are
     * registered by the inline bootstrap before hydration, so these replace
     * identical tools rather than adding new ones.
     */
    const publicTools: WebMcpTool[] = PUBLIC_TOOL_SPECS.map((spec) => ({
      name: spec.name,
      description: spec.description,
      inputSchema: NO_ARGUMENTS,
      async execute() {
        return text(await fetchPublic(spec.path));
      },
    }));

    if (!isConnected || !address) {
      // Anonymous visitor: publish the public tools and stop. Registering the
      // session tools here would advertise calls that can only fail.
      publish(context, publicTools, publishedRef.current);
      publishedRef.current = publicTools;
      return;
    }

    async function call(path: string, init?: RequestInit) {
      const { authedFetch } = await import("../lib/apiClient");
      const response = await authedFetch(path, init);
      const body = await response.text();
      if (!response.ok) {
        // Surfaced verbatim so the agent can tell "not signed in" from "not
        // allowed" from "bad arguments" instead of guessing.
        throw new Error(`${response.status}: ${body.slice(0, 300)}`);
      }
      return body;
    }

    const sessionTools: WebMcpTool[] = [
      {
        name: "perkos_list_projects",
        description:
          "List the PerkOS projects the signed-in user can see, with their ids and names.",
        inputSchema: { type: "object", properties: {} },
        async execute() {
          return text(await call("/api/projects"));
        },
      },
      {
        name: "perkos_list_tasks",
        description:
          "List the tasks on a PerkOS project board, with status and assigned agent.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string", description: "Project id from perkos_list_projects." },
          },
          required: ["projectId"],
        },
        async execute(args) {
          const projectId = String(args.projectId ?? "");
          if (!projectId) throw new Error("projectId is required");
          return text(await call(`/api/projects/${encodeURIComponent(projectId)}/tasks`));
        },
      },
      {
        name: "perkos_create_task",
        description:
          "Create a task on a PerkOS project board, optionally assigned to an agent by name.",
        inputSchema: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            name: { type: "string", description: "Short title for the task." },
            prompt: { type: "string", description: "What the assignee should do." },
            agent: { type: "string", description: "Agent name to assign, optional." },
          },
          required: ["projectId", "name"],
        },
        async execute(args) {
          const projectId = String(args.projectId ?? "");
          const name = String(args.name ?? "").trim();
          if (!projectId || !name) throw new Error("projectId and name are required");
          return text(
            await call(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
              method: "POST",
              body: JSON.stringify({
                tasks: [
                  {
                    name,
                    ...(args.prompt ? { prompt: String(args.prompt) } : {}),
                    ...(args.agent ? { agent: String(args.agent) } : {}),
                  },
                ],
              }),
            }),
          );
        },
      },
    ];

    const everything = [...publicTools, ...sessionTools];
    publish(context, everything, publishedRef.current);
    publishedRef.current = everything;

  }, [address, isConnected]);

  return null;
}
