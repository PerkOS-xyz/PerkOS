"use client";

/**
 * Template gallery cards for the new-project wizard (/companies/new).
 *
 * A template is presented as a horizontal card: a portrait panel on the
 * left — industry-tinted backdrop with the recommended team rendered as a
 * stack of agent portraits (head crops of the persona art in
 * /public/avatars) — and the pitch + team summary on the right. Accents are
 * muted so the brand pink stays the loudest color on the page.
 */

import Image from "next/image";
import { ArrowRight, Crown, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { AGENT_PRESETS } from "../lib/agentPresets";
import type { CompanyRole } from "../lib/companyTemplates";

export const TEMPLATE_ACCENTS: Record<string, string> = {
  marketing: "#ec1b69",
  ecommerce: "#f97316",
  services: "#60a5fa",
  realestate: "#34d399",
  health: "#2dd4bf",
  food: "#fbbf24",
  education: "#a78bfa",
  trades: "#eab308",
  finance: "#22d3ee",
  local: "#e879f9",
};

export const INDUSTRY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  ecommerce: "E-commerce",
  services: "Professional services",
  realestate: "Real estate",
  health: "Health & wellness",
  food: "Food & hospitality",
  education: "Education",
  trades: "Construction & trades",
  finance: "Financial services",
  local: "Local services",
};

export const BRAND_ACCENT = "#ec1b69";

/** 8-digit hex — lets the per-industry accent fade into gradients/rings. */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

// Authored roles (no presetId) get a portrait by what the role does.
// Order matters: first match wins.
const ROLE_AVATAR_RULES: [RegExp, string][] = [
  [/social|marketing|promo|launch/i, "/avatars/13.Marketing.png"],
  [/seo|research/i, "/avatars/05.Researcher.png"],
  [/review|reputation/i, "/avatars/03.QA.png"],
  [/support|patient|communication|community/i, "/avatars/04.Support.png"],
  [/front desk|booking|schedul|concierge/i, "/avatars/11.Concierge.png"],
  [/menu|kitchen|build/i, "/avatars/01.Builder.png"],
  [/quote|invoice|bookkeep/i, "/avatars/09.Trader.png"],
  [/writer|copy|content|proposal|report/i, "/avatars/07.Knowledge.png"],
  [/analyst|data/i, "/avatars/06.Analyst.png"],
  [/sales|lead/i, "/avatars/12.Sales.png"],
];

function roleAvatar(role: CompanyRole): string {
  // The PM preset's avatar is the logo — use the orchestrator portrait instead.
  if (role.presetId && role.presetId !== "pm") {
    const a = AGENT_PRESETS.find((p) => p.id === role.presetId)?.avatar;
    if (a?.startsWith("/avatars/")) return a;
  }
  if (!role.presetId || role.presetId === "pm") {
    for (const [re, src] of ROLE_AVATAR_RULES) {
      if (re.test(role.role)) return src;
    }
  }
  return "/avatars/08.Workflow.png";
}

/**
 * Circular head crop of a persona poster: the robot heads sit at ~(50%, 22%)
 * in every avatar, so a 2.1x zoom anchored there frames the face.
 */
function RoleHead({
  role,
  isPM,
  accent,
  className,
}: {
  role: CompanyRole;
  isPM: boolean;
  accent: string;
  className?: string;
}) {
  return (
    <span
      title={role.role}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-full bg-[#1a1228]",
        isPM && "z-10",
        className,
      )}
      style={{ boxShadow: `0 0 0 2px ${isPM ? accent : "#241a35"}` }}
    >
      <Image
        src={roleAvatar(role)}
        alt={role.role}
        fill
        sizes="48px"
        className="origin-[50%_22%] scale-[2.1] object-cover"
      />
    </span>
  );
}

export function TeamTemplateCard({
  name,
  blurb,
  kicker,
  icon: Icon,
  accent,
  roles,
  onSelect,
  titlePadding,
}: {
  name: string;
  blurb: string;
  kicker: string;
  icon: LucideIcon;
  accent: string;
  roles: CompanyRole[];
  onSelect: () => void;
  /** Extra right padding on the title row (room for an overlay button). */
  titlePadding?: boolean;
}) {
  const pm = roles.find((r) => r.isPM) ?? roles[0];
  const others = roles.filter((r) => r !== pm);
  const stack = pm ? [pm, ...others] : others;
  const shown = stack.slice(0, 4);
  const overflow = stack.length - shown.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="glow-card group flex h-full w-full overflow-hidden rounded-xl border border-border bg-card/60 text-left transition-colors hover:border-primary/60"
    >
      {/* Portrait panel */}
      <div
        className="relative flex w-[7.5rem] shrink-0 flex-col items-center justify-center gap-2.5 self-stretch overflow-hidden border-r border-border/60 sm:w-44"
        style={{
          background: `linear-gradient(150deg, ${withAlpha(accent, 0.22)}, ${withAlpha(accent, 0.05)} 60%, transparent), linear-gradient(160deg, #150c20, #0e0716)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
        <Icon
          aria-hidden
          className="absolute -bottom-4 -right-4 h-20 w-20 -rotate-[8deg]"
          style={{ color: withAlpha(accent, 0.16) }}
        />
        <span className="relative flex items-center -space-x-3">
          {shown.map((r, i) => (
            <RoleHead
              key={`${r.role}-${i}`}
              role={r}
              isPM={r === pm}
              accent={accent}
              className="h-9 w-9 sm:h-12 sm:w-12"
            />
          ))}
          {overflow > 0 ? (
            <span
              className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1a1228] text-[10px] font-semibold text-muted-foreground sm:h-12 sm:w-12 sm:text-xs"
              style={{ boxShadow: "0 0 0 2px #241a35" }}
            >
              +{overflow}
            </span>
          ) : null}
        </span>
        <span
          className="relative rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] sm:text-[10px]"
          style={{
            color: accent,
            borderColor: withAlpha(accent, 0.35),
            background: withAlpha(accent, 0.08),
          }}
        >
          {stack.length} agent{stack.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Details */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4 sm:p-5">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {kicker}
        </span>
        <span
          className={cn(
            "truncate text-base font-semibold text-foreground sm:text-lg",
            titlePadding && "pr-7",
          )}
        >
          {name}
        </span>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {blurb}
        </p>
        <div className="mt-auto flex min-w-0 flex-col gap-1 pt-2.5">
          {pm ? (
            <span className="flex items-center gap-1.5 truncate text-xs text-foreground">
              <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
              Led by <span className="truncate font-medium">{pm.role}</span>
            </span>
          ) : null}
          {others.length > 0 ? (
            <span className="truncate text-xs text-muted-foreground">
              {others.map((r) => r.role).join("  ·  ")}
            </span>
          ) : null}
          <span
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium opacity-70 transition-opacity group-hover:opacity-100"
            style={{ color: accent }}
          >
            Use this team
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

/**
 * Horizontal starter card (Custom team / Empty project) — same layout
 * language as the template cards, with an icon where the team would be.
 */
export function StarterCard({
  title,
  blurb,
  kicker,
  cta,
  icon: Icon,
  accent,
  emphasized,
  onSelect,
}: {
  title: string;
  blurb: string;
  kicker: string;
  cta: string;
  icon: LucideIcon;
  accent: string;
  emphasized?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "glow-card group flex h-full w-full overflow-hidden rounded-xl border bg-card/60 text-left transition-colors",
        emphasized
          ? "border-primary/40 hover:border-primary/70"
          : "border-border hover:border-primary/40",
      )}
    >
      <div
        className="relative flex w-[7.5rem] shrink-0 items-center justify-center self-stretch overflow-hidden border-r border-border/60 sm:w-44"
        style={{
          background: `linear-gradient(150deg, ${withAlpha(accent, 0.2)}, ${withAlpha(accent, 0.04)} 60%, transparent), linear-gradient(160deg, #150c20, #0e0716)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
        <span
          className="relative grid h-12 w-12 place-items-center rounded-2xl sm:h-14 sm:w-14"
          style={{
            background: withAlpha(accent, 0.14),
            color: accent,
            boxShadow: `0 0 0 1px ${withAlpha(accent, 0.3)}`,
          }}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4 sm:p-5">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {kicker}
        </span>
        <span className="text-base font-semibold text-foreground sm:text-lg">
          {title}
        </span>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {blurb}
        </p>
        <span
          className="mt-auto inline-flex items-center gap-1 pt-2.5 text-xs font-medium opacity-70 transition-opacity group-hover:opacity-100"
          style={{ color: accent }}
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}
