// ---------------------------------------------------------------------------
// Agent wizard — shared types + the branch/step machine.
//
// The wizard's root decision is HOW the agent runs ("method"). That fork
// drives everything downstream, so it is now Step 1 and the rest of the
// sequence is derived from it:
//
//   • perkos / vps  → PerkOS provisions or bundles a runtime. Full path:
//                     method → runtime → template → llm → capabilities → review
//   • external      → the user already has their own agent. We provision
//                     NOTHING; we register it + hand back an invitation
//                     prompt (see StepExternal / inviteAgent). Short path:
//                     method → external
//
// Each step lives in its own module under ./steps so it can evolve in
// isolation. This file is the single source of truth for the state shape
// and the step ordering both branches share.
// ---------------------------------------------------------------------------

import type { AgentRuntime } from "@/app/lib/perkosApi";
import type { LLMSource } from "@/app/lib/agentConfigPreview";
import type { SkillPack } from "@/app/lib/skillsCatalog";

/** Root fork: how the agent will run. */
export type LaunchMethod = "perkos" | "vps" | "external";

// Wizard-side deploy labels. "perkos-ecs" is the platform-managed Fargate
// path (wire value "perkos-managed"); "self-hosted" is the docker-compose
// bundle the user runs on their own host / VPS. "imported" is retired from
// the wizard — the "I already have an agent" case is now the `external`
// method, which goes through the invite flow instead of launchAgent.
export type DeployMode = "perkos-ecs" | "self-hosted" | "imported";

/** For the external branch: which API shape the user's runtime speaks. */
export type RuntimeKindChoice = "hermes" | "openclaw" | "custom";

/** Ordered keys for every screen either branch can show. */
export type StepKey =
  | "method"
  | "runtime"
  | "template"
  | "llm"
  | "capabilities"
  | "channels"
  | "review"
  | "external";

export type WizardState = {
  // Step 1 — method (root fork)
  method: LaunchMethod | null;
  /** Derived from `method` for the managed branches; null for external. */
  deployMode: DeployMode | null;

  // Template — persona + name + soul override
  personaId: string | null;
  agentName: string;
  systemPromptOverride: string;

  // Runtime (managed branch) — Hermes / OpenClaw + the admin-approved image.
  runtime: AgentRuntime | null;
  imageTag: string | null;

  // External branch — what the user's existing runtime speaks + where it
  // listens + a note that rides along in the invitation prompt.
  runtimeKind: RuntimeKindChoice | null;
  importedHermesApiUrl: string;
  externalNote: string;

  // LLM
  llmSource: LLMSource | null;
  byokProvider: string;
  byokModel: string;
  byokApiKey: string;

  // Capabilities — plugins + channels + open-source skill packs.
  channels: string[];
  plugins: string[];
  skills: string[];
  communitySkills: SkillPack[];
  /** Built-in tools the wallet turned OFF in the Capabilities step. Empty =
   *  every built-in tool stays on (default). Each id is a CAPABILITY_ID; the
   *  launch payload sends it as `disabledTools` and the runtime entrypoints
   *  translate it to OpenClaw tools.deny / a Hermes custom toolset. */
  disabledTools: string[];

  // Messaging gateways. Each enabled entry is POSTed to
  // /api/agents/{agentId}/gateways right after launchAgent returns. Secrets
  // live in client memory only until that POST completes — never persisted,
  // never in the launch payload.
  gatewayTelegramEnabled: boolean;
  gatewayTelegramBotToken: string;
  gatewayTelegramWebhookUrl: string;
  gatewayFarcasterEnabled: boolean;
  gatewayFarcasterNeynarApiKey: string;
  gatewayFarcasterSignerUuid: string;
  gatewayFarcasterWebhookSecret: string;
  gatewayFarcasterFid: string;
  gatewayFarcasterReplyVisibility: string;
  gatewayFarcasterParentChannel: string;
  gatewaySlackEnabled: boolean;
  gatewaySlackBotToken: string;
  gatewaySlackSigningSecret: string;
  gatewaySlackChannelId: string;
};

export const INITIAL_WIZARD_STATE: WizardState = {
  method: null,
  deployMode: null,
  personaId: null,
  agentName: "",
  systemPromptOverride: "",
  runtime: null,
  imageTag: null,
  runtimeKind: null,
  importedHermesApiUrl: "",
  externalNote: "",
  llmSource: null,
  byokProvider: "",
  byokModel: "",
  byokApiKey: "",
  channels: [],
  plugins: [],
  skills: [],
  communitySkills: [],
  disabledTools: [],
  gatewayTelegramEnabled: false,
  gatewayTelegramBotToken: "",
  gatewayTelegramWebhookUrl: "",
  gatewayFarcasterEnabled: false,
  gatewayFarcasterNeynarApiKey: "",
  gatewayFarcasterSignerUuid: "",
  gatewayFarcasterWebhookSecret: "",
  gatewayFarcasterFid: "",
  gatewayFarcasterReplyVisibility: "mentions",
  gatewayFarcasterParentChannel: "",
  gatewaySlackEnabled: false,
  gatewaySlackBotToken: "",
  gatewaySlackSigningSecret: "",
  gatewaySlackChannelId: "",
};

/** Map a chosen method to the managed deploy mode (null for external). */
export function methodToDeployMode(method: LaunchMethod | null): DeployMode | null {
  if (method === "perkos") return "perkos-ecs";
  if (method === "vps") return "self-hosted";
  return null; // external never launches through deployMode
}

/** The screen sequence for a given method. Drives the stepper + nav. */
export function stepsForMethod(method: LaunchMethod | null): StepKey[] {
  if (method === "external") return ["method", "external"];
  if (method === "perkos" || method === "vps") {
    // Runtime (Hermes/OpenClaw) is no longer a standalone step — it's resolved
    // inside the template step. Capabilities (built-in tools + skills) and
    // Channels (native messaging gateways) are separate steps, mirroring how
    // both runtimes split tools vs gateways in their own setup flows.
    return ["method", "template", "llm", "capabilities", "channels", "review"];
  }
  return ["method"]; // nothing picked yet
}

/** API-compatible agent handle used by every launch/invite path. */
export const AGENT_NAME_RE = /^[a-zA-Z0-9_-]{2,32}$/;
export const EXTERNAL_NAME_RE = AGENT_NAME_RE;

/** Turn a display label such as "Customer Support" into a valid default. */
export function normalizeAgentName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/[-_]{2,}/g, "-")
    .slice(0, 32);
}

export function resolveAgentName(value: string, fallback: string): string {
  return value.trim() || normalizeAgentName(fallback) || "Untitled-agent";
}

export function isValidAgentName(value: string): boolean {
  return AGENT_NAME_RE.test(value.trim());
}

/** Props every step module receives: the form state + a patch updater. */
export type StepProps = {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
};
