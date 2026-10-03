"use client";

import { useId } from "react";
import type { AgentAvatarIdentity } from "../lib/agentAvatarIdentity";

export type AgentIdentityState = "available" | "working" | "waiting" | "resting";

function CoreShape({ identity }: { identity: AgentAvatarIdentity }) {
  if (identity.form === "prism")
    return <path d="M50 10 86 31 78 77 50 92 22 77 14 31Z" />;
  if (identity.form === "spark")
    return <path d="m50 8 11 28 29 14-29 14-11 28-11-28L10 50l29-14Z" />;
  if (identity.form === "halo")
    return <circle cx="50" cy="50" r="34" fill="none" strokeWidth="13" />;
  return <circle cx="50" cy="50" r="38" />;
}

function IdentityPattern({ identity }: { identity: AgentAvatarIdentity }) {
  const stroke = `hsla(${identity.secondaryHue}, 88%, 82%, .7)`;
  if (identity.pattern === "split")
    return <path d="M18 56 82 35" stroke={stroke} strokeWidth="5" strokeLinecap="round" />;
  if (identity.pattern === "orbit")
    return <ellipse cx="50" cy="50" rx="43" ry="19" fill="none" stroke={stroke} strokeWidth="3" transform="rotate(-18 50 50)" />;
  if (identity.pattern === "rays")
    return <path d="M50 15v16M50 69v16M15 50h16M69 50h16" stroke={stroke} strokeWidth="4" strokeLinecap="round" />;
  return null;
}

function IdentityMark({ identity }: { identity: AgentAvatarIdentity }) {
  const color = `hsl(${identity.secondaryHue} 90% 88%)`;
  if (identity.mark === "arc") return <path d="M31 58c7 13 31 13 38 0" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" />;
  if (identity.mark === "dot") return <circle cx="50" cy="50" r="8" fill={color} />;
  if (identity.mark === "line") return <path d="M34 50h32" stroke={color} strokeWidth="7" strokeLinecap="round" />;
  if (identity.mark === "wave") return <path d="M29 53c7-13 14 13 21 0s14 13 21 0" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />;
  return <path d="m50 35 4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1Z" fill={color} />;
}

export function AgentIdentityAvatar({
  identity,
  size = 40,
  state,
  className = "",
}: {
  identity: AgentAvatarIdentity;
  size?: number;
  state?: AgentIdentityState | null;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const stateRing =
    state === "available"
      ? "0 0 0 3px hsl(160 70% 48% / .8)"
      : state === "working"
        ? `0 0 0 3px hsl(${identity.accentHue} 85% 58% / .9), 0 0 ${Math.max(12, size / 3)}px hsl(${identity.accentHue} 85% 58% / .35)`
        : state === "waiting"
          ? "0 0 0 3px hsl(42 90% 55% / .8)"
          : state === "resting"
            ? "0 0 0 3px hsl(240 12% 48% / .45)"
            : "";
  return (
    <span
      aria-hidden
      data-avatar-version={identity.version}
      data-avatar-seed={identity.seed}
      data-avatar-state={state ?? "identity"}
      className={`relative inline-grid shrink-0 place-items-center rounded-full motion-safe:transition-[filter,opacity,box-shadow] ${className}`}
      style={{
        width: size,
        height: size,
        padding: Math.max(1, Math.round(size * 0.06)),
        background: `hsl(${identity.accentHue} 45% 13% / .85)`,
        boxShadow: stateRing,
        filter: state === "resting" ? "saturate(.45)" : undefined,
        opacity: state === "resting" ? 0.72 : 1,
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <defs>
          <radialGradient id={gradientId} cx="30%" cy="25%" r="80%">
            <stop offset="0%" stopColor={`hsl(${identity.secondaryHue} 88% 68%)`} />
            <stop offset="58%" stopColor={`hsl(${identity.accentHue} 78% 52%)`} />
            <stop offset="100%" stopColor={`hsl(${identity.accentHue} 78% 25%)`} />
          </radialGradient>
        </defs>
        <g fill={`url(#${gradientId})`} stroke={`url(#${gradientId})`}>
          <CoreShape identity={identity} />
        </g>
        <IdentityPattern identity={identity} />
        <IdentityMark identity={identity} />
        {identity.detail === "pin" ? <circle cx="76" cy="24" r="6" fill={`hsl(${identity.secondaryHue} 95% 76%)`} /> : null}
        {identity.detail === "ring" ? <circle cx="50" cy="50" r="45" fill="none" stroke={`hsl(${identity.secondaryHue} 70% 70% / .5)`} strokeWidth="2" /> : null}
        {identity.detail === "trail" ? <path d="M18 79c19 9 45 9 64 0" fill="none" stroke={`hsl(${identity.secondaryHue} 75% 70% / .55)`} strokeWidth="3" strokeLinecap="round" /> : null}
      </svg>
    </span>
  );
}
