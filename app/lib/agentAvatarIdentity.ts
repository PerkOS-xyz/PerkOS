export const AGENT_AVATAR_IDENTITY_VERSION = 1 as const;

export const AGENT_AVATAR_FORMS = ["orb", "halo", "prism", "spark"] as const;
export const AGENT_AVATAR_MARKS = ["arc", "dot", "line", "star", "wave"] as const;
export const AGENT_AVATAR_PATTERNS = ["plain", "split", "orbit", "rays"] as const;
export const AGENT_AVATAR_DETAILS = ["none", "pin", "ring", "trail"] as const;

export type AgentAvatarIdentity = {
  version: typeof AGENT_AVATAR_IDENTITY_VERSION;
  seed: string;
  form: (typeof AGENT_AVATAR_FORMS)[number];
  accentHue: number;
  secondaryHue: number;
  mark: (typeof AGENT_AVATAR_MARKS)[number];
  pattern: (typeof AGENT_AVATAR_PATTERNS)[number];
  detail: (typeof AGENT_AVATAR_DETAILS)[number];
};

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(items: readonly T[], hash: number, shift: number): T {
  return items[(hash >>> shift) % items.length]!;
}

/**
 * Produce the persistent, abstract visual identity stored with a project role.
 * Runtime state such as working/resting never belongs in this value.
 */
export function deriveAgentAvatarIdentity(seed: string): AgentAvatarIdentity {
  const normalized = seed.trim();
  if (!normalized) throw new Error("Agent avatar seed is required");
  const hash = hashSeed(normalized);
  const accentHue = hash % 360;
  return {
    version: AGENT_AVATAR_IDENTITY_VERSION,
    seed: normalized,
    form: pick(AGENT_AVATAR_FORMS, hash, 1),
    accentHue,
    secondaryHue: (accentHue + 48 + ((hash >>> 7) % 97)) % 360,
    mark: pick(AGENT_AVATAR_MARKS, hash, 5),
    pattern: pick(AGENT_AVATAR_PATTERNS, hash, 9),
    detail: pick(AGENT_AVATAR_DETAILS, hash, 13),
  };
}
