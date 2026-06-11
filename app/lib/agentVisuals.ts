/**
 * Agent visual identity — the AgentOrb system.
 *
 * Replaces the robot portrait PNGs (user testing: non-technical users were
 * scared by robot imagery). Every agent renders as a role-tinted gradient
 * circle ("colleague badge" register — Slack/Notion, not sci-fi) with a role
 * glyph and initials. Pure CSS/SVG: no image pipeline, scales to arbitrary
 * user-created agents.
 *
 * Hues are FIXED per preset (stable + semantic); unknown roles/names fall back
 * to a name-hash hue. Glyphs are lucide icons — job-title icons, never faces.
 *
 * Hard anti-patterns (do NOT reintroduce): humanoid faces/eyes, metallic
 * textures, hexagons, "bot"/robot iconography, the old /avatars/*.png files.
 */

import {
  BadgeDollarSign,
  BarChart2,
  BookOpen,
  Calculator,
  Headphones,
  Megaphone,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  UserSearch,
  Workflow,
  Wrench,
  ConciergeBell,
  type LucideIcon,
} from "lucide-react";

export type AgentVisual = { hue: number; Icon: LucideIcon };

/** Fixed visual identity per agent preset id (agentPresets.ts). */
const PRESET_VISUALS: Record<string, AgentVisual> = {
  assistant: { hue: 280, Icon: Sparkles }, // the PerkOS assistant identity
  pm: { hue: 280, Icon: Target }, // purple — leadership
  builder: { hue: 210, Icon: Wrench }, // steel blue — craft
  reviewer: { hue: 230, Icon: Search }, // navy — scrutiny
  qa: { hue: 200, Icon: Shield }, // blue — protection
  support: { hue: 160, Icon: Headphones }, // green — care
  researcher: { hue: 195, Icon: Search }, // teal — discovery
  analyst: { hue: 150, Icon: Calculator }, // sage — steady numbers
  knowledge: { hue: 260, Icon: BookOpen }, // violet — learning
  workflow: { hue: 185, Icon: Workflow }, // cyan — systems
  trader: { hue: 140, Icon: TrendingUp }, // emerald — markets
  ops: { hue: 185, Icon: Settings2 }, // cyan — operations
  concierge: { hue: 45, Icon: ConciergeBell }, // gold — hospitality
  sales: { hue: 25, Icon: BadgeDollarSign }, // amber — energy
  marketing: { hue: 340, Icon: Megaphone }, // brand pink
  security: { hue: 230, Icon: Shield }, // navy — authority
  recruiter: { hue: 45, Icon: UserSearch }, // gold — people
};

/** Role-keyword fallback for template roles that don't carry a presetId. */
const KEYWORD_VISUALS: Array<[RegExp, AgentVisual]> = [
  [/market|promo|social|brand|launch/i, PRESET_VISUALS.marketing!],
  [/research|recipe|listing|content|writer|copy|seo|course/i, PRESET_VISUALS.researcher!],
  [/support|patient|client|customer|communication|front desk|booking|reservation/i, PRESET_VISUALS.support!],
  [/sales|lead|follow/i, PRESET_VISUALS.sales!],
  [/book|account|financ|invoice|quote|report/i, PRESET_VISUALS.analyst!],
  [/manager|coordinator|director|broker|lead$|pm\b/i, PRESET_VISUALS.pm!],
  [/review|reputation/i, PRESET_VISUALS.support!],
  [/menu|kitchen|inventory|stock|schedul/i, PRESET_VISUALS.ops!],
];

/** Stable hue from an arbitrary name (same approach as the roster orbs). */
export function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** Resolve an agent's visual identity: presetId → role keywords → name hash. */
export function agentVisual(opts: {
  presetId?: string | null;
  role?: string | null;
  name?: string | null;
}): AgentVisual {
  if (opts.presetId && PRESET_VISUALS[opts.presetId]) {
    return PRESET_VISUALS[opts.presetId]!;
  }
  const label = opts.role || opts.name || "";
  for (const [re, v] of KEYWORD_VISUALS) {
    if (re.test(label)) return v;
  }
  return { hue: nameHue(label || "teammate"), Icon: Sparkles };
}

/** Up to two initials: first letters of the first two words. */
export function agentInitials(name: string): string {
  const words = name
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}
