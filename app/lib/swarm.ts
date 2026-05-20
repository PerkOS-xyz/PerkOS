/**
 * Swarm schema: a declarative roster definition for a project room.
 *
 * A swarm names the agents that should participate in a project's chat
 * channel and the role each one plays (builder, reviewer, QA, etc.).
 * It is YAML-importable so a team can be reproduced or version-controlled
 * alongside the codebase the agents are working on.
 *
 * Persistence: stored as `swarm` on the Firestore project document.
 * Wire format: `version: "1"` YAML; bump the version field on breaking
 * schema changes so older clients refuse to render unknown shapes.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export const SWARM_SCHEMA_VERSION = "1" as const;

export type SwarmRosterMember = {
  /**
   * Stable identifier within the swarm. Used by hooks/notifications and
   * shown in the conductor dashboard. Must be unique inside a swarm.
   */
  handle: string;
  /**
   * Agent identity string. Same shape as ChatIdentity ("agent:<name>").
   */
  agent: string;
  /**
   * Human-readable role label. Free-form by design — common values are
   * "builder", "reviewer", "qa", "researcher", "ops", but a swarm can
   * invent its own roles.
   */
  role: string;
  /** Optional one-line description of what this member does. */
  description?: string;
};

export type SwarmDefinition = {
  /** Schema version. Bumps on breaking changes. */
  version: typeof SWARM_SCHEMA_VERSION;
  /** Optional display name. Defaults to the project name when rendered. */
  name?: string;
  /** Optional one-line goal of the swarm. */
  description?: string;
  /** Ordered roster. UI may show in this order. */
  roster: SwarmRosterMember[];
};

export type SwarmValidationError = {
  /** Dotted path to the offending field, e.g. "roster[1].agent". */
  path: string;
  message: string;
};

export type SwarmParseResult =
  | { ok: true; swarm: SwarmDefinition }
  | { ok: false; errors: SwarmValidationError[] };

const AGENT_RE = /^agent:[A-Za-z0-9_-]{1,64}$/;
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/**
 * Validate a parsed object against the swarm schema. Pure function — no
 * IO — so callers can use it both on YAML input and on Firestore reads.
 */
export function validateSwarm(input: unknown): SwarmParseResult {
  const errors: SwarmValidationError[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ path: "", message: "swarm definition must be an object" }],
    };
  }

  const obj = input as Record<string, unknown>;

  if (obj.version !== SWARM_SCHEMA_VERSION) {
    errors.push({
      path: "version",
      message: `version must be "${SWARM_SCHEMA_VERSION}", got ${JSON.stringify(obj.version)}`,
    });
  }

  if (obj.name !== undefined && typeof obj.name !== "string") {
    errors.push({ path: "name", message: "name must be a string" });
  }
  if (obj.description !== undefined && typeof obj.description !== "string") {
    errors.push({
      path: "description",
      message: "description must be a string",
    });
  }

  const roster = obj.roster;
  if (!Array.isArray(roster)) {
    errors.push({ path: "roster", message: "roster must be an array" });
    return { ok: false, errors };
  }
  if (roster.length === 0) {
    errors.push({
      path: "roster",
      message: "roster must have at least one member",
    });
  }

  const seenHandles = new Set<string>();
  const seenAgents = new Set<string>();
  roster.forEach((member, i) => {
    const path = `roster[${i}]`;
    if (!member || typeof member !== "object" || Array.isArray(member)) {
      errors.push({ path, message: "member must be an object" });
      return;
    }
    const m = member as Record<string, unknown>;

    if (typeof m.handle !== "string" || !HANDLE_RE.test(m.handle)) {
      errors.push({
        path: `${path}.handle`,
        message:
          "handle must be lowercase alphanumeric with dashes/underscores (1-32 chars)",
      });
    } else if (seenHandles.has(m.handle)) {
      errors.push({
        path: `${path}.handle`,
        message: `duplicate handle "${m.handle}"`,
      });
    } else {
      seenHandles.add(m.handle);
    }

    if (typeof m.agent !== "string" || !AGENT_RE.test(m.agent)) {
      errors.push({
        path: `${path}.agent`,
        message: 'agent must match "agent:<name>"',
      });
    } else if (seenAgents.has(m.agent)) {
      errors.push({
        path: `${path}.agent`,
        message: `agent "${m.agent}" appears more than once in the roster`,
      });
    } else {
      seenAgents.add(m.agent);
    }

    if (typeof m.role !== "string" || m.role.trim().length === 0) {
      errors.push({
        path: `${path}.role`,
        message: "role must be a non-empty string",
      });
    }

    if (m.description !== undefined && typeof m.description !== "string") {
      errors.push({
        path: `${path}.description`,
        message: "description must be a string when present",
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  // Re-shape into the typed output so downstream code can rely on the
  // structure without re-asserting types.
  const swarm: SwarmDefinition = {
    version: SWARM_SCHEMA_VERSION,
    name: typeof obj.name === "string" ? obj.name : undefined,
    description:
      typeof obj.description === "string" ? obj.description : undefined,
    roster: (roster as Record<string, unknown>[]).map((m) => ({
      handle: m.handle as string,
      agent: m.agent as string,
      role: m.role as string,
      description:
        typeof m.description === "string" ? m.description : undefined,
    })),
  };

  return { ok: true, swarm };
}

/** Parse a YAML string into a SwarmDefinition. */
export function parseSwarmYaml(yaml: string): SwarmParseResult {
  let raw: unknown;
  try {
    raw = parseYaml(yaml);
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          path: "",
          message: err instanceof Error ? err.message : "invalid YAML",
        },
      ],
    };
  }
  return validateSwarm(raw);
}

/** Serialize a SwarmDefinition back to YAML for export. */
export function serializeSwarmYaml(swarm: SwarmDefinition): string {
  // Strip undefined fields so the YAML stays tidy.
  const clean: Record<string, unknown> = {
    version: swarm.version,
  };
  if (swarm.name) clean.name = swarm.name;
  if (swarm.description) clean.description = swarm.description;
  clean.roster = swarm.roster.map((m) => {
    const out: Record<string, unknown> = {
      handle: m.handle,
      agent: m.agent,
      role: m.role,
    };
    if (m.description) out.description = m.description;
    return out;
  });
  return stringifyYaml(clean, { lineWidth: 0 });
}

/** Return the roster member matching a handle, or null. */
export function findMember(
  swarm: SwarmDefinition,
  handle: string,
): SwarmRosterMember | null {
  return swarm.roster.find((m) => m.handle === handle) ?? null;
}

/** Return the set of agent identity strings in the swarm. */
export function rosterAgents(swarm: SwarmDefinition): string[] {
  return swarm.roster.map((m) => m.agent);
}

/** Build an empty swarm scaffold for a brand-new project. */
export function emptySwarm(name?: string): SwarmDefinition {
  return {
    version: SWARM_SCHEMA_VERSION,
    name,
    roster: [],
  };
}
