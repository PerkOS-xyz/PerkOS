import { describe, expect, it } from "vitest";

import {
  emptySwarm,
  findMember,
  parseSwarmYaml,
  rosterAgents,
  serializeSwarmYaml,
  validateSwarm,
  type SwarmDefinition,
} from "../app/lib/swarm";

const VALID_SWARM: SwarmDefinition = {
  version: "1",
  name: "Mobile app refactor",
  description: "Two builders, one reviewer, one QA",
  roster: [
    {
      handle: "builder-1",
      agent: "agent:openclaw-alice",
      role: "builder",
      description: "Implements features end-to-end",
    },
    {
      handle: "reviewer",
      agent: "agent:hermes-bob",
      role: "reviewer",
    },
  ],
};

const VALID_YAML = `version: "1"
name: Mobile app refactor
description: Two builders, one reviewer, one QA
roster:
  - handle: builder-1
    agent: agent:openclaw-alice
    role: builder
    description: Implements features end-to-end
  - handle: reviewer
    agent: agent:hermes-bob
    role: reviewer
`;

describe("validateSwarm", () => {
  it("accepts a well-formed swarm", () => {
    const result = validateSwarm(VALID_SWARM);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.swarm.roster).toHaveLength(2);
      expect(result.swarm.roster[0].agent).toBe("agent:openclaw-alice");
    }
  });

  it("rejects non-object inputs", () => {
    expect(validateSwarm(null).ok).toBe(false);
    expect(validateSwarm("not an object").ok).toBe(false);
    expect(validateSwarm([] as unknown).ok).toBe(false);
  });

  it("rejects wrong schema version", () => {
    const result = validateSwarm({ ...VALID_SWARM, version: "2" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "version")).toBe(true);
    }
  });

  it("requires a non-empty roster", () => {
    const result = validateSwarm({ ...VALID_SWARM, roster: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "roster")).toBe(true);
    }
  });

  it("rejects duplicate handles", () => {
    const result = validateSwarm({
      ...VALID_SWARM,
      roster: [
        { handle: "dup", agent: "agent:alice", role: "builder" },
        { handle: "dup", agent: "agent:bob", role: "reviewer" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.path === "roster[1].handle"),
      ).toBe(true);
    }
  });

  it("rejects duplicate agents", () => {
    const result = validateSwarm({
      ...VALID_SWARM,
      roster: [
        { handle: "a", agent: "agent:alice", role: "builder" },
        { handle: "b", agent: "agent:alice", role: "reviewer" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === "roster[1].agent")).toBe(true);
    }
  });

  it("rejects invalid handle format", () => {
    const result = validateSwarm({
      ...VALID_SWARM,
      roster: [{ handle: "Bad Handle!", agent: "agent:x", role: "r" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("roster[0].handle");
    }
  });

  it("rejects invalid agent format", () => {
    const result = validateSwarm({
      ...VALID_SWARM,
      roster: [{ handle: "a", agent: "not-an-agent", role: "r" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("roster[0].agent");
    }
  });

  it("collects multiple errors in one pass", () => {
    const result = validateSwarm({
      version: "1",
      roster: [
        { handle: "BAD!", agent: "nope", role: "" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // handle, agent, and role should each fail.
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("parseSwarmYaml + serializeSwarmYaml", () => {
  it("round-trips a valid swarm through YAML", () => {
    const parsed = parseSwarmYaml(VALID_YAML);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const yaml2 = serializeSwarmYaml(parsed.swarm);
    const reparsed = parseSwarmYaml(yaml2);
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) expect(reparsed.swarm).toEqual(parsed.swarm);
  });

  it("reports yaml syntax errors with a path of ''", () => {
    const result = parseSwarmYaml("name: : :"); // invalid scalar
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].path).toBe("");
    }
  });

  it("drops undefined fields when serializing", () => {
    const yaml = serializeSwarmYaml({
      version: "1",
      roster: [{ handle: "a", agent: "agent:x", role: "builder" }],
    });
    expect(yaml).not.toMatch(/name:/);
    expect(yaml).not.toMatch(/description:/);
    expect(yaml).toMatch(/handle: a/);
  });
});

describe("helpers", () => {
  it("findMember locates by handle", () => {
    expect(findMember(VALID_SWARM, "reviewer")?.agent).toBe("agent:hermes-bob");
    expect(findMember(VALID_SWARM, "nobody")).toBeNull();
  });

  it("rosterAgents returns agent identities in order", () => {
    expect(rosterAgents(VALID_SWARM)).toEqual([
      "agent:openclaw-alice",
      "agent:hermes-bob",
    ]);
  });

  it("emptySwarm builds a minimal valid-shaped scaffold (but with empty roster)", () => {
    const s = emptySwarm("My Project");
    expect(s.version).toBe("1");
    expect(s.name).toBe("My Project");
    expect(s.roster).toEqual([]);
    // It deliberately fails validation because a real swarm needs members.
    expect(validateSwarm(s).ok).toBe(false);
  });
});
