"use client";

/**
 * AgentOrb — the agent's visual identity everywhere in the product.
 *
 * A role-tinted gradient circle + role glyph + initials: a colleague badge,
 * not a robot (user testing: robot portraits scared non-technical users).
 * Replaces /avatars/*.png, /avatar.png and /agent.svg across all surfaces.
 *
 * Size behavior: <24px solid circle only · ≥24px glyph · ≥40px initials with
 * a glyph sub-badge top-right · big sizes are meant to sit inside the "ID
 * card" layout (see the agent wizard hero).
 */

import type { AgentAvatarIdentity } from "../lib/agentAvatarIdentity";
import { deriveAgentAvatarIdentity } from "../lib/agentAvatarIdentity";
import { AgentIdentityAvatar, type AgentIdentityState } from "./AgentIdentityAvatar";

export function AgentOrb({
  name,
  presetId,
  role,
  size = 40,
  status,
  identity,
  identitySeed,
  className = "",
}: {
  /** Display name — drives initials + fallback hue. */
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
  className?: string;
}) {
  const resolved =
    identity ??
    deriveAgentAvatarIdentity(
      identitySeed || [presetId, role, name].filter(Boolean).join(":") || name,
    );
  return (
    <AgentIdentityAvatar
      identity={resolved}
      size={size}
      state={status as AgentIdentityState | null}
      className={className}
    />
  );
}
