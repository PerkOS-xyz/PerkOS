/**
 * PerkOS data layer — Firestore-backed.
 *
 * Every CRUD function in this file talks to Firestore from the browser using
 * the client SDK. Firestore rules enforce that the signed-in Firebase user
 * (uid = walletAddress.toLowerCase()) can only touch their own
 * `/wallets/{addr}/**` subtree.
 *
 * Function signatures and the `Project`, `Task`, `Agent`, `ChatMessage`,
 * `ProjectDetail`, `LaunchAgentResponse` types match the previous REST
 * contract so callers (React Query consumers, dialogs, pages) don't need to
 * change.
 *
 * Two functions still hit a REST backend rather than Firestore:
 *   - `launchAgent` — needs infra provisioning (ECS / Cloud Run), not just a
 *     doc write. Will migrate to a Cloud Function in a follow-up.
 *   - `assistantChat` / `assistantChatStream` — needs server-side LLM calls
 *     with the user's BYOK key. Will migrate to a Cloud Function too.
 *
 * Endpoint contract reference: `docs/API.md`.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type FirestoreDataConverter,
  type Timestamp,
} from "firebase/firestore";
import { isAllowedAgentHosting } from "@/app/lib/agentHostingPolicy";

import { firebaseDb } from "./firebase";
import { formatAddress } from "./format";
import { logActivity } from "./activityEvents";
import { entityKey, writeEdge } from "./edges";
import { validateSwarm, type SwarmDefinition } from "./swarm";

export type PmSessionStatus =
  | "planning"
  | "working"
  | "reviewing"
  | "done"
  | "stopped";

/**
 * Autonomous PM/orchestrator session state, persisted on the project doc.
 * Driven by the PerkOS-API `pm` worker; the UI reads it to show progress.
 */
export type PmSession = {
  status: PmSessionStatus;
  goal: string;
  round: number;
  taskIds: string[];
  maxRounds: number;
  maxTasksPerRound: number;
  reason?: string;
  lastRunAt?: string;
};

export type Project = {
  id?: string;
  name: string;
  goal?: string;
  status: string;
  agents: number;
  tasks: number;
  budget: string;
  /** The organization this project belongs to (wallets/{w}/organizations/{id}). */
  orgId?: string;
  /**
   * Wallet whose subtree holds this project. Differs from the signed-in wallet
   * for a project reached through an organization, and every WRITE has to
   * target it: reads resolved the owner while writes assumed the caller, so a
   * member got "No document to update" against a path that never existed.
   */
  ownerWallet?: string;
  agentIds?: string[];
  /**
   * Optional swarm definition: declarative roster of agents + roles for
   * this project's chat room. Set/exported via the swarm.yaml flow.
   */
  swarm?: SwarmDefinition;
  /** Display name of the agent designated as this project's PM/orchestrator. */
  pmAgent?: string | null;
  /** Autonomous PM session state (set by the PM route/worker). */
  pmSession?: PmSession;
  /** API-owned workflow; clients use it to disable invalid repeated actions. */
  workflow?: {
    phase?: "draft" | "planning" | "planning_failed" | "awaiting_approval" | "approved" | "running" | "pm_review" | "complete" | "cancelled";
    planId?: string;
    taskIds?: string[];
    planningAttempt?: number;
    planningMaxAttempts?: number;
    failureReason?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type TaskStatus = "Backlog" | "In progress" | "Review" | "Done";

export type Task = {
  id?: string;
  name: string;
  status: TaskStatus | string;
  priority: "High" | "Medium" | "Low" | string;
  agent: string;
  agentId?: string;
  prompt?: string;
  result?: string;
  logs?: string[];
  /** Files attached when the task was created or edited (same shape as chat). */
  attachments?: TaskAttachment[];
  createdAt?: string;
  updatedAt?: string;
};

/**
 * A file attached to a task. Identical shape to a chat attachment, so the same
 * `uploadAttachment` helper produces both and the same Markdown renderer shows
 * them. The url is a Firebase Storage download URL: it carries its own
 * capability token, which is how the assigned agent can fetch the image.
 */
export type TaskAttachment = {
  name: string;
  url: string;
  contentType?: string;
  isImage?: boolean;
  size?: number;
};

export type ProjectMeetingStatus =
  | "draft"
  | "lobby"
  | "live"
  | "processing_notes"
  | "needs_review"
  | "completed"
  | "failed";

export type MeetingProposal = {
  id: string;
  title: string;
  desc?: string;
  acceptance?: string;
  priority?: string;
  suggestedAgent?: string;
  materializedTaskId?: string | null;
};

export type ProjectMeeting = {
  id: string;
  projectId: string;
  title: string;
  status: ProjectMeetingStatus;
  pmAgent: string;
  roomName: string;
  notesDocId?: string | null;
  transcriptPolicy: "ephemeral" | "saved";
  recordingPolicy: "off" | "audio" | "video";
  durationMinutes: number;
  createdAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  proposals?: MeetingProposal[];
};

// ---------------------------------------------------------------------------
// Collaborative docs workspace ("Notes")
// ---------------------------------------------------------------------------

/** A doc's kind. A `plan` doc carries plan blocks + a status banner. */
export type DocType = "note" | "plan" | "spec";

/** One doc in a project's docs tree. */
export type Doc = {
  id?: string;
  type: DocType | string;
  title?: string | null;
  /** plan docs only: the lifecycle status. */
  status?: PlanStatus | string | null;
  /** Parent doc/folder id for nesting (flat at MVP → usually null). */
  parentId?: string | null;
  /** PM-created docs land as drafts until a human promotes them. */
  draft?: boolean;
  order?: number;
  createdBy?: string | null;
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
};

/** Lifecycle of a plan doc. */
export type PlanStatus =
  | "draft"
  | "under_discussion"
  | "plan_proposed"
  | "approved"
  | "materialized";

export type PlanBlockType = "note" | "planGroup" | "planTask";

/**
 * One block of a plan doc. Block-level ownership (not a CRDT): humans own
 * `note` blocks; the PM agent owns `planGroup`/`planTask` blocks. `owner` is
 * "user:0x…" or "agent:<name>". Only the fields relevant to `type` are set.
 */
export type PlanBlock = {
  id?: string;
  type: PlanBlockType;
  order: number;
  owner?: string | null;
  // note
  text?: string | null;
  // planGroup / planTask
  title?: string | null;
  // planTask
  groupId?: string | null;
  desc?: string | null;
  suggestedAgent?: string | null;
  acceptance?: string | null;
  deps?: string[];
  materializedTaskId?: string | null;
  updatedAt?: string;
};

export type PlanDoc = {
  id?: string;
  status: PlanStatus | string;
  title?: string | null;
  revision?: number;
  approvedBy?: string | null;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type DocRevision = {
  id?: string;
  revision?: number;
  actor: string;
  action: string;
  blockId?: string | null;
  summary?: string | null;
  before?: string | null;
  after?: string | null;
  createdAt?: string;
};

/**
 * @deprecated Project group chat messages no longer live in Firestore.
 * The new chat layer uses the `Conversation` model in `conversationsApi.ts`
 * and stores message bodies on the host agent's filesystem (C-hybrid
 * privacy model). These types and the related read/write helpers remain
 * for compatibility while the UI still references them; new code should
 * use `Conversation` + the chat WebSocket client.
 */
export type ChatMessage = {
  id?: string;
  from: "agent" | "user";
  text: string;
  agentName?: string;
  /** Structured @-mention identities: "user:0x…" / "agent:Name". */
  mentions?: string[];
  createdAt?: string;
};

/**
 * @deprecated See `ChatMessage` deprecation note. `messages` will become an
 * empty array once the UI migrates to the conversation-based chat layer;
 * callers should subscribe via `useConversations` / `useConversation`
 * instead.
 */
export type ProjectDetail = {
  project: Project;
  tasks: Task[];
  messages: ChatMessage[];
};

// Agent, AgentRuntime, LaunchAgentCredentials are the canonical platform
// shapes — sourced from `@perkos/shared-types` so server (PerkOS-API) and
// every client agree on the wire format.
export type {
  Agent,
  AgentRuntime,
  DeployBundle,
  DeployMode,
  LaunchAgentCredentials,
  RuntimeKind,
} from "@perkos/shared-types";
import type {
  Agent,
  AgentRuntime,
  DeployBundle,
  LaunchAgentCredentials,
  RuntimeKind,
} from "@perkos/shared-types";

/**
 * App-local launch response. Slimmer than the platform `LaunchAgentResponse`
 * (which surfaces jobId for the async provisioning queue) — the mini-app
 * doesn't render that field today. Keeps the existing call sites unchanged.
 */
export type LaunchAgentResponse = {
  ok: boolean;
  launchId: string;
  /** One-shot credentials. Present on successful provisioning only. */
  credentials?: LaunchAgentCredentials;
  /** Present on self-hosted / imported deploys; absent for perkos-managed. */
  deployBundle?: DeployBundle;
  /**
   * Self-hosted only: a ready-to-paste one-line installer
   * (`curl … | PERKOS_TOKEN=… bash`) backed by a one-shot token. Lets a
   * non-technical user run a single command instead of pasting the bundle.
   */
  installCommand?: string;
  result: {
    mode?: string;
    status?: string;
    taskArn?: string;
    agent?: Agent;
  };
};

/** Browser-visible API entrypoint. The upstream host is resolved server-side. */
export const perkosApiBaseUrl = "/api/platform";

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

function normalize(address: string): string {
  return address.toLowerCase();
}

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return undefined;
}

const projectConverter: FirestoreDataConverter<Project> = {
  toFirestore(project) {
    // Drop client-only fields and Firestore-managed fields.
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = project;
    return rest;
  },
  fromFirestore(snap) {
    const data = snap.data();
    // Defensively validate the persisted swarm; surface only if it still
    // matches the current schema. Older projects without a swarm field
    // are unchanged.
    let swarm: SwarmDefinition | undefined;
    if (data.swarm && typeof data.swarm === "object") {
      const v = validateSwarm(data.swarm);
      if (v.ok) swarm = v.swarm;
    }
    // PM session is written by the API/worker; read it loosely (Timestamps →
    // ISO) so the UI can render status without re-asserting the full shape.
    let pmSession: PmSession | undefined;
    if (data.pmSession && typeof data.pmSession === "object") {
      const s = data.pmSession as Record<string, unknown>;
      pmSession = {
        status: (s.status as PmSessionStatus) ?? "stopped",
        goal: (s.goal as string) ?? "",
        round: (s.round as number) ?? 0,
        taskIds: (s.taskIds as string[] | undefined) ?? [],
        maxRounds: (s.maxRounds as number) ?? 0,
        maxTasksPerRound: (s.maxTasksPerRound as number) ?? 0,
        reason: typeof s.reason === "string" ? s.reason : undefined,
        lastRunAt: tsToIso(s.lastRunAt),
      };
    }
    let workflow: Project["workflow"];
    if (data.workflow && typeof data.workflow === "object") {
      const value = data.workflow as Record<string, unknown>;
      workflow = {
        phase: typeof value.phase === "string"
          ? value.phase as NonNullable<Project["workflow"]>["phase"]
          : "draft",
        planId: typeof value.planId === "string" ? value.planId : undefined,
        taskIds: Array.isArray(value.taskIds)
          ? value.taskIds.filter((id): id is string => typeof id === "string")
          : [],
        planningAttempt: typeof value.planningAttempt === "number" ? value.planningAttempt : undefined,
        planningMaxAttempts: typeof value.planningMaxAttempts === "number" ? value.planningMaxAttempts : undefined,
        failureReason: typeof value.failureReason === "string" ? value.failureReason : undefined,
      };
    }
    return {
      id: snap.id,
      name: (data.name as string) ?? "",
      goal: (data.goal as string) ?? "",
      status: (data.status as string) ?? "Active",
      agents: (data.agents as number) ?? 0,
      tasks: (data.tasks as number) ?? 0,
      budget: (data.budget as string) ?? "0 USDC",
      orgId: (data.orgId as string | undefined) ?? undefined,
      agentIds: (data.agentIds as string[] | undefined) ?? [],
      swarm,
      pmAgent: (data.pmAgent as string | null | undefined) ?? null,
      pmSession,
      workflow,
      createdAt: tsToIso(data.createdAt),
      updatedAt: tsToIso(data.updatedAt),
    };
  },
};

const taskConverter: FirestoreDataConverter<Task> = {
  toFirestore(task) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = task;
    return rest;
  },
  fromFirestore(snap) {
    const data = snap.data();
    return {
      id: snap.id,
      name: (data.name as string) ?? "",
      status: (data.status as Task["status"]) ?? "Backlog",
      priority: (data.priority as Task["priority"]) ?? "Medium",
      agent: (data.agent as string) ?? "",
      agentId: (data.agentId as string | undefined) ?? undefined,
      prompt: (data.prompt as string | undefined) ?? undefined,
      result: (data.result as string | undefined) ?? undefined,
      logs: (data.logs as string[] | undefined) ?? undefined,
      attachments: Array.isArray(data.attachments)
        ? (data.attachments as TaskAttachment[])
        : undefined,
      createdAt: tsToIso(data.createdAt),
      updatedAt: tsToIso(data.updatedAt),
    };
  },
};

const messageConverter: FirestoreDataConverter<ChatMessage> = {
  toFirestore(message) {
    const { id: _id, createdAt: _c, ...rest } = message;
    return rest;
  },
  fromFirestore(snap) {
    const data = snap.data();
    return {
      id: snap.id,
      from: (data.from as ChatMessage["from"]) ?? "user",
      text: (data.text as string) ?? "",
      agentName: (data.agentName as string | undefined) ?? undefined,
      createdAt: tsToIso(data.createdAt),
    };
  },
};

/**
 * `Agent` plus the BYO/hosting fields the UI needs to gate lifecycle actions.
 * `external` agents (invited / self-hosted / imported) run on the user's own
 * infra, so they CAN'T be hibernated/woken (that's ECS scale-to-0, PerkOS-only).
 */
export const SPEECH_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable", "onyx",
  "nova", "sage", "shimmer", "verse", "marin", "cedar",
] as const;
export type SpeechVoice = (typeof SPEECH_VOICES)[number];
export function isSpeechVoice(value: unknown): value is SpeechVoice {
  return typeof value === "string" && (SPEECH_VOICES as readonly string[]).includes(value);
}

export type AgentRow = Agent & {
  /**
   * True when the agent belongs to another wallet and reached the caller
   * through an organization. Its owner keeps every destructive control.
   */
  shared?: boolean;
  /** Wallet that owns the agent (differs from the caller when `shared`). */
  ownerWallet?: string;
  /** Name of the organization the agent came in through, when shared. */
  sharedVia?: string | null;
  /** User-facing label; `name` remains the immutable relay/runtime identity. */
  displayName?: string;
  /** Spoken TTS voice. Distinct from `soul.voice`, which is textual persona. */
  speechVoice?: SpeechVoice;
  soul?: string;
  skillIds?: string[];
  disabledTools?: string[];
  /** True only for PerkOS-managed ECS agents (including legacy ECS records). */
  managed?: boolean;
  /** True for an agent installed by the user on their own VPS. */
  selfHosted?: boolean;
  external?: boolean;
  /**
   * True for agents registered via the "invite" flow (deployMode "invited").
   * The shared `deployMode` enum omits "invited", so we surface it as its own
   * flag — it gates the relay-key credential panel + stale-invite detection.
   * (`bridgeConnected` / `lastBridgeSeenAt` already live on the shared `Agent`.)
   */
  invited?: boolean;
  /**
   * True once the owner revoked the credential. The raw Firestore `status`
   * holds "revoked", but the shared `Agent.status` enum doesn't model it, so we
   * normalize `status` to "unknown" and expose this flag instead.
   */
  revoked?: boolean;
  /** Owner-supplied context shown in the invite prompt. */
  note?: string | null;
  /** When set, this agent is a CO-RESIDENT running inside the host agent named
   *  here (Phase 1 multi-agent), not on its own runtime. */
  hostAgent?: string | null;
  /** Bridge-reported execution readiness; distinct from relay/chat transport. */
  runtimeStatus?: "healthy" | "unreachable" | "unknown" | null;
  runtimeHealthy?: boolean;
  runtimeHealthCheckedAt?: string | null;
  lastRuntimeSeenAt?: string | null;
  /** Fresh, Chat-bound proof that this bridge can consume maintenance markers. */
  maintenanceCapability?: A2AMaintenanceCapability | null;
};

export type A2AMaintenanceCapability = {
  protocolVersion: number;
  bridgeInstanceId: string;
  seenAt: string;
  expiresAt: string;
};

const agentConverter: FirestoreDataConverter<AgentRow> = {
  toFirestore(agent) {
    const { id: _id, ...rest } = agent;
    return rest;
  },
  fromFirestore(snap) {
    const data = snap.data();
    const rawDeployMode = typeof data.deployMode === "string" ? data.deployMode : undefined;
    const rawStatus = typeof data.status === "string" ? data.status : "unknown";
    const ecsServiceArn = (data.ecs as { serviceArn?: unknown } | undefined)?.serviceArn;
    // The shared `Agent.status` enum only models the ECS lifecycle. Invited
    // agents add "invited"/"revoked" — fold those into "unknown" for the typed
    // field and surface them via the `invited`/`revoked` flags below.
    const status = (["provisioning", "ready", "failed", "unknown"].includes(rawStatus)
      ? rawStatus
      : "unknown") as Agent["status"];
    return {
      id: snap.id,
      name: (data.name as string) ?? "",
      displayName: (data.displayName as string | undefined) ?? undefined,
      speechVoice: isSpeechVoice(data.speechVoice) ? data.speechVoice : "alloy",
      runtime: (data.runtime as AgentRuntime) ?? "Hermes",
      status,
      walletAddress: (data.walletAddress as string) ?? "",
      plugins: (data.plugins as string[] | undefined) ?? [],
      soul: (data.soul as string | undefined) ?? undefined,
      skillIds: (data.skillIds as string[] | undefined) ?? [],
      disabledTools: (data.disabledTools as string[] | undefined) ?? [],
      taskArn: (data.taskArn as string | undefined) ?? undefined,
      endpoint: (data.endpoint as string | undefined) ?? undefined,
      createdAt: tsToIso(data.createdAt),
      image: (data.image as string | undefined) ?? undefined,
      modelKeyProvided: (data.modelKeyProvided as boolean | undefined) ?? undefined,
      upstreamVersion:
        ((data.ecs as { upstreamVersion?: string | null } | undefined)
          ?.upstreamVersion ??
          (data.upstreamVersion as string | null | undefined)) ??
        null,
      external:
        data.external === true ||
        rawDeployMode === "invited" ||
        rawDeployMode === "self-hosted" ||
        rawDeployMode === "imported",
      invited: rawDeployMode === "invited",
      selfHosted: rawDeployMode === "self-hosted",
      managed:
        rawDeployMode === "perkos-managed" ||
        (typeof ecsServiceArn === "string" && ecsServiceArn.length > 0),
      revoked: rawStatus === "revoked",
      bridgeConnected:
        typeof data.bridgeConnected === "boolean" ? data.bridgeConnected : undefined,
      lastBridgeSeenAt: tsToIso(data.lastBridgeSeenAt),
      runtimeStatus:
        data.runtimeStatus === "healthy" ||
        data.runtimeStatus === "unreachable" ||
        data.runtimeStatus === "unknown"
          ? data.runtimeStatus
          : null,
      runtimeHealthy: data.runtimeHealthy === true,
      runtimeHealthCheckedAt: tsToIso(data.runtimeHealthCheckedAt),
      lastRuntimeSeenAt: tsToIso(data.lastRuntimeSeenAt),
      runtimeVersion: typeof data.runtimeVersion === "string" ? data.runtimeVersion : undefined,
      maintenanceCapability: (() => {
        const value = data.maintenanceCapability as Record<string, unknown> | null | undefined;
        return value
          && typeof value.protocolVersion === "number"
          && typeof value.bridgeInstanceId === "string"
          && typeof value.seenAt === "string"
          && typeof value.expiresAt === "string"
          ? value as A2AMaintenanceCapability
          : null;
      })(),
      note: typeof data.note === "string" ? data.note : null,
      hostAgent: typeof data.hostAgent === "string" ? data.hostAgent : null,
    };
  },
};

function isAllowedAgentRow(agent: AgentRow): boolean {
  return isAllowedAgentHosting(agent);
}

function projectsCol(walletAddress: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects"
  ).withConverter(projectConverter);
}

function projectDoc(walletAddress: string, projectId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId
  ).withConverter(projectConverter);
}

/** Subscribe to the project document itself (status, PM and workflow phase). */
export function subscribeProject(
  walletAddress: string,
  projectId: string,
  onData: (project: Project | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    projectDoc(walletAddress, projectId),
    (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
    (error) => onError?.(error),
  );
}

function tasksCol(walletAddress: string, projectId: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "tasks"
  ).withConverter(taskConverter);
}

function messagesCol(walletAddress: string, projectId: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "messages"
  ).withConverter(messageConverter);
}

function docsCol(walletAddress: string, projectId: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "docs"
  );
}

function docDoc(walletAddress: string, projectId: string, docId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "docs",
    docId
  );
}

function docMessagesCol(
  walletAddress: string,
  projectId: string,
  docId: string
) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "docs",
    docId,
    "messages"
  );
}

function agentsCol(walletAddress: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "agents"
  ).withConverter(agentConverter);
}

function agentDoc(walletAddress: string, agentId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "agents",
    agentId
  ).withConverter(agentConverter);
}

// ---------------------------------------------------------------------------
// Overview / aggregates
// ---------------------------------------------------------------------------

export type OverviewStats = {
  activeProjects: number;
  registeredAgents: number;
  activeTasks: number;
  completedTasks: number;
};

export type Overview = {
  stats: OverviewStats;
  projects: Project[];
  tasks: Task[];
  agents: Agent[];
};

/**
 * Compute dashboard stats by fetching projects + a sample of tasks. Cheap
 * enough for an alpha-scale workspace; once volume grows, denormalize counts
 * into the wallet root doc and read those instead.
 */
export async function getWalletOverview(
  walletAddress: string
): Promise<Overview> {
  // Agents come from getWalletAgents, not a direct read, so the dashboard
  // counts cannot disagree with the Agents page. Reading agentsCol here is what
  // made the dashboard contradict ITSELF: the header's live strip already
  // included organization agents while this said "No agents registered yet"
  // and "0/0" on the same screen.
  const [projectsSnap, agents] = await Promise.all([
    getDocs(projectsCol(walletAddress)),
    getWalletAgents(walletAddress),
  ]);

  const projects = projectsSnap.docs.map((d) => d.data());

  // Pull recent tasks across all projects. Limited fan-out for now.
  const taskBundles = await Promise.all(
    projects
      .filter((p): p is Project & { id: string } => Boolean(p.id))
      .map(async (p) => {
        const snap = await getDocs(tasksCol(walletAddress, p.id));
        return snap.docs.map((d) => d.data());
      })
  );
  const tasks = taskBundles.flat();

  const stats: OverviewStats = {
    activeProjects: projects.filter(
      (p) => (p.status ?? "").toLowerCase() === "active"
    ).length,
    registeredAgents: agents.length,
    activeTasks: tasks.filter(
      (t) => t.status === "In progress" || t.status === "Review"
    ).length,
    completedTasks: tasks.filter((t) => t.status === "Done").length,
  };

  return { stats, projects, tasks: tasks.slice(0, 25), agents };
}

// ---------------------------------------------------------------------------
// Organizations
//
// Every wallet has at least one org (a default "Org 0x…" created on first
// login). Projects belong to an org via `project.orgId`. Orgs live at
// `wallets/{w}/organizations/{orgId}`.
// ---------------------------------------------------------------------------

export type OrgRole = "owner" | "editor" | "viewer";

export type Organization = {
  id?: string;
  name: string;
  ownerWallet: string;
  /** The auto-created default org for the wallet (can't be deleted). */
  isDefault?: boolean;
  createdAt?: string;
  /** Set for orgs SHARED with the current user (owned by another wallet). */
  shared?: boolean;
  /** The current user's role in this org (owner for own orgs). */
  role?: OrgRole;
};

const organizationConverter: FirestoreDataConverter<Organization> = {
  toFirestore(org) {
    const { id: _id, createdAt: _c, ...rest } = org;
    return rest;
  },
  fromFirestore(snap) {
    const d = snap.data();
    return {
      id: snap.id,
      name: (d.name as string) ?? "",
      ownerWallet: (d.ownerWallet as string) ?? "",
      isDefault: (d.isDefault as boolean | undefined) ?? false,
      createdAt: tsToIso(d.createdAt),
    };
  },
};

function orgsCol(walletAddress: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "organizations"
  ).withConverter(organizationConverter);
}

function orgDoc(walletAddress: string, orgId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "organizations",
    orgId
  ).withConverter(organizationConverter);
}

/** All of the wallet's OWN organizations, default org first. */
export async function getWalletOrgs(
  walletAddress: string
): Promise<Organization[]> {
  const snap = await getDocs(orgsCol(walletAddress));
  return snap.docs
    .map((d) => ({ ...d.data(), role: "owner" as OrgRole, shared: false }))
    .sort((a, b) =>
      a.isDefault === b.isDefault ? a.name.localeCompare(b.name) : a.isDefault ? -1 : 1
    );
}

/**
 * Organizations SHARED with this wallet (owned by others).
 *
 * Reads the member's own `sharedOrgs` discovery pointers, then REQUIRES an
 * active membership doc at:
 *   wallets/{owner}/organizations/{orgId}/members/{me}
 *
 * A dangling/stale pointer (no member doc, removed status, missing org, or
 * pointer to self) is skipped and best-effort deleted so the UI only lists
 * orgs the wallet is actually part of.
 */
export function isActiveMembershipStatus(status: unknown): boolean {
  if (status == null || status === "") return true; // legacy docs default active
  return String(status).toLowerCase() === "active";
}

export async function getSharedOrgs(
  walletAddress: string
): Promise<Organization[]> {
  const me = normalize(walletAddress);
  const ptrs = await getDocs(
    collection(firebaseDb(), "wallets", me, "sharedOrgs")
  );
  const out = await Promise.all(
    ptrs.docs.map(async (d) => {
      const p = d.data() as {
        ownerWallet?: string;
        orgId?: string;
        role?: string;
        orgName?: string;
      };
      const owner = p.ownerWallet ? normalize(p.ownerWallet) : "";
      const orgId = ((p.orgId ?? d.id) || "").trim();
      if (!owner || !orgId) {
        await deleteDoc(d.ref).catch(() => {});
        return null;
      }
      // Own orgs come from getWalletOrgs — never surface them as "shared".
      if (owner === me) {
        await deleteDoc(d.ref).catch(() => {});
        return null;
      }
      try {
        const memberRef = doc(
          firebaseDb(),
          "wallets",
          owner,
          "organizations",
          orgId,
          "members",
          me
        );
        const memberSnap = await getDoc(memberRef);
        if (!memberSnap.exists()) {
          await deleteDoc(d.ref).catch(() => {});
          return null;
        }
        const member = memberSnap.data() as { status?: string; role?: string };
        if (!isActiveMembershipStatus(member.status)) {
          await deleteDoc(d.ref).catch(() => {});
          return null;
        }

        const snap = await getDoc(orgDoc(owner, orgId));
        if (!snap.exists()) {
          await deleteDoc(d.ref).catch(() => {});
          return null;
        }
        const name =
          (snap.data().name && String(snap.data().name).trim()) ||
          p.orgName ||
          "Shared org";
        const role = (member.role as OrgRole | undefined) ??
          (p.role as OrgRole | undefined) ??
          "viewer";
        return {
          id: orgId,
          name,
          ownerWallet: owner,
          isDefault: false,
          shared: true,
          role,
        } as Organization;
      } catch {
        return null; // access revoked / rules denied — skip
      }
    })
  );
  return out.filter((o): o is Organization => o !== null);
}

/**
 * Projects for an org — works for both OWN orgs (read all + client-filter,
 * handles legacy no-orgId) and SHARED orgs (a cross-wallet `where orgId==`
 * query on the owner's projects, which the membership rules permit).
 */
export async function getOrgProjects(input: {
  org: Pick<Organization, "id" | "ownerWallet" | "shared">;
  myWallet: string;
  defaultOrgId?: string;
}): Promise<Project[]> {
  const orgId = input.org.id;
  const owner = input.org.ownerWallet || input.myWallet;
  if (input.org.shared && owner.toLowerCase() !== input.myWallet.toLowerCase()) {
    const snap = await getDocs(
      query(projectsCol(owner), where("orgId", "==", orgId))
    );
    return snap.docs.map((d) => ({ ...d.data(), ownerWallet: owner }));
  }
  const snap = await getDocs(projectsCol(owner));
  return snap.docs
    .map((d) => ({ ...d.data(), ownerWallet: owner }))
    .filter((p) => (p.orgId ?? input.defaultOrgId) === orgId);
}

/**
 * Stand-alone projects shared directly with this wallet (not via an org).
 * Reads the member's `sharedProjects` pointers + loads each owner's project.
 */
export async function getSharedProjects(
  walletAddress: string
): Promise<Array<Project & { ownerWallet: string }>> {
  const me = normalize(walletAddress);
  const ptrs = await getDocs(
    collection(firebaseDb(), "wallets", me, "sharedProjects")
  );
  const out = await Promise.all(
    ptrs.docs.map(async (d) => {
      const p = d.data() as { ownerWallet?: string; projectId?: string; status?: string };
      const owner = p.ownerWallet ? normalize(p.ownerWallet) : "";
      const pid = ((p.projectId ?? d.id) || "").trim();
      if (!owner || !pid || owner === me) {
        await deleteDoc(d.ref).catch(() => {});
        return null;
      }
      try {
        // Prefer explicit project membership; org-level access is handled via
        // shared orgs, not stand-alone project pointers.
        const memberSnap = await getDoc(
          doc(firebaseDb(), "wallets", owner, "projects", pid, "members", me)
        );
        if (!memberSnap.exists() || !isActiveMembershipStatus(memberSnap.data()?.status)) {
          await deleteDoc(d.ref).catch(() => {});
          return null;
        }
        const snap = await getDoc(projectDoc(owner, pid));
        if (!snap.exists()) {
          await deleteDoc(d.ref).catch(() => {});
          return null;
        }
        return { ...snap.data(), ownerWallet: owner };
      } catch {
        return null;
      }
    })
  );
  return out.filter((p): p is Project & { ownerWallet: string } => p !== null);
}

export async function createOrg(input: {
  walletAddress: string;
  name: string;
  isDefault?: boolean;
}): Promise<Organization> {
  const ref = doc(orgsCol(input.walletAddress));
  const payload: Organization = {
    name: input.name.trim() || "Untitled org",
    ownerWallet: normalize(input.walletAddress),
    isDefault: input.isDefault ?? false,
  };
  await setDoc(ref, { ...payload, createdAt: serverTimestamp() });
  return { ...payload, id: ref.id };
}

export async function updateOrgName(input: {
  walletAddress: string;
  orgId: string;
  name: string;
}): Promise<void> {
  await updateDoc(orgDoc(input.walletAddress, input.orgId), {
    name: input.name.trim() || "Untitled org",
  });
}

/**
 * Onboarding: guarantee the wallet has a default org. If none exist, create
 * "Org 0x…{last4}" (isDefault) and backfill any existing org-less projects
 * onto it. Idempotent — safe to call on every app load. Returns all orgs.
 */
export async function ensureDefaultOrg(
  walletAddress: string,
  opts?: { defaultName?: string }
): Promise<Organization[]> {
  let orgs = await getWalletOrgs(walletAddress);
  if (orgs.length > 0) return orgs;

  const last4 = normalize(walletAddress).slice(-4);
  // Name the default org from the migrated legacy name (if the caller found
  // one), else the wallet-derived fallback.
  const name = opts?.defaultName?.trim() || `Org 0x…${last4}`;
  const def = await createOrg({
    walletAddress,
    name,
    isDefault: true,
  });
  orgs = [def];

  // Backfill existing projects that predate orgs onto the default org.
  const projSnap = await getDocs(projectsCol(walletAddress));
  await Promise.all(
    projSnap.docs
      .filter((d) => !d.data().orgId)
      .map((d) =>
        updateDoc(projectDoc(walletAddress, d.id), { orgId: def.id }).catch(
          () => {}
        )
      )
  );
  return orgs;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getWalletProjects(
  walletAddress: string,
  orgId?: string,
  defaultOrgId?: string
): Promise<{ projects: Project[] }> {
  const snap = await getDocs(projectsCol(walletAddress));
  let projects = snap.docs.map((d) => d.data());
  // Client-side org filter (alpha scale — no composite index needed). A
  // project with no orgId is treated as belonging to the DEFAULT org, so
  // legacy/unbackfilled projects show under the default org only.
  if (orgId) {
    projects = projects.filter((p) => (p.orgId ?? defaultOrgId) === orgId);
  }
  return { projects };
}

export async function getWalletProject(input: {
  walletAddress: string;
  projectId: string;
}): Promise<ProjectDetail> {
  const projectSnap = await getDoc(
    projectDoc(input.walletAddress, input.projectId)
  );
  if (!projectSnap.exists()) {
    throw new Error("Project not found.");
  }
  const project = projectSnap.data();

  const [tasksSnap, messagesSnap] = await Promise.all([
    getDocs(tasksCol(input.walletAddress, input.projectId)),
    getDocs(
      query(
        messagesCol(input.walletAddress, input.projectId),
        orderBy("createdAt", "asc")
      )
    ),
  ]);

  // The wallet's /agents collection powers ONLY the roster self-heal below.
  // A member viewing a SHARED project (walletAddress = the owner) can't read
  // the owner's /agents (by design — members are scoped to the org/project,
  // not the owner's agents), so read it tolerantly: a denial must not break
  // the whole project load. null → skip the heal, keep agentIds as-is.
  const agentsSnap = await getDocs(agentsCol(input.walletAddress)).catch(
    () => null
  );

  // Self-heal the denormalized task counter for projects created before
  // createProjectTasks / deleteTask started keeping it in sync. Cheap
  // because we already paid for tasksSnap above; fire-and-forget so the
  // page render isn't blocked.
  const actualTaskCount = tasksSnap.size;
  if (project.tasks !== actualTaskCount) {
    updateDoc(projectDoc(input.walletAddress, input.projectId), {
      tasks: actualTaskCount,
    }).catch(() => {
      // Healing is best-effort. A failure (e.g. rules tightening) is fine.
    });
    project.tasks = actualTaskCount;
  }

  // Self-heal the agent roster + its denormalized count. Deleting an agent
  // does not walk every project, so a project keeps a dangling name in
  // `agentIds` (and a stale `agents` count) once its agent is gone — which
  // is why a project still showed "AGENTS 2" after both agents were
  // deleted. Drop roster entries whose agent no longer exists and re-derive
  // the count. NOTE: the in-memory project is corrected even if the write
  // below never lands (e.g. a mini-app webview where writes are flaky), so
  // the stat tile / agents tab render correctly regardless. task.agent is a
  // historical attribution and is intentionally left untouched.
  if (agentsSnap) {
    const liveAgentNames = new Set(
      agentsSnap.docs
        .map((d) => d.data())
        .filter(isAllowedAgentRow)
        .map((agent) => (agent.name ?? "").trim().toLowerCase())
        .filter((n) => n.length > 0)
    );
    const roster = (project.agentIds as string[] | undefined) ?? [];
    const reconciledRoster = roster.filter((name) =>
      liveAgentNames.has(name.trim().toLowerCase())
    );
    if (
      reconciledRoster.length !== roster.length ||
      project.agents !== reconciledRoster.length
    ) {
      updateDoc(projectDoc(input.walletAddress, input.projectId), {
        agentIds: reconciledRoster,
        agents: reconciledRoster.length,
      }).catch(() => {
        // Best-effort, same rationale as the task counter above.
      });
      project.agentIds = reconciledRoster;
      project.agents = reconciledRoster.length;
    }
  }

  return {
    project,
    tasks: tasksSnap.docs.map((d) => d.data()),
    messages: messagesSnap.docs.map((d) => d.data()),
  };
}

export async function createWalletProject(input: {
  walletAddress: string;
  name: string;
  goal: string;
  budget?: string;
  agentIds?: string[];
  /** The organization this project belongs to. */
  orgId?: string;
}): Promise<{ project: Project }> {
  const ref = doc(projectsCol(input.walletAddress));
  const payload: Project = {
    name: input.name,
    goal: input.goal,
    status: "Active",
    agents: input.agentIds?.length ?? 0,
    tasks: 0,
    budget: input.budget ?? "0 USDC",
    ...(input.orgId ? { orgId: input.orgId } : {}),
    agentIds: input.agentIds ?? [],
  };
  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  logActivity(input.walletAddress, {
    actorType: "user",
    actor: "You",
    verb: "created_project",
    object: input.name,
    objectType: "project",
    projectId: ref.id,
  });
  return { project: { ...payload, id: ref.id } };
}

export async function updateProject(input: {
  walletAddress: string;
  projectId: string;
  patch: Partial<{ name: string; goal: string; status: string }>;
}): Promise<{ project: Project }> {
  const ref = projectDoc(input.walletAddress, input.projectId);
  await updateDoc(ref, {
    ...input.patch,
    updatedAt: serverTimestamp(),
  });
  const fresh = await getDoc(ref);
  if (!fresh.exists()) {
    throw new Error("Project not found after update.");
  }
  return { project: fresh.data() };
}

/**
 * Save (or clear) the swarm definition for a project.
 *
 * Validates the input first — callers can pass an unvalidated object
 * (e.g. straight from YAML parse) and we'll throw on bad shape rather
 * than persist garbage. Pass `null` to remove the swarm.
 */
export async function setProjectSwarm(input: {
  walletAddress: string;
  projectId: string;
  swarm: SwarmDefinition | null;
}): Promise<void> {
  const ref = projectDoc(input.walletAddress, input.projectId);
  if (input.swarm === null) {
    await updateDoc(ref, {
      swarm: null,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const validation = validateSwarm(input.swarm);
  if (!validation.ok) {
    const summary = validation.errors
      .map((e) => `${e.path || "(root)"}: ${e.message}`)
      .join("; ");
    throw new Error(`Invalid swarm: ${summary}`);
  }
  await updateDoc(ref, {
    swarm: validation.swarm,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Add one or more agents (by name) to a project's roster. Goes through the
 * server (`POST /projects/:pid/agents`) which writes the agentMembers edge +
 * the /agents/{name}/assignments reverse index + the denormalized agentIds
 * cache atomically (Phase A, gap #2). `walletAddress` is the project OWNER —
 * passed as `owner` so a member of a shared project can assign too (the server
 * authorizes via project membership).
 */
export async function assignAgentsToProject(input: {
  walletAddress: string;
  projectId: string;
  agentNames: string[];
}): Promise<{ added: number; total: number; skipped?: string[] }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/projects/${input.projectId}/agents`, {
    method: "POST",
    body: JSON.stringify({ agentNames: input.agentNames, owner: input.walletAddress }),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't assign agents"));
  return payload as unknown as { added: number; total: number; skipped?: string[] };
}

/**
 * Remove one agent from a project's roster — drops the edge + reverse index +
 * denormalized cache server-side (`DELETE /projects/:pid/agents/:name`).
 */
export async function unassignAgentFromProject(input: {
  walletAddress: string;
  projectId: string;
  agentName: string;
}): Promise<{ total: number }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/projects/${input.projectId}/agents/${encodeURIComponent(input.agentName)}?owner=${input.walletAddress}`,
    { method: "DELETE" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't remove agent"));
  return payload as unknown as { total: number };
}

/**
 * Designate (or clear) the project's PM/orchestrator agent by display name.
 * Pass `pmAgent: null` to remove the PM. The named agent is also ensured into
 * the roster so a PM is always a project member.
 */
export async function setProjectPm(input: {
  walletAddress: string;
  projectId: string;
  pmAgent: string | null;
}): Promise<void> {
  // A PM is always a roster member — ensure the membership edge (+ reverse
  // index + denorm) via the server route before flipping the pmAgent flag.
  if (input.pmAgent) {
    await assignAgentsToProject({
      walletAddress: input.walletAddress,
      projectId: input.projectId,
      agentNames: [input.pmAgent],
    }).catch(() => {
      /* best-effort — the pmAgent designation below is what matters */
    });
  }
  await updateDoc(projectDoc(input.walletAddress, input.projectId), {
    pmAgent: input.pmAgent,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProject(input: {
  walletAddress: string;
  projectId: string;
}): Promise<void> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/projects/${input.projectId}`, {
    method: "DELETE",
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't delete project"));
}

export async function startProject(input: {
  walletAddress: string;
  projectId: string;
}): Promise<{ tasks: Task[]; messages?: ChatMessage[] }> {
  await updateDoc(projectDoc(input.walletAddress, input.projectId), {
    status: "In progress",
    updatedAt: serverTimestamp(),
  });
  const snap = await getDocs(tasksCol(input.walletAddress, input.projectId));
  return { tasks: snap.docs.map((d) => d.data()) };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * Create tasks on a project board via the server (`POST /projects/:pid/tasks`).
 *
 * This deliberately does NOT write the task docs from the client. The
 * dispatcher only scans the `active_boards` collection, and only the API can
 * upsert that marker — there is no Firestore rule for `active_boards`, so a
 * browser write falls under the global deny. A board built client-side is a
 * dead board: its tasks stay in Backlog and no agent is ever woken for them.
 *
 * `walletAddress` is the project OWNER, passed as `owner` so a member of a
 * shared org project can create tasks too (the server authorizes by
 * membership).
 */
export async function createProjectTasks(input: {
  walletAddress: string;
  projectId: string;
  tasks: {
    name: string;
    priority?: string;
    agent?: string;
    prompt?: string;
    attachments?: TaskAttachment[];
  }[];
}): Promise<{ tasks: Task[] }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/projects/${input.projectId}/tasks?owner=${encodeURIComponent(input.walletAddress)}`,
    { method: "POST", body: JSON.stringify({ tasks: input.tasks }) },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't create tasks"));
  const created = ((payload as unknown as { tasks?: Task[] }).tasks ?? []) as Task[];

  // Graph trail (fire-and-forget). The activity feed event is written server
  // side; the assigned_to edge is still a client concern.
  for (const t of created) {
    if (t.id && t.agent && t.agent !== "App Agent") {
      writeEdge(input.walletAddress, {
        fromKey: entityKey.agent(t.agent),
        toKey: entityKey.task(input.projectId, t.id),
        rel: "assigned_to",
        projectId: input.projectId,
        sourceRef: t.id,
        sourceLabel: t.name,
      });
    }
  }
  return { tasks: created };
}

/**
 * Patch one task through the server (`PATCH /projects/:pid/tasks/:taskId`).
 *
 * Server-side because reassigning or reopening a task has to re-upsert the
 * `active_boards` marker: the dispatcher clears it once a board runs out of
 * pending work, and the client cannot write it back.
 */
export async function updateTask(input: {
  walletAddress: string;
  projectId: string;
  taskId: string;
  patch: Partial<{
    name: string;
    priority: string;
    agent: string;
    prompt: string;
    status: TaskStatus;
    attachments: TaskAttachment[];
  }>;
}): Promise<{ task: Task }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/projects/${input.projectId}/tasks/${encodeURIComponent(input.taskId)}` +
      `?owner=${encodeURIComponent(input.walletAddress)}`,
    { method: "PATCH", body: JSON.stringify(input.patch) },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't update task"));
  return { task: (payload as unknown as { task: Task }).task };
}

/**
 * Delete one task through the server (`DELETE /projects/:pid/tasks/:taskId`),
 * which also keeps the denormalized `project.tasks` counter in sync. Task
 * writes go through the API as a rule now, so the board and its dispatcher
 * marker only ever have one writer.
 */
export async function deleteTask(input: {
  walletAddress: string;
  projectId: string;
  taskId: string;
}): Promise<void> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/projects/${input.projectId}/tasks/${encodeURIComponent(input.taskId)}` +
      `?owner=${encodeURIComponent(input.walletAddress)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const payload = await parseJson(response);
    throw new Error(apiError(payload, "Couldn't delete task"));
  }
}

// ---------------------------------------------------------------------------
// Project chat
// ---------------------------------------------------------------------------

export async function addProjectMessage(input: {
  walletAddress: string;
  projectId: string;
  text: string;
  from?: "user" | "agent";
  /** Structured @-mentions: "user:0x…" / "agent:Name" identities. */
  mentions?: string[];
}): Promise<{ message: ChatMessage }> {
  const col = messagesCol(input.walletAddress, input.projectId);
  const ref = doc(col);
  const payload: ChatMessage = {
    from: input.from ?? "user",
    text: input.text,
    ...(input.mentions && input.mentions.length
      ? { mentions: input.mentions }
      : {}),
  };
  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return { message: { ...payload, id: ref.id } };
}

// ---------------------------------------------------------------------------
// Collaborative docs workspace ("Notes")
// ---------------------------------------------------------------------------

/** Read the project's active plan doc id (project.activePlanId), if any. */
export async function getActivePlanId(
  walletAddress: string,
  projectId: string
): Promise<string | null> {
  const snap = await getDoc(projectDoc(walletAddress, projectId));
  if (!snap.exists()) return null;
  const data = snap.data() as Project & { activePlanId?: string };
  return typeof data.activePlanId === "string" ? data.activePlanId : null;
}

/**
 * Ensure the project's active PLAN doc exists, creating one (and pointing
 * project.activePlanId at it) if missing. Mirrors the server-side ensureDoc
 * so humans can start the plan from the app — the PM tools target the same
 * activePlanId. Returns the doc id.
 */
export async function ensureProjectPlan(input: {
  walletAddress: string;
  projectId: string;
  createdBy?: string;
}): Promise<string> {
  const existing = await getActivePlanId(input.walletAddress, input.projectId);
  if (existing) {
    const snap = await getDoc(
      docDoc(input.walletAddress, input.projectId, existing)
    );
    if (snap.exists()) return existing;
  }
  const ref = doc(docsCol(input.walletAddress, input.projectId));
  await setDoc(ref, {
    type: "plan",
    title: "Sprint plan",
    status: "draft",
    parentId: null,
    draft: false,
    order: 0,
    createdBy: input.createdBy ?? null,
    revision: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(projectDoc(input.walletAddress, input.projectId), {
    activePlanId: ref.id,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Create a new doc in the project's docs tree. Returns the new doc id. */
export async function createDoc(input: {
  walletAddress: string;
  projectId: string;
  type: DocType;
  title: string;
  parentId?: string | null;
  createdBy?: string;
  draft?: boolean;
}): Promise<{ id: string }> {
  const ref = doc(docsCol(input.walletAddress, input.projectId));
  await setDoc(ref, {
    type: input.type,
    title: input.title,
    status: input.type === "plan" ? "draft" : null,
    parentId: input.parentId ?? null,
    draft: input.draft ?? false,
    order: Date.now(),
    createdBy: input.createdBy ?? null,
    revision: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/** Rename a doc. */
export async function renameDoc(input: {
  walletAddress: string;
  projectId: string;
  docId: string;
  title: string;
}): Promise<void> {
  await updateDoc(docDoc(input.walletAddress, input.projectId, input.docId), {
    title: input.title,
    updatedAt: serverTimestamp(),
  });
}

/** Promote a PM-drafted doc into the main tree (draft → false). */
export async function promoteDoc(input: {
  walletAddress: string;
  projectId: string;
  docId: string;
}): Promise<void> {
  await updateDoc(docDoc(input.walletAddress, input.projectId, input.docId), {
    draft: false,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a doc (its blocks/messages subcollections are orphaned in MVP). */
export async function deleteProjectDoc(input: {
  walletAddress: string;
  projectId: string;
  docId: string;
}): Promise<void> {
  await deleteDoc(docDoc(input.walletAddress, input.projectId, input.docId));
}

/** Append a human-owned `note` block to the end of a doc. */
export async function addDocNote(input: {
  walletAddress: string;
  projectId: string;
  docId: string;
  text: string;
  owner: string;
  order: number;
}): Promise<{ id: string }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/docs/${input.docId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({
        owner: input.walletAddress,
        text: input.text,
        order: input.order,
      }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't add the note"));
  const data = (payload.data ?? payload) as { blockId: string };
  return { id: data.blockId };
}

/** Edit a `note` block's text (last-writer-wins at block level). */
export async function updateDocNote(input: {
  walletAddress: string;
  projectId: string;
  docId: string;
  blockId: string;
  text: string;
}): Promise<void> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/docs/${input.docId}/blocks/${input.blockId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ owner: input.walletAddress, text: input.text }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't update the note"));
}

/** Delete a block (humans may remove their own notes). */
export async function deleteDocBlock(input: {
  walletAddress: string;
  projectId: string;
  docId: string;
  blockId: string;
}): Promise<void> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/docs/${input.docId}/blocks/${input.blockId}?owner=${encodeURIComponent(input.walletAddress)}`,
    { method: "DELETE" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't delete the note"));
}

/** Post a human message into a doc's own discussion. */
export async function addDocMessage(input: {
  walletAddress: string;
  projectId: string;
  docId: string;
  text: string;
  from?: "user" | "agent";
  /** Structured @-mentions: "user:0x…" / "agent:Name" identities. */
  mentions?: string[];
}): Promise<{ id: string }> {
  const ref = doc(
    docMessagesCol(input.walletAddress, input.projectId, input.docId)
  );
  await setDoc(ref, {
    from: input.from ?? "user",
    text: input.text,
    ...(input.mentions && input.mentions.length
      ? { mentions: input.mentions }
      : {}),
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

// ---------------------------------------------------------------------------
// User profile / username (stable, collision-free @-mention identity)
// ---------------------------------------------------------------------------
//
// @-mentions store a STRUCTURED identity that is already unique — `user:0x…`
// (the wallet) for humans, `agent:Name` for agents — so mentions never
// collide. The username here is only a human-readable LABEL for that
// identity (and what people type after `@`). Resolution priority for a
// human's label: chosen username → (ENS / Base name — future) → 0x…abcd.
//
// Storage:
//   /wallets/{w}/profile/main            { username, displayName, updatedAt }
//   /usernames/{lowercased}              { wallet }   (top-level uniqueness registry)

/** Which avatar a user shows. Auto-default priority: ens → basename → default. */
export type AvatarSource = "ens" | "basename" | "custom" | "default";

export type UserProfile = {
  username?: string | null;
  displayName?: string | null;
  updatedAt?: string;
  // Avatar system. The per-source URLs are resolved on login (ENS/basename) or
  // uploaded (custom); `avatarSource` is the user's pick (or the auto-default).
  // The effective URL for display is derived via `effectiveAvatarUrl()` — we do
  // NOT store a denormalized "current url" so a source switch is a 1-field write.
  avatarSource?: AvatarSource | null;
  ensName?: string | null;
  ensAvatarUrl?: string | null;
  basename?: string | null;
  basenameAvatarUrl?: string | null;
  avatarCustomUrl?: string | null;
  /** ISO stamp of the last ENS/basename resolution (TTL marker, login-side). */
  avatarResolvedAt?: string | null;
};

/** A username is 3–20 chars, [a-z0-9_-], compared case-insensitively. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
export function isValidUsername(raw: string): boolean {
  return /^[a-z0-9_-]{3,20}$/.test(normalizeUsername(raw));
}

function profileDoc(walletAddress: string) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "profile",
    "main"
  );
}
function usernameDoc(username: string) {
  return doc(firebaseDb(), "usernames", normalizeUsername(username));
}

/** Batch-resolve profiles for several wallets (parallel single reads). */
export async function getUserProfiles(
  wallets: string[]
): Promise<Record<string, UserProfile | null>> {
  const uniq = Array.from(new Set(wallets.map((w) => normalize(w))));
  const entries = await Promise.all(
    uniq.map(
      async (w) => [w, await getUserProfile(w).catch(() => null)] as const
    )
  );
  return Object.fromEntries(entries);
}

export async function getUserProfile(
  walletAddress: string
): Promise<UserProfile | null> {
  const snap = await getDoc(profileDoc(walletAddress));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    username: (d.username as string | null) ?? null,
    displayName: (d.displayName as string | null) ?? null,
    avatarSource: (d.avatarSource as AvatarSource | null) ?? null,
    ensName: (d.ensName as string | null) ?? null,
    ensAvatarUrl: (d.ensAvatarUrl as string | null) ?? null,
    basename: (d.basename as string | null) ?? null,
    basenameAvatarUrl: (d.basenameAvatarUrl as string | null) ?? null,
    avatarCustomUrl: (d.avatarCustomUrl as string | null) ?? null,
    avatarResolvedAt: (d.avatarResolvedAt as string | null) ?? null,
  };
}

/** Which wallet owns a username (for availability checks). null = free. */
export async function getUsernameOwner(
  username: string
): Promise<string | null> {
  if (!isValidUsername(username)) return null;
  const snap = await getDoc(usernameDoc(username));
  if (!snap.exists()) return null;
  return ((snap.data() as { wallet?: string }).wallet ?? null) as string | null;
}

/**
 * Claim (or change) the caller's username. Transactional against the
 * top-level /usernames registry so two wallets can't take the same handle.
 * Frees the previous handle on a rename. Throws "taken" if held by another.
 */
export async function setUsername(input: {
  walletAddress: string;
  username: string;
}): Promise<void> {
  const wallet = normalize(input.walletAddress);
  const uname = normalizeUsername(input.username);
  if (!isValidUsername(uname)) {
    throw new Error("Username must be 3–20 chars: letters, numbers, _ or -.");
  }
  const db = firebaseDb();
  await runTransaction(db, async (tx) => {
    const regRef = usernameDoc(uname);
    const reg = await tx.get(regRef);
    if (reg.exists()) {
      const owner = (reg.data() as { wallet?: string }).wallet;
      if (owner && owner !== wallet) throw new Error("That username is taken.");
    }
    const pRef = profileDoc(wallet);
    const prev = await tx.get(pRef);
    const prevName = prev.exists()
      ? ((prev.data() as { username?: string }).username ?? null)
      : null;
    if (prevName && normalizeUsername(prevName) !== uname) {
      tx.delete(usernameDoc(prevName)); // free the old handle
    }
    tx.set(regRef, { wallet });
    tx.set(
      pRef,
      { username: uname, updatedAt: serverTimestamp() },
      { merge: true }
    );
  });
}

/**
 * Human-readable label for a wallet, given its (optional, prefetched)
 * profile. username → 0x…abcd. (ENS/Base name resolution is a future hook.)
 */
export function resolveUserLabel(
  walletAddress: string,
  profile?: UserProfile | null
): string {
  if (profile?.username) return profile.username;
  if (profile?.displayName) return profile.displayName;
  return formatAddress(walletAddress);
}

/**
 * The effective avatar image URL for a profile, derived from the chosen
 * source. Returns null when the user is on the generated gradient fallback
 * (source "default"/unset) or the selected source has no resolved URL — the
 * caller (UserAvatar) then draws the address-hashed gradient + initials.
 */
export function effectiveAvatarUrl(profile?: UserProfile | null): string | null {
  if (!profile) return null;
  switch (profile.avatarSource) {
    case "custom":
      return profile.avatarCustomUrl ?? null;
    case "ens":
      return profile.ensAvatarUrl ?? null;
    case "basename":
      return profile.basenameAvatarUrl ?? null;
    default:
      return null;
  }
}

/** Which avatar sources the user actually has available to choose from. */
export function availableAvatarSources(
  profile?: UserProfile | null
): AvatarSource[] {
  const out: AvatarSource[] = [];
  if (profile?.ensAvatarUrl) out.push("ens");
  if (profile?.basenameAvatarUrl) out.push("basename");
  if (profile?.avatarCustomUrl) out.push("custom");
  out.push("default");
  return out;
}

/**
 * Set which avatar source the user displays (owner-only client write, mirrors
 * setUsername's merge pattern into /wallets/{w}/profile/main).
 */
export async function setAvatarSource(input: {
  walletAddress: string;
  source: AvatarSource;
}): Promise<void> {
  await setDoc(
    profileDoc(input.walletAddress),
    { avatarSource: input.source, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Persist a freshly uploaded custom avatar URL and switch the display to it.
 */
export async function setCustomAvatar(input: {
  walletAddress: string;
  url: string;
}): Promise<void> {
  await setDoc(
    profileDoc(input.walletAddress),
    {
      avatarCustomUrl: input.url,
      avatarSource: "custom",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Drop the custom avatar and fall back to the best remaining source
 * (ens → basename → default). Pass the current profile so we can pick.
 */
export async function clearCustomAvatar(input: {
  walletAddress: string;
  profile?: UserProfile | null;
}): Promise<void> {
  const fallback: AvatarSource = input.profile?.ensAvatarUrl
    ? "ens"
    : input.profile?.basenameAvatarUrl
      ? "basename"
      : "default";
  await setDoc(
    profileDoc(input.walletAddress),
    {
      avatarCustomUrl: null,
      avatarSource: fallback,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// ENS/Basename resolution lives SERVER-SIDE (app/lib/resolveAvatar.ts +
// POST /api/avatar/resolve) — NFT avatar metadata fetches are CORS-blocked in
// the browser, so the client never resolves directly; it just re-reads the
// profile after asking the server.

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function getWalletAgents(
  walletAddress: string
): Promise<AgentRow[]> {
  const snap = await getDocs(agentsCol(walletAddress));
  const own = snap.docs.map((d) => d.data()).filter(isAllowedAgentRow) as AgentRow[];

  // Agents shared in through an organization live under their OWNER's wallet,
  // which the Firestore rules keep closed to everyone else — so they can only
  // come from the API, which decides what the caller may see. Own agents keep
  // coming from Firestore so the page loses none of the fields it renders.
  // A failure here must not take the page down: the caller still has their own.
  let shared: AgentRow[] = [];
  try {
    const { authedFetch } = await import("./apiClient");
    const res = await authedFetch("/api/agents");
    if (res.ok) {
      const body = (await res.json()) as { agents?: (AgentRow & { shared?: boolean })[] };
      shared = (body.agents ?? []).filter((a) => a.shared === true);
    }
  } catch {
    shared = [];
  }
  return [...own, ...shared];
}

export async function updateAgent(input: {
  walletAddress: string;
  agentId: string;
  patch: Partial<{
    displayName: string;
    soul: string;
    plugins: string[];
    skillIds: string[];
    disabledTools: string[];
    speechVoice: SpeechVoice;
  }>;
}): Promise<{ agent: AgentRow; applied: boolean; applyError?: string }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input.patch),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't update agent."));
  }
  return payload as unknown as {
    agent: AgentRow;
    applied: boolean;
    applyError?: string;
  };
}

export type HibernationApiState = "active" | "hibernating" | "hibernated" | "waking";

export type HibernationStatus = {
  state: HibernationApiState;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  snapshot: {
    bucket: string;
    prefix: string;
    key?: string;
    sizeBytes?: number;
  };
  hibernatedAt?: string;
  wakeStartedAt?: string;
  note?: string;
};

export type HibernationActionResult = {
  ok: true;
  serviceArn: string | null;
  previousDesiredCount: number;
  newDesiredCount: number;
  state: HibernationApiState;
};

export async function hibernateAgentApi(input: {
  agentId: string;
}): Promise<HibernationActionResult> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/hibernate`,
    { method: "POST" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't hibernate agent."));
  return payload as unknown as HibernationActionResult;
}

export async function wakeAgentApi(input: {
  agentId: string;
}): Promise<HibernationActionResult> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/wake`,
    { method: "POST" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't wake agent."));
  return payload as unknown as HibernationActionResult;
}

export async function getHibernationStatusApi(input: {
  agentId: string;
}): Promise<HibernationStatus> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/hibernation`,
    { method: "GET" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't read hibernation status."));
  return payload as unknown as HibernationStatus;
}

// ---- Backups (hibernation state snapshots) --------------------------------

export type AgentBackup = {
  /** Snapshot timestamp id, e.g. "20260604T085920Z". */
  ts: string;
  /** Encrypted size in bytes. */
  bytes: number;
  /** ISO-8601 time the snapshot landed in S3, or null. */
  createdAt: string | null;
  /** Always true — only encrypted snapshots are stored. */
  encrypted: true;
};

export type AgentBackupsResult = {
  backups: AgentBackup[];
  /** Keep-last-N retention currently configured for the agent. */
  retention: number;
};

export async function getAgentBackupsApi(input: {
  agentId: string;
}): Promise<AgentBackupsResult> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/backups`,
    { method: "GET" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't list backups."));
  return payload as unknown as AgentBackupsResult;
}

export async function setBackupRetentionApi(input: {
  agentId: string;
  retention: number;
}): Promise<{ ok: true; retention: number; appliesOn: string }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/backups/retention`,
    { method: "POST", body: JSON.stringify({ retention: input.retention }) },
  );
  const payload = await parseJson(response);
  if (!response.ok)
    throw new Error(apiError(payload, "Couldn't update backup retention."));
  return payload as unknown as { ok: true; retention: number; appliesOn: string };
}

export async function restoreAgentBackupApi(input: {
  agentId: string;
  ts: string;
}): Promise<{ ok: true; ts: string; restarting: boolean }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/restore`,
    { method: "POST", body: JSON.stringify({ ts: input.ts }) },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't start restore."));
  return payload as unknown as { ok: true; ts: string; restarting: boolean };
}

export type AvailableUpgrade = {
  imageTag: string;
  publishedAt?: string;
  notes?: string;
};

export type UpgradeOptions = {
  currentImageTag: string | null;
  currentImageUri: string | null;
  available: AvailableUpgrade[];
};

export type UpgradeResult = {
  ok: true;
  from: string | null;
  to: string;
  hibernated: boolean;
  drainedAfterMs: number;
  provision: { serviceArn: string; taskDefinitionArn: string; imageUri: string };
};

export async function getUpgradeOptionsApi(input: {
  agentId: string;
}): Promise<UpgradeOptions> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/upgrade`,
    { method: "GET" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't list available upgrades."));
  return payload as unknown as UpgradeOptions;
}

export async function upgradeAgentApi(input: {
  agentId: string;
  imageTag: string;
}): Promise<UpgradeResult> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/upgrade`,
    {
      method: "POST",
      body: JSON.stringify({ imageTag: input.imageTag }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't upgrade agent."));
  return payload as unknown as UpgradeResult;
}

export type EnsureAwakeResult = {
  ok: true;
  initialState: HibernationApiState;
  finalState: HibernationApiState;
  triggeredWake: boolean;
  online: boolean;
  waitedMs: number;
  timedOut?: true;
};

export async function ensureAgentAwakeApi(input: {
  agentId: string;
  waitForRunning?: boolean;
  waitTimeoutMs?: number;
}): Promise<EnsureAwakeResult> {
  const { authedFetch } = await import("./apiClient");
  const body: Record<string, unknown> = {};
  if (typeof input.waitForRunning === "boolean") body.waitForRunning = input.waitForRunning;
  if (typeof input.waitTimeoutMs === "number") body.waitTimeoutMs = input.waitTimeoutMs;
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/ensure-awake`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't ensure agent is awake."));
  }
  return payload as unknown as EnsureAwakeResult;
}

/**
 * Record real user interaction (a chat send) so the curator can measure idle
 * time. Fire-and-forget: a missed ping only shifts the idle calc slightly and
 * must never break a chat send, so callers should `.catch(() => {})`.
 */
export async function recordAgentActivityApi(input: {
  agentId: string;
}): Promise<void> {
  const { authedFetch } = await import("./apiClient");
  await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/activity`,
    { method: "POST" },
  );
}

export async function deleteAgent(input: {
  walletAddress: string;
  agentId: string;
}): Promise<{ warnings: string[] }> {
  // Routes through the server so we can tear down the ECS service + Secrets
  // + LLM gateway key + Firestore docs atomically. A client-side Firestore
  // delete would orphan the billable AWS resources.
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}`,
    { method: "DELETE" },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't delete agent."));
  }
  return {
    warnings: Array.isArray(payload.warnings) ? (payload.warnings as string[]) : [],
  };
}

// ---------------------------------------------------------------------------
// Billing — the user's OWN usage + payments for the dashboard Billing section.
// User-safe by design: the server (/billing/me) never returns the platform's
// raw cost or profit, only this wallet's usage + what it has paid.
// ---------------------------------------------------------------------------

export type MyBilling = {
  month: string;
  usage: { agentCount: number; activeHours: number; llmTokens: number };
  creditsUsd: number;
  enrolled: boolean;
  infra?: {
    allowed: boolean;
    reason: "exempt" | "funded" | "payment-required" | "credits-exhausted";
    hoursRemaining: number | null;
    rateUsdPerTeamHour: number;
  };
  /** PerkOS internal / tester wallet — runs free, never charged or paused. */
  exempt: boolean;
  paymentsUsd: number;
  llmWindowHours: number;
  generatedAt: string;
};

/**
 * Speculative pre-warm: trigger a wake for an agent (fire-and-forget) so it's
 * ready by the time the user interacts. Used to warm a project's PM agent on
 * project-open. Best-effort — never throws to the caller (a failed warm just
 * means the first real message pays the normal cold-start). Idempotent server
 * side; safe to call repeatedly.
 */
export async function warmAgent(agentId: string): Promise<void> {
  try {
    const { authedFetch } = await import("./apiClient");
    await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/warm`, {
      method: "POST",
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}

export async function getMyBilling(): Promise<MyBilling> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch("/billing/me");
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Failed to load billing"));
  return payload as unknown as MyBilling;
}

// ---------------------------------------------------------------------------
// Backend services — served by Next.js API routes with the Admin SDK.
// The client calls our own /api/* endpoints which validate the caller's
// Firebase idToken and either provision infra (launchAgent) or call the
// configured LLM (assistantChat).
// ---------------------------------------------------------------------------

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Backend returned non-JSON response (${response.status}).`);
  }
}

function apiError(payload: Record<string, unknown>, fallback: string) {
  return typeof payload.error === "string" && payload.error
    ? payload.error
    : fallback;
}

export type AssistantConv = {
  /** Stable convId for the canonical wallet ↔ PerkOS-Assistant thread. */
  convId: string;
  /** The agent identity that owns the canonical jsonl history. Always
   *  `agent:PerkOS-Assistant` today. */
  historyHost: string;
};

/**
 * Idempotently creates (or finds) the canonical PerkOS Assistant
 * conversation for the current wallet. Safe to call on every chat-panel
 * mount — the server-side route uses a Firestore transaction so two
 * concurrent calls land on the same conv doc.
 *
 * Returns `{ convId, historyHost }`. Caller stashes the convId and uses
 * it for subsequent WS frames against chat.perkos.xyz.
 */
export async function ensureAssistantConv(): Promise<AssistantConv> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch("/api/concierge/ensure-conv", {
    method: "POST",
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't open Assistant chat."));
  }
  return payload as unknown as AssistantConv;
}

export type AgentConv = {
  convId: string;
  historyHost: string;
  agentName: string;
};

/**
 * Per-agent equivalent of `ensureAssistantConv`. Resolves the
 * canonical conversation between the caller wallet and one of its
 * own agents. Convention: `agent-${wallet}-${agentName}` server-side.
 */
export async function ensureAgentConv(input: {
  agentId: string;
}): Promise<AgentConv> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(input.agentId)}/ensure-conv`,
    { method: "POST" },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't open agent chat."));
  }
  return payload as unknown as AgentConv;
}

export type AssistantChatHistory = {
  role: "user" | "assistant";
  content: string;
}[];

export type AssistantChatResponse = {
  reply: string;
  agent?: { id?: string; name?: string; runtime?: string };
};

export async function assistantChat(input: {
  walletAddress: string;
  message: string;
  history?: AssistantChatHistory;
  agentId?: string;
}): Promise<AssistantChatResponse> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      message: input.message,
      history: input.history ?? [],
      agentId: input.agentId,
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Assistant unavailable"));
  }
  return (payload.data ?? payload) as AssistantChatResponse;
}

export type PmTurnTrigger = "run-button" | "chat";

export type PmTurnResult = {
  ok: boolean;
  status?: PmSessionStatus;
  reason?: string;
  created?: number;
  message?: string;
};

/**
 * Trigger a PM/orchestrator turn for a project: start (or advance) the
 * autonomous session and let the PM plan + assign work. `trigger:"run-button"`
 * kicks off from the project goal; `trigger:"chat"` wakes the PM to react to a
 * just-posted chat message.
 */
export async function pmTurn(input: {
  projectId: string;
  trigger: PmTurnTrigger;
  userMessageId?: string;
  /** For a SHARED project, the owner wallet (the project lives under it). */
  owner?: string;
}): Promise<PmTurnResult> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/pm-turn`,
    {
      method: "POST",
      body: JSON.stringify({
        trigger: input.trigger,
        userMessageId: input.userMessageId,
        owner: input.owner,
      }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "PM unavailable"));
  }
  return (payload.data ?? payload) as PmTurnResult;
}

export async function cancelProjectPlanning(input: {
  projectId: string;
  owner?: string;
}): Promise<{ ok: boolean; status?: string }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/planning/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ owner: input.owner }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Planning could not be cancelled"));
  }
  return (payload.data ?? payload) as { ok: boolean; status?: string };
}

export async function ensureProjectChat(input: {
  projectId: string;
  owner?: string;
}): Promise<{ convId: string; participants: string[] }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/projects/${input.projectId}/chat`, {
    method: "POST",
    body: JSON.stringify({ owner: input.owner }),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't open project chat"));
  return payload as unknown as { convId: string; participants: string[] };
}

export async function createProjectChatThread(input: {
  projectId: string;
  owner?: string;
}): Promise<{ convId: string; participants: string[] }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/projects/${input.projectId}/chat/new`, {
    method: "POST",
    body: JSON.stringify({ owner: input.owner }),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't start a new project chat"));
  return payload as unknown as { convId: string; participants: string[] };
}

export type ProjectChatThread = {
  convId: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export async function listProjectChatThreads(input: {
  projectId: string;
  owner?: string;
}): Promise<ProjectChatThread[]> {
  const { authedFetch } = await import("./apiClient");
  const query = input.owner ? `?owner=${encodeURIComponent(input.owner)}` : "";
  const response = await authedFetch(`/api/projects/${input.projectId}/chats${query}`);
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't load project chats"));
  return ((payload as { threads?: ProjectChatThread[] }).threads ?? []);
}

/**
 * Notify a human participant they were @-mentioned in a project chat/doc.
 * Server (PerkOS-API) writes a Firestore notification to the target's
 * subtree (Admin SDK) after authorizing the shared-project relationship.
 * Best-effort — callers fire-and-forget.
 */
export async function notifyProjectMention(input: {
  projectId: string;
  target: string;
  title: string;
  body?: string;
  href?: string;
  /** For a SHARED project, the owner wallet (project lives under it). */
  owner?: string;
}): Promise<void> {
  const { authedFetch } = await import("./apiClient");
  await authedFetch(`/api/projects/${input.projectId}/notify`, {
    method: "POST",
    body: JSON.stringify({
      target: input.target,
      title: input.title,
      body: input.body,
      href: input.href,
      owner: input.owner,
    }),
  });
}

/**
 * Direct an @-mentioned WORKER agent: the server wakes it + delivers the chat
 * message so it replies in the project chat (postProjectMessage). Used to
 * route "@AgentName" to that agent instead of the PM. Fire-and-forget.
 */
export async function mentionAgent(input: {
  projectId: string;
  agentName: string;
  text: string;
  owner?: string;
}): Promise<void> {
  const { authedFetch } = await import("./apiClient");
  await authedFetch(`/api/projects/${input.projectId}/mention-agent`, {
    method: "POST",
    body: JSON.stringify({
      agentName: input.agentName,
      text: input.text,
      owner: input.owner,
    }),
  });
}

export type ApprovePlanResult = {
  /** New status after approval (materialized when tasks were created). */
  status: PlanStatus | string;
  /** Number of planTask blocks turned into board tasks. */
  created: number;
  /** Ids of the tasks created on the board. */
  taskIds: string[];
};

/**
 * Approve a proposed plan and materialize its planTask blocks into real
 * board tasks. Server-side (PerkOS-API, Admin SDK): it reads the plan's
 * planTask blocks, creates one task per block (skipping any already
 * materialized), stamps each block with its `materializedTaskId`, and
 * flips the plan status to "materialized". Idempotent — re-approving only
 * creates tasks for blocks not yet materialized.
 *
 * `owner` is the project owner wallet for a SHARED project.
 */
export async function approvePlan(input: {
  projectId: string;
  docId: string;
  owner?: string;
}): Promise<ApprovePlanResult> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/plans/${input.docId}/approve`,
    {
      method: "POST",
      body: JSON.stringify({ owner: input.owner }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't approve the plan"));
  }
  const data = (payload.data ?? payload) as Partial<ApprovePlanResult>;
  return {
    status: data.status ?? "materialized",
    created: data.created ?? 0,
    taskIds: data.taskIds ?? [],
  };
}

export async function requestPlanChanges(input: {
  projectId: string;
  docId: string;
  text: string;
  owner?: string;
}): Promise<{ chatId: string | null }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/plans/${input.docId}/request-changes`,
    {
      method: "POST",
      body: JSON.stringify({ owner: input.owner, text: input.text }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't request plan changes"));
  const result = (payload.data ?? payload) as { workflow?: { chatId?: string | null } };
  return { chatId: result.workflow?.chatId ?? null };
}

/** Wake every agent on a project (ECS scale-up). `owner` is the project owner
 *  wallet for a SHARED project. Returns how many were woken. */
export async function wakeProjectTeam(input: {
  projectId: string;
  owner?: string;
}): Promise<{ woke: number; total: number }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/projects/${input.projectId}/wake`,
    {
      method: "POST",
      body: JSON.stringify({ owner: input.owner }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't wake the team"));
  }
  return {
    woke: (payload.woke as number) ?? 0,
    total: (payload.total as number) ?? 0,
  };
}

// ---- Project meetings ----------------------------------------------------

async function meetingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(path, init);
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't complete the meeting request."));
  return payload as T;
}

export async function listProjectMeetingsApi(input: { projectId: string; owner?: string }): Promise<ProjectMeeting[]> {
  const query = input.owner ? `?owner=${encodeURIComponent(input.owner)}` : "";
  const payload = await meetingRequest<{ meetings?: ProjectMeeting[] }>(`/api/projects/${encodeURIComponent(input.projectId)}/meetings${query}`);
  return payload.meetings ?? [];
}

export async function createProjectMeetingApi(input: {
  projectId: string;
  owner?: string;
  title: string;
  pmAgent: string;
  saveTranscript: boolean;
}): Promise<ProjectMeeting> {
  const payload = await meetingRequest<{ meeting: ProjectMeeting }>(`/api/projects/${encodeURIComponent(input.projectId)}/meetings`, {
    method: "POST",
    body: JSON.stringify({
      owner: input.owner,
      title: input.title,
      pmAgent: input.pmAgent,
      transcriptPolicy: input.saveTranscript ? "saved" : "ephemeral",
      recordingPolicy: "off",
      durationMinutes: 15,
    }),
  });
  return payload.meeting;
}

export async function startProjectMeetingApi(input: { projectId: string; meetingId: string; owner?: string }): Promise<ProjectMeeting> {
  const payload = await meetingRequest<{ meeting: ProjectMeeting }>(`/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/start`, {
    method: "POST",
    body: JSON.stringify({ owner: input.owner }),
  });
  return payload.meeting;
}

export async function createMeetingJoinSessionApi(input: {
  projectId: string;
  meetingId: string;
  owner?: string;
  displayName?: string;
  voiceProcessingConsent: boolean;
}): Promise<{ url: string; roomName: string; token: string }> {
  return meetingRequest(`/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/token`, {
    method: "POST",
    body: JSON.stringify({ owner: input.owner, displayName: input.displayName, voiceProcessingConsent: input.voiceProcessingConsent }),
  });
}

export type VoiceGatewayGrant = {
  url: string;
  roomName: string;
  token: string;
  expiresAt: string;
};

export type VoiceChatCommit =
  | { policy: "none" }
  | {
      policy: "final_pair";
      consent: true;
      scope: { kind: "direct" | "project"; conversationId: string };
    };

export type AgentVoiceCapabilityApi = { available: boolean; status: "ready" | "unavailable"; reason?: "gateway_pending" | "provider_pending" | "not_supported"; expiresAt?: string; supportsFinalChatMirror?: boolean };
export type VoiceSessionApi = { id: string; status: "pending" | "claimed" | "joined" | "completed" | "failed" | "cancelled" | "expired"; expiresAt: string; reason?: string };

export async function getAgentVoiceCapabilityApi(input: { projectId: string; agentId: string; owner?: string }): Promise<AgentVoiceCapabilityApi> {
  const query = input.owner ? `?owner=${encodeURIComponent(input.owner)}` : "";
  const payload = await meetingRequest<{ capability: AgentVoiceCapabilityApi }>(`/api/projects/${encodeURIComponent(input.projectId)}/agents/${encodeURIComponent(input.agentId)}/voice-capability${query}`);
  return payload.capability;
}

export type AgentVoiceHealthPlaybookApi = {
  code: string;
  title: string;
  ownerActions: string[];
  platformNotes: string[];
};

export type AgentVoiceHealthApi = {
  available: boolean;
  status: "ready" | "unavailable" | "stale" | "unknown";
  ready: boolean;
  codes: string[];
  checkedAt?: string;
  source?: string;
  stage?: string;
  playbooks: AgentVoiceHealthPlaybookApi[];
  capabilityAvailable?: boolean;
  capabilityStatus?: string;
  capabilityReason?: string;
  capabilityExpiresAt?: string;
};

export type AgentVoiceHealthEventApi = {
  ready: boolean;
  codes: string[];
  checkedAt?: string;
  source?: string;
  stage?: string;
  recordedAt?: string;
  playbooks: AgentVoiceHealthPlaybookApi[];
};

/** Owner-only Voice Health (codes + playbooks; no chat/audio/secrets). */
export async function getAgentVoiceHealthApi(agentId: string): Promise<{
  health: AgentVoiceHealthApi;
  recent: AgentVoiceHealthEventApi[];
}> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/voice-health`);
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't load voice health"));
  const health = payload.health as AgentVoiceHealthApi | undefined;
  const recent = payload.recent as AgentVoiceHealthEventApi[] | undefined;
  if (!health || typeof health !== "object") throw new Error("Couldn't load voice health");
  return { health, recent: Array.isArray(recent) ? recent : [] };
}

export async function createVoiceSessionApi(input: { projectId: string; meetingId: string; agentId: string; owner?: string; chatCommit: VoiceChatCommit }): Promise<VoiceSessionApi> {
  const payload = await meetingRequest<{ session: VoiceSessionApi }>(`/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/voice-sessions`, {
    method: "POST",
    body: JSON.stringify({
      owner: input.owner,
      agentId: input.agentId,
      voiceProcessingConsent: true,
      chatCommit: input.chatCommit,
    }),
  });
  return payload.session;
}

export async function getVoiceSessionApi(input: { projectId: string; meetingId: string; sessionId: string; agentId: string; owner?: string }): Promise<VoiceSessionApi> {
  const params = new URLSearchParams({ agentId: input.agentId }); if (input.owner) params.set("owner", input.owner);
  const payload = await meetingRequest<{ session: VoiceSessionApi }>(`/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/voice-sessions/${encodeURIComponent(input.sessionId)}?${params}`);
  return payload.session;
}

export async function cancelVoiceSessionApi(input: { projectId: string; meetingId: string; sessionId: string; agentId: string; owner?: string }): Promise<void> {
  await meetingRequest(`/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/voice-sessions/${encodeURIComponent(input.sessionId)}/cancel`, { method: "POST", body: JSON.stringify({ owner: input.owner, agentId: input.agentId }) });
}

/** Request the documented agent grant without logging or rendering it. */
export async function createVoiceGatewayGrantApi(input: {
  projectId: string;
  meetingId: string;
  agentId: string;
  owner?: string;
  voiceProcessingConsent: true;
}): Promise<VoiceGatewayGrant> {
  const path = `/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/voice-gateway-grant`;
  const payload = await meetingRequest<{ grant?: VoiceGatewayGrant }>(path, {
    method: "POST",
    body: JSON.stringify({
      ...(input.owner ? { owner: input.owner } : {}),
      projectId: input.projectId,
      meetingId: input.meetingId,
      agentId: input.agentId,
      voiceProcessingConsent: input.voiceProcessingConsent,
    }),
  });
  const grant = payload.grant;
  if (!grant || typeof grant.url !== "string" || typeof grant.roomName !== "string"
    || typeof grant.token !== "string" || typeof grant.expiresAt !== "string"
    || !Number.isFinite(Date.parse(grant.expiresAt))) {
    throw new Error("Voice gateway returned an invalid session grant.");
  }
  return grant;
}

export async function endProjectMeetingApi(input: {
  projectId: string;
  meetingId: string;
  owner?: string;
  notes: string;
  proposals: Array<{ title: string; description?: string }>;
}): Promise<ProjectMeeting> {
  const payload = await meetingRequest<{ meeting: ProjectMeeting }>(`/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/end`, {
    method: "POST",
    body: JSON.stringify({ owner: input.owner, notes: input.notes, proposals: input.proposals }),
  });
  return payload.meeting;
}

export async function approveMeetingProposalsApi(input: {
  projectId: string;
  meetingId: string;
  owner?: string;
  proposalIds: string[];
}): Promise<{ created: number; taskIds: string[] }> {
  return meetingRequest(`/api/projects/${encodeURIComponent(input.projectId)}/meetings/${encodeURIComponent(input.meetingId)}/proposals/approve`, {
    method: "POST",
    body: JSON.stringify({ owner: input.owner, proposalIds: input.proposalIds }),
  });
}

export async function assistantChatStream(input: {
  walletAddress: string;
  message: string;
  history?: AssistantChatHistory;
  agentId?: string;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<AssistantChatResponse> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch("/api/assistant/chat", {
    method: "POST",
    headers: {
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      message: input.message,
      history: input.history ?? [],
      agentId: input.agentId,
      stream: true,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const payload = await parseJson(response);
    throw new Error(apiError(payload, "Assistant unavailable"));
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const payload = await parseJson(response);
    const final = (payload.data ?? payload) as AssistantChatResponse;
    if (final.reply) input.onChunk(final.reply);
    return final;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";
  let agent: AssistantChatResponse["agent"];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex = buffer.indexOf("\n\n");
    while (sepIndex !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      sepIndex = buffer.indexOf("\n\n");

      const dataLine = rawEvent
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json || json === "[DONE]") continue;

      try {
        const parsed = JSON.parse(json) as {
          chunk?: string;
          reply?: string;
          agent?: AssistantChatResponse["agent"];
          done?: boolean;
        };
        if (parsed.agent) agent = parsed.agent;
        if (typeof parsed.chunk === "string") {
          assembled += parsed.chunk;
          input.onChunk(parsed.chunk);
        }
        if (typeof parsed.reply === "string") {
          assembled = parsed.reply;
        }
      } catch {
        // Ignore malformed events.
      }
    }
  }

  return { reply: assembled, agent };
}

/**
 * Save (enable / update / disable) a single messaging gateway for an
 * existing agent. Called by the /agents/new wizard right after
 * `launchAgent` returns successfully — the agentId is needed because
 * gateway secrets are stashed under the agent's Secrets Manager
 * prefix.
 *
 * Body shape matches `GatewayUpsertInput` from app/lib/agentGateways.ts;
 * we keep the type lightweight here (Record<string, string>) so this
 * client helper doesn't need to import the server-side module.
 *
 * Returns the sanitized record the server persisted, or throws on
 * validation errors (caller surfaces as a toast).
 */
export async function saveAgentGateway(
  agentId: string,
  input: {
    type: "telegram" | "farcaster" | "slack";
    adapterId?: string;
    transportMode?: "polling" | "webhook" | "socket" | "http" | "relay";
    managementMode?:
      | "runtime-native"
      | "perkos-managed-relay"
      | "user-managed-native";
    enabled: boolean;
    nonSecretConfig?: Record<string, string>;
    secrets?: Record<string, string>;
  },
): Promise<unknown> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/gateways`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Saving gateway failed"));
  return payload;
}

export type AgentGatewayView = {
  type: "telegram" | "farcaster" | "slack";
  adapterId?: string;
  framework?: "Hermes" | "OpenClaw";
  transportMode?: "polling" | "webhook" | "socket" | "http" | "relay";
  managementMode?:
    | "runtime-native"
    | "perkos-managed-relay"
    | "user-managed-native";
  requiresAlwaysOn?: boolean;
  enabled: boolean;
  status: "pending" | "active" | "error";
  statusMessage?: string;
  lastProbeAt?: string;
};

export type RuntimeChannelCapability = {
  adapterId: string;
  framework: "Hermes" | "OpenClaw";
  provider: string;
  label: string;
  transportMode: string;
  managementMode: string;
  requiresAlwaysOn: boolean;
};

export async function getAgentGateways(agentId: string): Promise<{
  gateways: AgentGatewayView[];
  capabilities: RuntimeChannelCapability[];
}> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(agentId)}/gateways`,
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Loading gateways failed"));
  const data = payload as {
    gateways?: AgentGatewayView[];
    capabilities?: RuntimeChannelCapability[];
  };
  return {
    gateways: Array.isArray(data.gateways) ? data.gateways : [],
    capabilities: Array.isArray(data.capabilities) ? data.capabilities : [],
  };
}

export async function launchAgent(input: {
  walletAddress: string;
  runtime: AgentRuntime;
  name: string;
  plugins?: string[];
  /** BYOK: the user's own model API key. The launch route writes it
   *  server-side to /agent_secrets (never in the provision-job doc) and
   *  provisions with llmSource: "byok". */
  modelKey?: string;
  /** BYOK: OpenAI-compatible endpoint base URL incl. version path
   *  (e.g. "https://api.openai.com/v1"). Only meaningful with modelKey. */
  llmBaseUrl?: string;
  /** BYOK: wire model id (e.g. "gpt-4o-mini"). Only meaningful with modelKey. */
  llmModel?: string;
  /** When provisioning on PerkOS infra (ECS), the specific image tag the
   *  admin has approved. Ignored for self-hosted / imported deploys. */
  imageTag?: string | null;
  /**
   * New in 0.2.0. Defaults to "perkos-managed" server-side when omitted
   * so older builds keep working without code changes.
   */
  deployMode?: "perkos-managed" | "self-hosted" | "imported";
  /** Only meaningful when deployMode === "imported". */
  runtimeKind?: RuntimeKind;
  /** Override HERMES_API_URL on imported flows (non-default port). */
  hermesApiUrl?: string;
  /** Rendered persona markdown (SOUL.md / AGENTS.md). Server caps at 12 KB. */
  soul?: string;
  /** Selected skill pack ids; server resolves to raw SKILL.md URLs. */
  skills?: string[];
  /** Built-in capabilities the wallet turned OFF in the wizard's Capabilities
   *  step (e.g. "code-execution", "browser"). Server validates against the
   *  known set + threads it to provisioning as PERKOS_DISABLED_TOOLS. */
  disabledTools?: string[];
}): Promise<LaunchAgentResponse> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch("/api/agents/launch", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      runtime: input.runtime,
      name: input.name,
      plugins: input.plugins ?? [],
      modelKey: input.modelKey,
      llmBaseUrl: input.llmBaseUrl,
      llmModel: input.llmModel,
      imageTag: input.imageTag ?? undefined,
      deployMode: input.deployMode,
      runtimeKind: input.runtimeKind,
      hermesApiUrl: input.hermesApiUrl,
      soul: input.soul,
      skills: input.skills,
      disabledTools: input.disabledTools,
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Agent registration failed"));
  return payload as unknown as LaunchAgentResponse;
}

export type InviteAgentResult = {
  ok: boolean;
  agentId: string;
  agentName: string;
  relayApiKey: string;
  invitePrompt: string;
  /** Plain shell command for machine-to-machine delivery; no Markdown fences. */
  inviteCommand: string;
};

/**
 * POST /api/agents/invite — register an EXTERNAL agent the user already runs
 * into the caller's org. Provisions no infra; returns an onboarding prompt the
 * user hands to their agent so it connects via perkos-a2a + perkos-chat and can
 * work the job board with parity to native agents.
 */
export async function inviteAgent(input: {
  name: string;
  runtimeKind?: RuntimeKind;
  note?: string;
}): Promise<InviteAgentResult> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch("/api/agents/invite", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      runtimeKind: input.runtimeKind,
      note: input.note,
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Invite failed"));
  return payload as unknown as InviteAgentResult;
}

export type RelayKeyInfo = {
  /** Global registry status: "active" | "revoked" | "unknown". */
  status: string;
  /** Whether a usable relayApiKey currently exists (false once revoked). */
  hasKey: boolean;
  /** Re-rendered onboarding prompt, or null when the key is revoked. */
  invitePrompt: string | null;
  /** Plain shell command, or null when the key is revoked. */
  inviteCommand: string | null;
};

/**
 * GET /api/agents/<id>/relay-key — re-show an invited agent's credential +
 * onboarding prompt. Owner-only; the prompt is no longer one-shot.
 */
export async function getRelayKeyInfo(agentId: string): Promise<RelayKeyInfo> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${agentId}/relay-key`, { method: "GET" });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't load credential"));
  return payload as unknown as RelayKeyInfo;
}

/**
 * POST /api/agents/<id>/relay-key/rotate — issue a fresh relayApiKey (the old
 * one stops authenticating immediately) and return a new onboarding prompt.
 */
export async function rotateRelayKey(
  agentId: string,
): Promise<{ ok: boolean; relayApiKey: string; invitePrompt: string; inviteCommand: string }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${agentId}/relay-key/rotate`, { method: "POST" });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't rotate credential"));
  return payload as unknown as { ok: boolean; relayApiKey: string; invitePrompt: string; inviteCommand: string };
}

/**
 * POST /api/agents/<id>/relay-key/revoke — kill the credential (bridge auth +
 * tools-token stop accepting it). Reversible via rotate.
 */
export async function revokeRelayKey(
  agentId: string,
): Promise<{ ok: boolean; status: string }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${agentId}/relay-key/revoke`, { method: "POST" });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't revoke credential"));
  return payload as unknown as { ok: boolean; status: string };
}

export type WebhookInfo = { hasToken: boolean; url: string | null };

/**
 * GET /api/agents/<id>/webhook — the agent's inbound webhook URL (an external
 * event POSTed here wakes the agent + hands it the payload). Owner-only.
 */
export async function getWebhookInfo(agentId: string): Promise<WebhookInfo> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${agentId}/webhook`, { method: "GET" });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't load webhook URL"));
  return payload as unknown as WebhookInfo;
}

/**
 * POST /api/agents/<id>/webhook/rotate — mint a fresh webhook URL. Any previous
 * URL stops working immediately.
 */
export async function rotateWebhook(
  agentId: string,
): Promise<{ ok: boolean; webhookToken: string; url: string }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${agentId}/webhook/rotate`, { method: "POST" });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't generate webhook URL"));
  return payload as unknown as { ok: boolean; webhookToken: string; url: string };
}

/**
 * POST /api/agents/<id>/webhook/disable — delete the token so the URL 404s.
 */
export async function disableWebhook(agentId: string): Promise<{ ok: boolean }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${agentId}/webhook/disable`, { method: "POST" });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't disable webhook"));
  return payload as unknown as { ok: boolean };
}

/**
 * POST /api/agents/<id>/team — add this agent to a host's team as a co-resident
 * (hostAgentId), or leave it (null → back to a standalone runtime). Phase 1
 * multi-agent. Reprovisions the host so one runtime serves the whole team.
 */
export async function setAgentHost(
  agentId: string,
  hostAgentId: string | null,
): Promise<{ ok: boolean; hostAgent: string | null }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${agentId}/team`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostAgentId }),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't update the agent's team"));
  return payload as unknown as { ok: boolean; hostAgent: string | null };
}

/**
 * GET /api/agents/<id> — returns the per-wallet agent projection
 * including the 0.2.0 BYO fields (`bridgeConnected`, `deployMode`,
 * `lastBridgeSeenAt`, `runtimeKind`). Used by the wizard's
 * post-launch polling card.
 */
export async function fetchAgent(agentId: string): Promise<{
  id: string;
  name: string;
  runtime: AgentRuntime;
  status: string;
  walletAddress: string;
  plugins: string[];
  modelKeyProvided: boolean;
  deployMode?: string | null;
  runtimeKind?: string | null;
  bridgeConnected?: boolean;
  lastBridgeSeenAt?: string | null;
  runtimeVersion?: string | null;
  maintenanceCapability?: A2AMaintenanceCapability | null;
  runtimeStatus?: "healthy" | "unreachable" | "unknown" | null;
  runtimeHealthy?: boolean;
  runtimeHealthCheckedAt?: string | null;
  lastRuntimeSeenAt?: string | null;
}> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(agentId)}`,
    { method: "GET" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Failed to load agent"));
  return payload as never;
}

export type EncryptedVoiceCredentialDelivery = {
  id: string;
  claimId: string;
  algorithm: "RSA-OAEP-256";
  audience: "perkos-voice-gateway-grant:v1";
  publicKeyFingerprint: string;
  expiresAt: string;
};

export type VoiceGatewayCredential = {
  credential: string;
  audience: "perkos-voice-gateway-grant:v1";
  expiresAt: string;
};

export type VoiceEnrollmentCapabilityState = "unknown" | "available" | "unsupported" | "enrolling" | "ready" | "degraded";

export type VoiceEnrollmentCapability = {
  state: VoiceEnrollmentCapabilityState;
  runtime?: string;
  reasonCode?: string;
  probeRequestedAt?: string;
  reportedAt?: string;
  enrollmentRequestedAt?: string;
  claimedAt?: string;
  updatedAt: string;
};

async function voiceEnrollmentAction(agentId: string, path: "capability" | "probe" | "prepare-a2a", method: "GET" | "POST") {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(agentId)}/voice-credential/${path}`,
    { method },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't update Voice enrollment"));
  const source = payload as { capability?: unknown; prompt?: unknown } | null;
  const capability = source?.capability as VoiceEnrollmentCapability | undefined;
  if (!capability || !["unknown", "available", "unsupported", "enrolling", "ready", "degraded"].includes(capability.state)) {
    throw new Error("Voice capability API returned invalid data.");
  }
  return { capability, ...(typeof source?.prompt === "string" ? { prompt: source.prompt } : {}) };
}

export async function getVoiceEnrollmentCapability(agentId: string) {
  return voiceEnrollmentAction(agentId, "capability", "GET");
}

export async function requestVoiceSupportProbe(agentId: string) {
  return voiceEnrollmentAction(agentId, "probe", "POST");
}

export async function prepareA2AVoiceEnrollment(agentId: string) {
  return voiceEnrollmentAction(agentId, "prepare-a2a", "POST");
}

export type A2AMaintenanceState = "pending" | "claimed" | "running" | "completed" | "failed" | "expired";

export type A2AMaintenanceRequest = {
  requestId: string;
  state: A2AMaintenanceState;
  targetVersion: string;
  createdAt: string;
  expiresAt: string;
  claimedAt?: string;
  startedAt?: string;
  completedAt?: string;
  installedVersion?: string;
  errorCode?: string;
};

function parseA2AMaintenanceRequest(payload: unknown): A2AMaintenanceRequest {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const request = source.request && typeof source.request === "object" ? source.request as Record<string, unknown> : {};
  const states: A2AMaintenanceState[] = ["pending", "claimed", "running", "completed", "failed", "expired"];
  if (
    typeof request.requestId !== "string" ||
    typeof request.targetVersion !== "string" ||
    typeof request.createdAt !== "string" ||
    typeof request.expiresAt !== "string" ||
    !states.includes(request.state as A2AMaintenanceState)
  ) throw new Error("A2A maintenance API returned invalid data.");
  return request as A2AMaintenanceRequest;
}

export async function createA2AMaintenanceUpdate(agentId: string): Promise<{ marker: string; request: A2AMaintenanceRequest }> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(`/api/agents/${encodeURIComponent(agentId)}/maintenance/a2a-update`, { method: "POST" });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't create the A2A maintenance request"));
  const marker = payload && typeof payload === "object" ? (payload as Record<string, unknown>).marker : undefined;
  if (typeof marker !== "string" || !/^PERKOS_A2A_UPDATE:[0-9a-f-]{36}$/i.test(marker)) {
    throw new Error("A2A maintenance API returned an invalid marker.");
  }
  return { marker, request: parseA2AMaintenanceRequest(payload) };
}

export async function getA2AMaintenanceUpdate(agentId: string, requestId: string): Promise<A2AMaintenanceRequest> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(agentId)}/maintenance/a2a-update/${encodeURIComponent(requestId)}`,
    { method: "GET" },
  );
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Couldn't load the A2A maintenance request"));
  return parseA2AMaintenanceRequest(payload);
}

/**
 * Rotate the agent-scoped Voice gateway credential.
 *
 * This is intentionally an explicit owner action: the plaintext secret is
 * returned once so it can be handed directly to the external agent's native
 * plugin. Callers must not persist it in browser storage or query caches.
 */
export async function rotateVoiceGatewayCredential(
  agentId: string,
): Promise<VoiceGatewayCredential> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(agentId)}/voice-credential/rotate`,
    { method: "POST" },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't create the Voice enrollment credential"));
  }
  const candidate = payload as Record<string, unknown> | null;
  if (
    !candidate ||
    typeof candidate.credential !== "string" ||
    candidate.credential.length < 20 ||
    candidate.audience !== "perkos-voice-gateway-grant:v1" ||
    typeof candidate.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.expiresAt))
  ) {
    throw new Error("Voice credential API returned invalid enrollment data.");
  }
  return {
    credential: candidate.credential,
    audience: "perkos-voice-gateway-grant:v1",
    expiresAt: candidate.expiresAt,
  };
}

/** Create the Bragi-only encrypted pull delivery without returning ciphertext to Web. */
export async function rotateEncryptedVoiceCredentialDelivery(
  agentId: string,
  publicKeyPem: string,
): Promise<EncryptedVoiceCredentialDelivery> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch(
    `/api/agents/${encodeURIComponent(agentId)}/voice-credential/rotate-encrypted-delivery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicKeyPem }),
    },
  );
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(apiError(payload, "Couldn't create the encrypted Bragi delivery"));
  }
  const candidate = (payload as { delivery?: unknown } | null)?.delivery;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof (candidate as { id?: unknown }).id !== "string" ||
    typeof (candidate as { claimId?: unknown }).claimId !== "string" ||
    (candidate as { algorithm?: unknown }).algorithm !== "RSA-OAEP-256" ||
    (candidate as { audience?: unknown }).audience !== "perkos-voice-gateway-grant:v1" ||
    typeof (candidate as { publicKeyFingerprint?: unknown }).publicKeyFingerprint !== "string" ||
    typeof (candidate as { expiresAt?: unknown }).expiresAt !== "string" ||
    !Number.isFinite(Date.parse((candidate as { expiresAt: string }).expiresAt))
  ) {
    throw new Error("Voice credential API returned invalid delivery metadata.");
  }
  return {
    id: (candidate as { id: string }).id,
    claimId: (candidate as { claimId: string }).claimId,
    algorithm: "RSA-OAEP-256",
    audience: "perkos-voice-gateway-grant:v1",
    publicKeyFingerprint: (candidate as { publicKeyFingerprint: string }).publicKeyFingerprint,
    expiresAt: (candidate as { expiresAt: string }).expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Personal team templates ("My templates")
// ---------------------------------------------------------------------------

/** A user-saved team composition, reusable from the New Project wizard.
 *  Roles serialize the same shape the wizard launches (`CompanyRole`):
 *  preset-backed roles carry `presetId`; authored roles carry `soul` fields. */
export type TeamTemplate = {
  id: string;
  name: string;
  /** The PerkOS business template this started from, if any. */
  baseTemplateId: string | null;
  roles: unknown[];
  createdAt?: string;
};

function teamTemplatesCol(walletAddress: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "team_templates"
  );
}

export async function listTeamTemplates(
  walletAddress: string
): Promise<TeamTemplate[]> {
  const snap = await getDocs(
    query(teamTemplatesCol(walletAddress), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: (data.name as string) ?? "Untitled team",
      baseTemplateId: (data.baseTemplateId as string | null) ?? null,
      roles: Array.isArray(data.roles) ? data.roles : [],
      createdAt:
        typeof data.createdAt === "string" ? data.createdAt : undefined,
    };
  });
}

export async function saveTeamTemplate(input: {
  walletAddress: string;
  name: string;
  baseTemplateId?: string | null;
  roles: unknown[];
}): Promise<{ id: string }> {
  const ref = doc(teamTemplatesCol(input.walletAddress));
  await setDoc(ref, {
    name: input.name,
    baseTemplateId: input.baseTemplateId ?? null,
    roles: input.roles,
    createdAt: new Date().toISOString(),
  });
  return { id: ref.id };
}

export async function deleteTeamTemplate(input: {
  walletAddress: string;
  templateId: string;
}): Promise<void> {
  await deleteDoc(
    doc(teamTemplatesCol(input.walletAddress), input.templateId)
  );
}
