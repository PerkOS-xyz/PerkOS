"use client";

import { useEffect } from "react";

import { useAppAccount } from "../lib/useAppAccount";

/**
 * Exposes PerkOS actions to an agent running inside the user's own browser,
 * via the WebMCP API.
 *
 * ## The security posture, which is the whole design
 *
 * These tools act as the SIGNED-IN USER. That is the point of WebMCP — the
 * agent is in the person's browser, working on their behalf — but it means
 * anything registered here is reachable by any agent in that tab. So the set
 * is deliberately narrow:
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

type ModelContext = {
  provideContext: (context: { tools: WebMcpTool[] }) => void;
};

function modelContext(): ModelContext | null {
  if (typeof navigator === "undefined") return null;
  const candidate = (navigator as Navigator & { modelContext?: ModelContext })
    .modelContext;
  return candidate && typeof candidate.provideContext === "function"
    ? candidate
    : null;
}

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }],
});

export function WebMcpTools() {
  const { address, isConnected } = useAppAccount();

  useEffect(() => {
    const context = modelContext();
    // Absent in browsers without WebMCP. Nothing to register, nothing to warn
    // about: the site works the same either way.
    if (!context || !isConnected || !address) return;

    let cancelled = false;

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

    const tools: WebMcpTool[] = [
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

    if (!cancelled) context.provideContext({ tools });

    return () => {
      cancelled = true;
      // Hand back an empty set on sign-out or unmount, so a shared machine
      // does not leave tools pointing at a session that has ended.
      modelContext()?.provideContext({ tools: [] });
    };
  }, [address, isConnected]);

  return null;
}
