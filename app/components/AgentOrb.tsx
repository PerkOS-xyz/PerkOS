"use client";

/**
 * AgentOrb — the agent's visual identity everywhere in the product.
 *
 * Registered agents resolve from an immutable ID and owner appearance.
 * Explicit snapshots still work for templates; name/role is a legacy fallback
 * for historical actors without an accessible registry record.
 */

import type { AgentAvatarIdentity, RegisteredAgentAppearance } from "../lib/agentAvatarIdentity";
import { deriveAgentAvatarIdentity, registeredAgentAvatar } from "../lib/agentAvatarIdentity";
import { AgentIdentityAvatar, type AgentIdentityState } from "./AgentIdentityAvatar";
import { useProjectAgentIdentity, useRegisteredAgent } from "./ProjectAgentIdentity";

export function AgentOrb({
  name,
  presetId,
  role,
  size = 40,
  status,
  identity,
  identitySeed,
  agent,
  className = "",
}: {
  /** Canonical roster name when available; otherwise the legacy seed label. */
  name: string;
  /** Preset id (agentPresets.ts) — fixed hue + glyph when known. */
  presetId?: string | null;
  /** Role label (template roles) — keyword-matched when no presetId. */
  role?: string | null;
  /** Pixel size of the circle. */
  size?: number;
  /** Optional status halo: available (green) | resting (muted). */
  status?: "available" | "resting" | null;
  /** Stored identity snapshot. Prefer this once a project role exists. */
  identity?: AgentAvatarIdentity | null;
  /** Stable preview seed used before a project snapshot exists. */
  identitySeed?: string | null;
  agent?: RegisteredAgentAppearance;
  className?: string;
}) {
  const projectIdentity = useProjectAgentIdentity(name);
  const rosterAgent = useRegisteredAgent(name);
  const registered = agent ?? rosterAgent;
  const appearance = registered ? registeredAgentAvatar(registered) : undefined;
  const resolved =
    identity ??
    appearance?.identity ??
    projectIdentity ??
    deriveAgentAvatarIdentity(
      identitySeed || [presetId, role, name].filter(Boolean).join(":") || name,
      role || presetId || name,
    );
  return (
    <AgentIdentityAvatar
      identity={resolved}
      photo={identity ? undefined : appearance?.photo}
      size={size}
      state={status as AgentIdentityState | null}
      className={className}
    />
  );
}
