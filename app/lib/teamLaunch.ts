/**
 * Server-side team launch (`POST /projects/launch-team`): one call creates the
 * project, launches every teammate, assigns them and names the lead, so the
 * owner can close the tab right after clicking Launch. Progress is written to
 * the project doc as `launch`, which the project page already listens to.
 */

export type TeamLaunchStatus = "launching" | "ready" | "partial" | "failed";

export type TeamLaunchProgress = {
  status: TeamLaunchStatus;
  total: number;
  launched: number;
  failed: Array<{ role: string; name: string; error: string }>;
  updatedAt?: string;
};

export type TeamLaunchRole = {
  /** Agent name (2-32 letters, digits, `_` or `-`). */
  name: string;
  /** Human role label, shown when a teammate could not start. */
  role: string;
  runtime: string;
  soul?: string;
  plugins?: string[];
  skills?: string[];
  lead?: boolean;
  /** Register an agent the owner runs elsewhere instead of launching one. */
  external?: { runtimeKind?: "hermes" | "openclaw" | "custom"; note?: string };
};

export type TeamLaunchRequest = {
  /** Same id on a retry, so the team is never launched twice. */
  requestId: string;
  name: string;
  goal?: string;
  orgId?: string;
  templateId?: string;
  llm?: { modelKey?: string; llmBaseUrl?: string; llmModel?: string };
  roles: TeamLaunchRole[];
};

/** A launch with no news for this long is treated as over (server restart). */
const STALE_MS = 10 * 60_000;

export function newTeamLaunchRequestId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** The `launch` field of a project doc, read loosely like the rest of it. */
export function readTeamLaunch(raw: unknown): TeamLaunchProgress | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const v = raw as Record<string, unknown>;
  const status = v.status;
  if (status !== "launching" && status !== "ready" && status !== "partial" && status !== "failed") return undefined;
  const failed = Array.isArray(v.failed)
    ? v.failed
        .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
        .map((f) => ({ role: String(f.role ?? ""), name: String(f.name ?? ""), error: String(f.error ?? "") }))
    : [];
  return {
    status,
    total: typeof v.total === "number" ? v.total : 0,
    launched: typeof v.launched === "number" ? v.launched : 0,
    failed,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
  };
}

/** Still launching, and the server reported recently. */
export function teamLaunchInProgress(launch: TeamLaunchProgress | undefined, now = Date.now()): boolean {
  if (launch?.status !== "launching") return false;
  const at = launch.updatedAt ? Date.parse(launch.updatedAt) : Number.NaN;
  return Number.isFinite(at) && now - at < STALE_MS;
}

/**
 * Start the launch. Resolves to the new project's id, or `null` when the API
 * predates the endpoint (404): the caller then launches the team itself, so
 * the App and the API can deploy in either order.
 */
export async function launchTeam(input: TeamLaunchRequest): Promise<{ projectId: string } | null> {
  const { authedFetch } = await import("./apiClient");
  const response = await authedFetch("/projects/launch-team", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (response.status === 404) return null;
  const payload = (await response.json().catch(() => ({}))) as {
    projectId?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.projectId) {
    throw new Error(payload.error?.message ?? `Couldn't launch the team (${response.status})`);
  }
  return { projectId: payload.projectId };
}
