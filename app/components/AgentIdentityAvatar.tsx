"use client";

import { useId } from "react";
import type { AgentAvatarIdentity } from "../lib/agentAvatarIdentity";

export type AgentIdentityState = "available" | "working" | "waiting" | "resting";

function seedHash(seed: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function Head({ variant, fill }: { variant: number; fill: string }) {
  if (variant === 1) return <circle cx="50" cy="49" r="33" fill={fill} />;
  if (variant === 2) return <path d="M18 51c0-23 13-36 32-36s32 13 32 36v20c0 10-7 16-17 16H35c-10 0-17-6-17-16Z" fill={fill} />;
  if (variant === 3) return <path d="M23 14h54l10 22-8 49H21l-8-49Z" fill={fill} />;
  return <rect x="17" y="14" width="66" height="72" rx="25" fill={fill} />;
}

function Visor({ variant, id }: { variant: number; id: string }) {
  const fill = `url(#visor-${id})`;
  if (variant === 1) return <rect x="24" y="34" width="52" height="32" rx="10" fill={fill} />;
  if (variant === 2) return <path d="M25 32h50c6 0 9 5 7 11l-7 21c-1 5-5 7-10 7H35c-5 0-9-2-10-7l-7-21c-2-6 1-11 7-11Z" fill={fill} />;
  return <rect x="22" y="31" width="56" height="38" rx="19" fill={fill} />;
}

function Modules({ variant, fill, accent }: { variant: number; fill: string; accent: string }) {
  if (variant === 1) return <><rect x="7" y="38" width="14" height="28" rx="7" fill={fill} /><rect x="79" y="38" width="14" height="28" rx="7" fill={fill} /><circle cx="14" cy="52" r="4" fill={accent} /><circle cx="86" cy="52" r="4" fill={accent} /></>;
  if (variant === 2) return <><path d="M19 38C8 40 5 47 7 57s6 15 15 16Z" fill={fill} /><path d="M81 38c11 2 14 9 12 19s-6 15-15 16Z" fill={fill} /></>;
  return <><circle cx="14" cy="52" r="10" fill={fill} /><circle cx="86" cy="52" r="10" fill={fill} /><circle cx="14" cy="52" r="4" fill={accent} /><circle cx="86" cy="52" r="4" fill={accent} /></>;
}

function Eyes({ state, color }: { state?: AgentIdentityState | null; color: string }) {
  if (state === "resting") return <g stroke={color} strokeWidth="4" strokeLinecap="round"><path d="M33 53h11" /><path d="M56 53h11" /></g>;
  if (state === "working") return <g fill={color}><path d="m31 48 14 3-2 7-12-4Z" /><path d="m69 48-14 3 2 7 12-4Z" /></g>;
  if (state === "waiting") return <g fill="none" stroke={color} strokeWidth="3"><circle cx="38" cy="53" r="5" /><circle cx="62" cy="53" r="5" /></g>;
  return <g fill={color}><rect x="33" y="45" width="9" height="17" rx="4.5" /><rect x="58" y="45" width="9" height="17" rx="4.5" /></g>;
}

/** Runtime avatar kit adapted for the App. Identity layers come from the
 * persistent seed; runtime state changes only eyes, ring, glow and motion. */
export function AgentIdentityAvatar({ identity, size = 40, state, className = "" }: {
  identity: AgentAvatarIdentity;
  size?: number;
  state?: AgentIdentityState | null;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const hash = seedHash(identity.seed);
  const head = hash % 4;
  const visor = (hash >>> 4) % 3;
  const modules = (hash >>> 7) % 3;
  const accent = `hsl(${identity.accentHue} 88% 62%)`;
  const secondary = `hsl(${identity.secondaryHue} 82% 72%)`;
  const ring = state === "available" ? "#35e08a" : state === "working" ? "#2fd0e6" : state === "waiting" ? "#ffb020" : "#697184";
  const mode = state === "resting" ? "hibernating" : "active";

  return (
    <span
      aria-hidden="true"
      data-avatar-kit="runtime-v1"
      data-avatar-version={identity.version}
      data-avatar-seed={identity.seed}
      data-avatar-state={state ?? "identity"}
      data-mode={mode}
      className={`agent-runtime-avatar relative inline-grid shrink-0 place-items-center rounded-full ${state === "working" ? "motion-safe:animate-pulse" : ""} ${className}`}
      style={{ width: size, height: size, opacity: state === "resting" ? 0.66 : 1, filter: state === "resting" ? "grayscale(.65) saturate(.5)" : undefined }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
        <defs>
          <radialGradient id={`shell-${uid}`} cx="35%" cy="20%" r="90%"><stop offset="0%" stopColor="#fff" /><stop offset="55%" stopColor="#dfe5ee" /><stop offset="100%" stopColor="#7f899b" /></radialGradient>
          <radialGradient id={`visor-${uid}`} cx="50%" cy="30%" r="80%"><stop offset="0%" stopColor="#20283a" /><stop offset="100%" stopColor="#04060b" /></radialGradient>
          <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.8" /></filter>
        </defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke={ring} strokeOpacity=".2" strokeWidth="5" />
        <circle className={state === "working" ? "origin-center motion-safe:animate-spin motion-safe:[animation-duration:5s]" : ""} cx="50" cy="50" r="46" fill="none" stroke={ring} strokeWidth="2.2" strokeLinecap="round" strokeDasharray={state === "working" ? "65 25" : state === "waiting" ? "18 10" : undefined} />
        <g opacity=".65" filter={`url(#glow-${uid})`} fill="none" stroke={accent} strokeWidth="4"><circle cx="50" cy="50" r="38" /></g>
        <Modules variant={modules} fill={`url(#shell-${uid})`} accent={accent} />
        <Head variant={head} fill={`url(#shell-${uid})`} />
        <Visor variant={visor} id={uid} />
        <path d={identity.pattern === "rays" ? "M50 16v13M50 72v12" : identity.pattern === "split" ? "M24 73 76 26" : "M27 72Q50 83 73 72"} fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
        <g opacity=".35" filter={`url(#glow-${uid})`}><Eyes state={state} color={secondary} /></g>
        <Eyes state={state} color={secondary} />
        {identity.detail === "pin" ? <circle cx="72" cy="24" r="4" fill={accent} /> : null}
        {identity.detail === "trail" ? <path d="M32 79h36" stroke={accent} strokeWidth="3" strokeLinecap="round" /> : null}
      </svg>
    </span>
  );
}
