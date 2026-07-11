// ============================================================================
// Shared landing data — single source of truth for both the live landing
// (LandingContent.tsx) and the v2 preview. Values copied verbatim so the two
// surfaces never drift. Copy still lives in i18n; these are only the
// non-translated bits (icons, preset ids, accent hues).
// ============================================================================

import {
  Briefcase,
  Calculator,
  Coffee,
  GraduationCap,
  Hammer,
  Handshake,
  HeartPulse,
  Home,
  Mail,
  Moon,
  Palette,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type TemplatePitch = {
  key: string;
  Icon: LucideIcon;
  accent: string;
};

export const TEMPLATE_PITCHES: TemplatePitch[] = [
  { key: "restaurant", Icon: UtensilsCrossed, accent: "#fbbf24" },
  { key: "realEstate", Icon: Home, accent: "#34d399" },
  { key: "growthAgency", Icon: Palette, accent: "#ec1b69" },
  { key: "onlineStore", Icon: ShoppingCart, accent: "#f97316" },
  { key: "consulting", Icon: Briefcase, accent: "#60a5fa" },
  { key: "healthWellness", Icon: HeartPulse, accent: "#2dd4bf" },
  { key: "coaching", Icon: GraduationCap, accent: "#a78bfa" },
  { key: "trades", Icon: Hammer, accent: "#eab308" },
  { key: "finance", Icon: Calculator, accent: "#22d3ee" },
  { key: "localServices", Icon: Sparkles, accent: "#e879f9" },
];

export type TeamRole = { key: string; presetId: string };

export const TEAM_ROLES: TeamRole[] = [
  { key: "teamLead", presetId: "pm" },
  { key: "distribution", presetId: "marketing" },
  { key: "research", presetId: "researcher" },
  { key: "bookkeeping", presetId: "analyst" },
];

// --- Remaining landing sections (copied verbatim from LandingContent.tsx) ---

export const FEAR_KILLERS: { Icon: LucideIcon; key: string }[] = [
  { Icon: ShieldCheck, key: "approval" },
  { Icon: Coffee, key: "simple" },
  { Icon: Moon, key: "affordable" },
];

export const HOW_IT_WORKS_STEPS: { n: string; key: string }[] = [
  { n: "1", key: "pick" },
  { n: "2", key: "say" },
  { n: "3", key: "review" },
];

export const EXPERTISE_PROOFS = ["plan", "quality", "sleep"];

export type Tier = {
  key: string;
  ctaHref: string;
  smart?: boolean;
  featured?: boolean;
};

export const TIERS: Tier[] = [
  { key: "free", ctaHref: "/sign-in", smart: true },
  { key: "starter", ctaHref: "/sign-in", smart: true },
  { key: "pro", ctaHref: "/sign-in", smart: true, featured: true },
  { key: "scale", ctaHref: "/sign-in", smart: true },
];

export const BUILDER_LINKS: { Icon: LucideIcon; key: string; href: string }[] = [
  { Icon: Handshake, key: "partners", href: "mailto:partner@perkos.xyz" },
  { Icon: Mail, key: "developers", href: "mailto:contact@perkos.xyz" },
];

export const CONTACTS: { Icon: LucideIcon; key: string; value: string; href: string }[] = [
  { Icon: Mail, key: "general", value: "contact@perkos.xyz", href: "mailto:contact@perkos.xyz" },
  { Icon: Handshake, key: "partnerships", value: "partner@perkos.xyz", href: "mailto:partner@perkos.xyz" },
  { Icon: Briefcase, key: "investors", value: "invest@perkos.xyz", href: "mailto:invest@perkos.xyz" },
];
