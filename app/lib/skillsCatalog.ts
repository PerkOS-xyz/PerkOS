/**
 * Open-source skills catalog.
 *
 * Each entry is a *skill pack* — a small set of `SKILL.md` files published in
 * a public GitHub repo. Both PerkOS runtimes (OpenClaw + Hermes) load skills
 * from a `skills/<name>/SKILL.md` directory and inject them into the model's
 * system prompt, so the same markdown works on either runtime.
 *
 * The wizard shows these packs as cards in the plugin/skills step. When an
 * agent launches, the selected pack ids are sent to the API, the server
 * resolves them to a list of `{ name, url }` (raw SKILL.md URLs), and the
 * container entrypoint curls each file into the agent's skills dir at boot.
 *
 * SECURITY MODEL (a SKILL.md is injected into the system prompt, so it's a
 * prompt-injection vector):
 *  - **Curated** packs are pinned to a specific commit SHA and live on a
 *    known host — reproducible, shown without a warning.
 *  - **Community** packs (a repo the user pastes) are only accepted if the
 *    resolved raw URL is on an allow-listed domain; they render with a
 *    "not verified — review it" warning and a link to the source.
 *  - The server re-validates every resolved URL against ALLOWED_SKILL_DOMAINS
 *    and the entrypoint hard-codes the same allow-list, so a tampered payload
 *    still cannot fetch from an arbitrary host.
 *  - `name` is sanitized to [a-z0-9-]; the file is always written to the fixed
 *    path `<skillsdir>/<name>/SKILL.md`.
 *
 * Keep the machine-readable bits (source, ALLOWED_SKILL_DOMAINS,
 * resolveSkillFiles, parseUserRepo) in sync with the server-side copy — the
 * server must not trust client-supplied raw URLs.
 */

/** Which runtimes a pack is known to work on. Markdown skills are "both". */
export type SkillRuntimeCompat = "both" | "hermes" | "openclaw";

export type SkillTrust = "curated" | "community";

export type SkillCategory =
  | "engineering"
  | "web3"
  | "sales"
  | "marketing"
  | "support"
  | "data"
  | "research"
  | "ops"
  | "finance"
  | "legal"
  | "hr"
  | "product"
  | "design"
  | "knowledge";

/** Machine-readable instructions for resolving a pack to raw SKILL.md URLs. */
export type SkillSource = {
  /** GitHub repo in `owner/name` form. */
  repo: string;
  /** Commit SHA (curated) or branch (community fallback). Pinned = reproducible. */
  ref: string;
  /**
   * Path inside the repo that contains the skill dirs.
   *  - ethskills topic style: subPath is "" and each `skills[]` entry IS a
   *    top-level `<topic>/SKILL.md`.
   *  - knowledge-work role style: subPath is "<role>/skills" and each
   *    `skills[]` entry is `<name>/SKILL.md` under it.
   */
  subPath: string;
  /** Skill dir names to pull. */
  skills: string[];
};

export type SkillPack = {
  id: string;
  name: string;
  description: string;
  author: string;
  /** Human link shown on the card so the user can inspect the source. */
  githubUrl: string;
  category: SkillCategory;
  runtimeCompat: SkillRuntimeCompat;
  trust: SkillTrust;
  source: SkillSource;
};

/** A single resolved skill file to fetch at boot. */
export type SkillFileRef = {
  /** Sanitized dir name written under the skills dir. */
  name: string;
  /** Raw HTTPS URL to the SKILL.md (host must be allow-listed). */
  url: string;
};

/**
 * Hosts the entrypoint is allowed to curl skill files from. Mirrored as a
 * hard-coded list in the container entrypoints — keep them in sync.
 */
export const ALLOWED_SKILL_DOMAINS = [
  "raw.githubusercontent.com",
] as const;

// Pinned commit SHAs (reproducible curated content). Bump deliberately.
const ETHSKILLS_REPO = "austintgriffith/ethskills";
const ETHSKILLS_SHA = "191dcc1ead0182aab16d4c742bee8b15f2d0d8d7";
const KWP_REPO = "anthropics/knowledge-work-plugins";
const KWP_SHA = "250bdfd752d7f006ef93cc1aa2c58ec998ead871";

const ethGithub = `https://github.com/${ETHSKILLS_REPO}/tree/${ETHSKILLS_SHA}`;
const kwpGithub = (role: string) =>
  `https://github.com/${KWP_REPO}/tree/${KWP_SHA}/${role}`;

/** ethskills topic pack (topics are top-level `<topic>/SKILL.md`). */
function ethPack(
  id: string,
  name: string,
  description: string,
  category: SkillCategory,
  topics: string[],
): SkillPack {
  return {
    id,
    name,
    description,
    author: "Austin Griffith",
    githubUrl: ethGithub,
    category,
    runtimeCompat: "both",
    trust: "curated",
    source: { repo: ETHSKILLS_REPO, ref: ETHSKILLS_SHA, subPath: "", skills: topics },
  };
}

/** knowledge-work role pack (`<role>/skills/<name>/SKILL.md`). */
function kwPack(
  id: string,
  role: string,
  name: string,
  description: string,
  category: SkillCategory,
  skills: string[],
): SkillPack {
  return {
    id,
    name,
    description,
    author: "Anthropic",
    githubUrl: kwpGithub(role),
    category,
    runtimeCompat: "both",
    trust: "curated",
    source: {
      repo: KWP_REPO,
      ref: KWP_SHA,
      subPath: `${role}/skills`,
      skills,
    },
  };
}

export const SKILLS_CATALOG: SkillPack[] = [
  // --- Web3 / Ethereum (ethskills) ----------------------------------------
  ethPack(
    "ethskills-build",
    "Ethereum: Build",
    "Ship a dApp the right way — contract scoping, standards (ERC-20/721/8004), verified addresses, and the current tool landscape. Corrects stale LLM assumptions (gas is cheap now, USDC has 6 decimals, 'onchain' not 'on-chain').",
    "web3",
    ["ship", "concepts", "standards", "building-blocks", "addresses", "tools"],
  ),
  ethPack(
    "ethskills-security",
    "Ethereum: Security & Audit",
    "Solidity security patterns, a systematic audit workflow, and Foundry testing. Reentrancy, oracle manipulation, vault inflation, proxy safety, pre-deploy checklist.",
    "web3",
    ["security", "audit", "testing"],
  ),
  ethPack(
    "ethskills-frontend",
    "Ethereum: Frontend",
    "Scaffold-ETH 2 frontend UX and the build-to-production pipeline — button/approval flows, Address components, fork mode, IPFS/Vercel deploy.",
    "web3",
    ["frontend-ux", "frontend-playbook", "orchestration"],
  ),

  // --- Knowledge-work role packs (Anthropic) ------------------------------
  kwPack(
    "kw-engineering",
    "engineering",
    "Engineering",
    "Code review, debugging, system design, incident response, and a testing strategy — the everyday engineering workflows.",
    "engineering",
    ["code-review", "debug", "system-design", "incident-response", "testing-strategy"],
  ),
  kwPack(
    "kw-sales",
    "sales",
    "Sales",
    "Prospect research, call prep, personalized outreach, pipeline review, and weighted forecasting.",
    "sales",
    ["account-research", "call-prep", "draft-outreach", "pipeline-review", "forecast"],
  ),
  kwPack(
    "kw-marketing",
    "marketing",
    "Distribution",
    "Campaign planning, content creation, brand-voice review, and SEO audits.",
    "marketing",
    ["campaign-plan", "content-creation", "brand-review", "seo-audit"],
  ),
  kwPack(
    "kw-support",
    "customer-support",
    "Customer Support",
    "Ticket triage, drafting responses, packaging escalations, and turning resolved issues into KB articles.",
    "support",
    ["ticket-triage", "draft-response", "customer-escalation", "kb-article"],
  ),
  kwPack(
    "kw-data",
    "data",
    "Data & Analytics",
    "Write and explore SQL, run statistical analysis, build dashboards, and validate results before sharing.",
    "data",
    ["write-query", "explore-data", "statistical-analysis", "build-dashboard", "validate-data"],
  ),
  kwPack(
    "kw-finance",
    "finance",
    "Finance & Accounting",
    "Journal entries, reconciliation, financial statements, variance analysis, and month-end close.",
    "finance",
    ["reconciliation", "journal-entry", "financial-statements", "variance-analysis", "close-management"],
  ),
  kwPack(
    "kw-legal",
    "legal",
    "Legal",
    "Contract review, NDA triage, compliance checks, and legal-risk assessment for in-house teams.",
    "legal",
    ["review-contract", "triage-nda", "compliance-check", "legal-risk-assessment"],
  ),
  kwPack(
    "kw-hr",
    "human-resources",
    "People / HR",
    "Interview prep, recruiting pipeline, onboarding, and performance reviews.",
    "hr",
    ["interview-prep", "recruiting-pipeline", "onboarding", "performance-review"],
  ),
  kwPack(
    "kw-operations",
    "operations",
    "Operations",
    "Runbooks, process optimization, risk assessment, and status reporting.",
    "ops",
    ["runbook", "process-optimization", "risk-assessment", "status-report"],
  ),
  kwPack(
    "kw-product",
    "product-management",
    "Product Management",
    "Write specs, update roadmaps, synthesize user research, and run sprint planning.",
    "product",
    ["write-spec", "roadmap-update", "synthesize-research", "sprint-planning"],
  ),
  kwPack(
    "kw-design",
    "design",
    "Design",
    "Design critique, design systems, user research, and accessibility review.",
    "design",
    ["design-critique", "design-system", "user-research", "accessibility-review"],
  ),
  kwPack(
    "kw-knowledge",
    "enterprise-search",
    "Knowledge & Search",
    "Search across tools, synthesize knowledge, and produce digests — for research and knowledge-base roles.",
    "knowledge",
    ["search", "knowledge-synthesis", "digest", "search-strategy"],
  ),
  kwPack(
    "kw-productivity",
    "productivity",
    "Productivity",
    "Task and memory management for assistant-style agents that keep your work organized.",
    "knowledge",
    ["task-management", "memory-management"],
  ),
];

const PACKS_BY_ID = new Map(SKILLS_CATALOG.map((p) => [p.id, p]));

export function findSkillPack(id: string): SkillPack | undefined {
  return PACKS_BY_ID.get(id);
}

/** Sanitize a skill dir name to a safe, fixed-shape slug. */
export function sanitizeSkillName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Build the raw SKILL.md URL for one skill within a pack's source. */
function skillUrl(src: SkillSource, skill: string): string {
  const path = src.subPath
    ? `${src.subPath}/${skill}/SKILL.md`
    : `${skill}/SKILL.md`;
  return `https://raw.githubusercontent.com/${src.repo}/${src.ref}/${path}`;
}

/**
 * Resolve a list of pack ids to the concrete `{ name, url }` files to fetch.
 * Names are namespaced by pack id (`<packid>-<skill>`) to avoid collisions
 * across packs, then sanitized. Deduplicated by url. Unknown ids are skipped.
 */
export function resolveSkillFiles(packIds: string[]): SkillFileRef[] {
  const out: SkillFileRef[] = [];
  const seen = new Set<string>();
  for (const id of packIds) {
    const pack = PACKS_BY_ID.get(id);
    if (!pack) continue;
    for (const skill of pack.source.skills) {
      const url = skillUrl(pack.source, skill);
      if (seen.has(url)) continue;
      const name = sanitizeSkillName(`${pack.id}-${skill}`);
      if (!name) continue; // never resolve to `<skillsdir>//SKILL.md`
      seen.add(url);
      out.push({ name, url });
    }
  }
  return out;
}

/** True when a raw URL's host is on the install allow-list. */
export function isAllowedSkillUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (ALLOWED_SKILL_DOMAINS as readonly string[]).includes(u.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Parse a user-pasted GitHub reference into a one-skill "community" pack.
 * Accepts:
 *  - a raw URL: https://raw.githubusercontent.com/owner/repo/<ref>/path/SKILL.md
 *  - a blob URL: https://github.com/owner/repo/blob/<ref>/path/SKILL.md
 * The resolved raw URL host must be on ALLOWED_SKILL_DOMAINS, and the path
 * must end in SKILL.md. Returns null if it can't be safely normalized.
 */
export function parseUserRepo(input: string): SkillPack | null {
  const raw = input.trim();
  if (!raw) return null;

  let rawUrl: string | null = null;
  try {
    const u = new URL(raw);
    if (u.hostname === "raw.githubusercontent.com") {
      rawUrl = u.toString();
    } else if (u.hostname === "github.com") {
      // github.com/owner/repo/blob/<ref>/<path> -> raw
      const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
      if (m) {
        rawUrl = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
      }
    }
  } catch {
    return null;
  }

  if (!rawUrl) return null;
  if (!/SKILL\.md$/i.test(new URL(rawUrl).pathname)) return null;
  if (!isAllowedSkillUrl(rawUrl)) return null;

  const u = new URL(rawUrl);
  const parts = u.pathname.split("/").filter(Boolean);
  // raw: owner/repo/ref/...path.../SKILL.md
  const owner = parts[0] ?? "user";
  const repo = parts[1] ?? "skill";
  const ref = parts[2] ?? "main";
  const skillDir = parts[parts.length - 2] ?? "skill";
  const id = sanitizeSkillName(`community-${owner}-${repo}-${skillDir}`);

  return {
    id,
    name: `${repo}/${skillDir}`,
    description: `Community skill from ${owner}/${repo}. Not verified by PerkOS — review the source before enabling.`,
    author: owner,
    githubUrl: `https://github.com/${owner}/${repo}`,
    category: "knowledge",
    runtimeCompat: "both",
    trust: "community",
    source: { repo: `${owner}/${repo}`, ref, subPath: "", skills: [skillDir] },
  };
}

/** Short human label for a runtime-compat badge. */
export function runtimeCompatLabel(c: SkillRuntimeCompat): string {
  return c === "both" ? "Hermes + OpenClaw" : c === "hermes" ? "Hermes" : "OpenClaw";
}
