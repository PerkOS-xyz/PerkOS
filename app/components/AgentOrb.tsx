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

import { agentInitials, agentVisual } from "../lib/agentVisuals";

export function AgentOrb({
  name,
  presetId,
  role,
  size = 40,
  status,
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
  className?: string;
}) {
  const { hue, Icon } = agentVisual({ presetId, role, name });
  const showInitials = size >= 40;
  const showGlyph = size >= 24;
  const glyphAsBadge = showInitials; // glyph moves to a sub-badge once initials show
  const ring =
    status === "available"
      ? "0 0 0 2px rgba(13,11,26,1), 0 0 0 4px hsla(160, 80%, 55%, 0.85)"
      : status === "resting"
        ? "0 0 0 2px rgba(13,11,26,1), 0 0 0 4px hsla(240, 20%, 55%, 0.4)"
        : "";

  return (
    <span
      aria-hidden
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, hsla(${hue}, 70%, 60%, 0.55), hsla(${hue}, 70%, 35%, 0.25))`,
        boxShadow: [
          `0 0 0 1px hsla(${hue}, 60%, 55%, 0.35)`,
          size >= 48 ? `0 0 ${Math.round(size / 5)}px 2px hsla(${hue}, 65%, 50%, 0.18)` : "",
          ring,
        ]
          .filter(Boolean)
          .join(", "),
        filter: status === "resting" ? "saturate(0.45)" : undefined,
        opacity: status === "resting" ? 0.75 : 1,
      }}
    >
      {showInitials ? (
        <span
          className="font-semibold tracking-tight"
          style={{
            fontSize: Math.max(11, Math.round(size * 0.34)),
            color: `hsla(${hue}, 85%, 88%, 0.95)`,
          }}
        >
          {agentInitials(name)}
        </span>
      ) : showGlyph ? (
        <Icon
          style={{
            width: Math.round(size * 0.5),
            height: Math.round(size * 0.5),
            color: `hsla(${hue}, 85%, 88%, 0.95)`,
          }}
        />
      ) : null}
      {glyphAsBadge && showGlyph ? (
        <span
          className="absolute grid place-items-center rounded-full"
          style={{
            width: Math.round(size * 0.38),
            height: Math.round(size * 0.38),
            right: -Math.round(size * 0.04),
            top: -Math.round(size * 0.04),
            background: `hsla(${hue}, 60%, 28%, 0.95)`,
            boxShadow: `0 0 0 1.5px hsla(${hue}, 60%, 60%, 0.5)`,
          }}
        >
          <Icon
            style={{
              width: Math.round(size * 0.22),
              height: Math.round(size * 0.22),
              color: `hsla(${hue}, 90%, 85%, 1)`,
            }}
          />
        </span>
      ) : null}
    </span>
  );
}
