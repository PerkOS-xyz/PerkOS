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
  where,
  type FirestoreDataConverter,
  type Timestamp,
} from "firebase/firestore";

import { firebaseDb } from "./firebase";
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

// ---------------------------------------------------------------------------
// Collaborative plan doc ("Notes")
// ---------------------------------------------------------------------------

/** Lifecycle of a project's plan doc. */
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

/**
 * `Agent` plus the BYO/hosting fields the UI needs to gate lifecycle actions.
 * `external` agents (invited / self-hosted / imported) run on the user's own
 * infra, so they CAN'T be hibernated/woken (that's ECS scale-to-0, PerkOS-only).
 */
export type AgentRow = Agent & {
  external?: boolean;
};

const agentConverter: FirestoreDataConverter<AgentRow> = {
  toFirestore(agent) {
    const { id: _id, ...rest } = agent;
    return rest;
  },
  fromFirestore(snap) {
    const data = snap.data();
    const rawDeployMode = typeof data.deployMode === "string" ? data.deployMode : undefined;
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

function planCol(walletAddress: string, projectId: string) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "plan"
  );
}

function planDoc(walletAddress: string, projectId: string, planId: string) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "plan",
    planId
  );
}

function planBlocksCol(
  walletAddress: string,
  projectId: string,
  planId: string
) {
  return collection(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "plan",
    planId,
    "blocks"
  );
}

function planBlockDoc(
  walletAddress: string,
  projectId: string,
  planId: string,
  blockId: string
) {
  return doc(
    firebaseDb(),
    "wallets",
    normalize(walletAddress),
    "projects",
    projectId,
    "plan",
    planId,
    "blocks",
    blockId
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
 * Organizations SHARED with this wallet (owned by others). Reads the member's
 * own `sharedOrgs` discovery pointers, then loads each owner's live org doc
 * (allowed by the membership rules). Skips any the user can no longer access.
 */
export async function getSharedOrgs(
  walletAddress: string
): Promise<Organization[]> {
  const ptrs = await getDocs(
    collection(firebaseDb(), "wallets", normalize(walletAddress), "sharedOrgs")
  );
  const out = await Promise.all(
    ptrs.docs.map(async (d) => {
      const p = d.data() as { ownerWallet?: string; orgId?: string; role?: string; orgName?: string };
      const owner = p.ownerWallet;
      const orgId = p.orgId ?? d.id;
      if (!owner) return null;
      try {
        const snap = await getDoc(orgDoc(owner, orgId));
        const name = snap.exists() ? snap.data().name : p.orgName ?? "Shared org";
        return {
          id: orgId,
          name,
          ownerWallet: owner,
          isDefault: false,
          shared: true,
          role: (p.role as OrgRole) ?? "viewer",
        } as Organization;
      } catch {
        return null; // access revoked — skip
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
    return snap.docs.map((d) => d.data());
  }
  const snap = await getDocs(projectsCol(owner));
  return snap.docs
    .map((d) => d.data())
    .filter((p) => (p.orgId ?? input.defaultOrgId) === orgId);
}

/**
 * Stand-alone projects shared directly with this wallet (not via an org).
 * Reads the member's `sharedProjects` pointers + loads each owner's project.
 */
export async function getSharedProjects(
  walletAddress: string
): Promise<Array<Project & { ownerWallet: string }>> {
  const ptrs = await getDocs(
    collection(firebaseDb(), "wallets", normalize(walletAddress), "sharedProjects")
  );
  const out = await Promise.all(
    ptrs.docs.map(async (d) => {
      const p = d.data() as { ownerWallet?: string; projectId?: string };
      const owner = p.ownerWallet;
      const pid = p.projectId ?? d.id;
      if (!owner) return null;
      try {
        const snap = await getDoc(projectDoc(owner, pid));
        if (!snap.exists()) return null;
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
        .map((d) => (d.data().name ?? "").trim().toLowerCase())
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
 * Add one or more agents (by name — the project roster + "Lead" use agent
 * names, see project.agentIds) to a project. Merges with the existing roster
 * (dedup) and keeps the denormalized `agents` count in sync. Read-merge-write
 * (not a transaction) — fine at workspace scale, bulk-assign tolerant.
 */
export async function assignAgentsToProject(input: {
  walletAddress: string;
  projectId: string;
  agentNames: string[];
}): Promise<{ added: number; total: number }> {
  const ref = projectDoc(input.walletAddress, input.projectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Project not found.");
  const existing = (snap.data().agentIds as string[] | undefined) ?? [];
  const merged = Array.from(new Set([...existing, ...input.agentNames]));
  await updateDoc(ref, {
    agentIds: merged,
    agents: merged.length,
    updatedAt: serverTimestamp(),
  });
  return { added: merged.length - existing.length, total: merged.length };
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
  const ref = projectDoc(input.walletAddress, input.projectId);
  const patch: Record<string, unknown> = {
    pmAgent: input.pmAgent,
    updatedAt: serverTimestamp(),
  };
  if (input.pmAgent) {
    const snap = await getDoc(ref);
    const existing = (snap.data()?.agentIds as string[] | undefined) ?? [];
    if (!existing.includes(input.pmAgent)) {
      const merged = [...existing, input.pmAgent];
      patch.agentIds = merged;
      patch.agents = merged.length;
    }
  }
  await updateDoc(ref, patch);
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
// Collaborative plan doc ("Notes")
// ---------------------------------------------------------------------------

/** Read the project's active plan id (project.activePlanId), if any. */
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
 * Ensure an active plan doc exists for the project, creating one (and
 * pointing project.activePlanId at it) if missing. Mirrors the server-side
 * `ensurePlan` so humans can start a plan from the app — the PM tools use
 * the same activePlanId. Returns the plan id.
 */
export async function ensureProjectPlan(input: {
  walletAddress: string;
  projectId: string;
  createdBy?: string;
}): Promise<string> {
  const existing = await getActivePlanId(input.walletAddress, input.projectId);
  if (existing) {
    const snap = await getDoc(
      planDoc(input.walletAddress, input.projectId, existing)
    );
    if (snap.exists()) return existing;
  }
  const ref = doc(planCol(input.walletAddress, input.projectId));
  await setDoc(ref, {
    status: "draft",
    title: null,
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

/** Append a human-owned `note` block to the end of the plan. */
export async function addPlanNote(input: {
  walletAddress: string;
  projectId: string;
  planId: string;
  text: string;
  owner: string;
  order: number;
}): Promise<{ id: string }> {
  const ref = doc(
    planBlocksCol(input.walletAddress, input.projectId, input.planId)
  );
  await setDoc(ref, {
    type: "note",
    text: input.text,
    order: input.order,
    owner: input.owner,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id };
}

/** Edit a `note` block's text (last-writer-wins at block level). */
export async function updatePlanNote(input: {
  walletAddress: string;
  projectId: string;
  planId: string;
  blockId: string;
  text: string;
}): Promise<void> {
  await updateDoc(
    planBlockDoc(
      input.walletAddress,
      input.projectId,
      input.planId,
      input.blockId
    ),
    { text: input.text, updatedAt: serverTimestamp() }
  );
}

/** Delete a block (humans may remove their own notes). */
export async function deletePlanBlock(input: {
  walletAddress: string;
  projectId: string;
  planId: string;
  blockId: string;
}): Promise<void> {
  await deleteDoc(
    planBlockDoc(
      input.walletAddress,
      input.projectId,
      input.planId,
      input.blockId
    )
  );
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function getWalletAgents(
  walletAddress: string
): Promise<AgentRow[]> {
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
