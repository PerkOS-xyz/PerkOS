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
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FirestoreDataConverter,
  type Timestamp,
} from "firebase/firestore";

import { firebaseDb } from "./firebase";
import { validateSwarm, type SwarmDefinition } from "./swarm";

export type Project = {
  id?: string;
  name: string;
  goal?: string;
  status: string;
  agents: number;
  tasks: number;
  budget: string;
  agentIds?: string[];
  /**
   * Optional swarm definition: declarative roster of agents + roles for
   * this project's chat room. Set/exported via the swarm.yaml flow.
   */
  swarm?: SwarmDefinition;
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
  createdAt?: string;
  updatedAt?: string;
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
  result: {
    mode?: string;
    status?: string;
    taskArn?: string;
    agent?: Agent;
  };
};

const defaultApiUrl = "https://nexus-api.perkos.xyz/api";
export const perkosApiBaseUrl =
  process.env.NEXT_PUBLIC_PERKOS_API_URL ?? defaultApiUrl;

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
    return {
      id: snap.id,
      name: (data.name as string) ?? "",
      goal: (data.goal as string) ?? "",
      status: (data.status as string) ?? "Active",
      agents: (data.agents as number) ?? 0,
      tasks: (data.tasks as number) ?? 0,
      budget: (data.budget as string) ?? "0 USDC",
      agentIds: (data.agentIds as string[] | undefined) ?? [],
      swarm,
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

const agentConverter: FirestoreDataConverter<Agent> = {
  toFirestore(agent) {
    const { id: _id, ...rest } = agent;
    return rest;
  },
  fromFirestore(snap) {
    const data = snap.data();
    return {
      id: snap.id,
      name: (data.name as string) ?? "",
      runtime: (data.runtime as AgentRuntime) ?? "Hermes",
      status: (data.status as Agent["status"]) ?? "unknown",
      walletAddress: (data.walletAddress as string) ?? "",
      plugins: (data.plugins as string[] | undefined) ?? [],
      taskArn: (data.taskArn as string | undefined) ?? undefined,
      endpoint: (data.endpoint as string | undefined) ?? undefined,
      createdAt: tsToIso(data.createdAt),
      image: (data.image as string | undefined) ?? undefined,
      modelKeyProvided: (data.modelKeyProvided as boolean | undefined) ?? undefined,
    };
  },
};

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

function taskDoc(walletAddress: string, projectId: string, taskId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "tasks",
    taskId
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
  const [projectsSnap, agentsSnap] = await Promise.all([
    getDocs(projectsCol(walletAddress)),
    getDocs(agentsCol(walletAddress)),
  ]);

  const projects = projectsSnap.docs.map((d) => d.data());
  const agents = agentsSnap.docs.map((d) => d.data());

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
    registeredAgents: agentsSnap.size,
    activeTasks: tasks.filter(
      (t) => t.status === "In progress" || t.status === "Review"
    ).length,
    completedTasks: tasks.filter((t) => t.status === "Done").length,
  };

  return { stats, projects, tasks: tasks.slice(0, 25), agents };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function getWalletProjects(
  walletAddress: string
): Promise<{ projects: Project[] }> {
  const snap = await getDocs(projectsCol(walletAddress));
  return { projects: snap.docs.map((d) => d.data()) };
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
}): Promise<{ project: Project }> {
  const ref = doc(projectsCol(input.walletAddress));
  const payload: Project = {
    name: input.name,
    goal: input.goal,
    status: "Active",
    agents: input.agentIds?.length ?? 0,
    tasks: 0,
    budget: input.budget ?? "0 USDC",
    agentIds: input.agentIds ?? [],
  };
  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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

export async function deleteProject(input: {
  walletAddress: string;
  projectId: string;
}): Promise<void> {
  // NOTE: this only deletes the project document. Tasks/messages
  // subcollections will be orphaned until we add a recursive cleanup
  // (Cloud Function trigger on project delete is the recommended path).
  await deleteDoc(projectDoc(input.walletAddress, input.projectId));
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

export async function createProjectTasks(input: {
  walletAddress: string;
  projectId: string;
  tasks: { name: string; priority?: string; agent?: string; prompt?: string }[];
}): Promise<{ tasks: Task[] }> {
  const col = tasksCol(input.walletAddress, input.projectId);
  const created: Task[] = [];
  for (const t of input.tasks) {
    const ref = doc(col);
    const payload: Task = {
      name: t.name,
      status: "Backlog",
      priority: (t.priority as Task["priority"]) ?? "Medium",
      agent: t.agent ?? "App Agent",
      prompt: t.prompt,
    };
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    created.push({ ...payload, id: ref.id });
  }
  // Keep the denormalized counter on the project doc in sync — the
  // /projects list reads `project.tasks` directly (not the subcollection
  // size), so without this the card always shows "0 tasks".
  if (created.length > 0) {
    await updateDoc(projectDoc(input.walletAddress, input.projectId), {
      tasks: increment(created.length),
      updatedAt: serverTimestamp(),
    });
  }
  return { tasks: created };
}

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
  }>;
}): Promise<{ task: Task }> {
  const ref = taskDoc(input.walletAddress, input.projectId, input.taskId);
  await updateDoc(ref, {
    ...input.patch,
    updatedAt: serverTimestamp(),
  });
  const fresh = await getDoc(ref);
  if (!fresh.exists()) {
    throw new Error("Task not found after update.");
  }
  return { task: fresh.data() };
}

export async function deleteTask(input: {
  walletAddress: string;
  projectId: string;
  taskId: string;
}): Promise<void> {
  await deleteDoc(taskDoc(input.walletAddress, input.projectId, input.taskId));
  // Mirror the increment in createProjectTasks so the project's task
  // count stays in sync with the subcollection.
  await updateDoc(projectDoc(input.walletAddress, input.projectId), {
    tasks: increment(-1),
    updatedAt: serverTimestamp(),
  }).catch(() => {
    // If the project doc disappeared (e.g. cascade delete in flight),
    // swallow — there's nothing to keep in sync with.
  });
}

// ---------------------------------------------------------------------------
// Project chat
// ---------------------------------------------------------------------------

export async function addProjectMessage(input: {
  walletAddress: string;
  projectId: string;
  text: string;
  from?: "user" | "agent";
}): Promise<{ message: ChatMessage }> {
  const col = messagesCol(input.walletAddress, input.projectId);
  const ref = doc(col);
  const payload: ChatMessage = {
    from: input.from ?? "user",
    text: input.text,
  };
  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return { message: { ...payload, id: ref.id } };
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function getWalletAgents(
  walletAddress: string
): Promise<Agent[]> {
  const snap = await getDocs(agentsCol(walletAddress));
  return snap.docs.map((d) => d.data());
}

export async function updateAgent(input: {
  walletAddress: string;
  agentId: string;
  patch: Partial<{ name: string; plugins: string[] }>;
}): Promise<{ agent: Agent }> {
  const ref = agentDoc(input.walletAddress, input.agentId);
  await updateDoc(ref, {
    ...input.patch,
    updatedAt: serverTimestamp(),
  });
  const fresh = await getDoc(ref);
  if (!fresh.exists()) {
    throw new Error("Agent not found after update.");
  }
  return { agent: fresh.data() };
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

export async function launchAgent(input: {
  walletAddress: string;
  runtime: AgentRuntime;
  name: string;
  plugins?: string[];
  modelKey?: string;
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
      imageTag: input.imageTag ?? undefined,
      deployMode: input.deployMode,
      runtimeKind: input.runtimeKind,
      hermesApiUrl: input.hermesApiUrl,
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) throw new Error(apiError(payload, "Agent registration failed"));
  return payload as unknown as LaunchAgentResponse;
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
