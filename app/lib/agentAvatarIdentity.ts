export const AGENT_AVATAR_IDENTITY_VERSION = 3 as const;
export const AGENT_AVATAR_PALETTES = ["coral", "cyan", "blue", "violet", "green", "gold"] as const;
export const AGENT_AVATAR_EXPRESSIONS = ["focused", "friendly", "curious", "confident"] as const;

export type AgentAvatarRole = "lead" | "builder" | "reviewer" | "qa" | "support" | "research" | "analysis" | "knowledge" | "workflow" | "ops" | "sales" | "marketing" | "security" | "generalist";
export type AgentAvatarArchetype = { id: number; slug: string; label: string; assetPath: string; baseHue: number; roles: readonly AgentAvatarRole[] };
const entry = (id: number, slug: string, label: string, baseHue: number, roles: readonly AgentAvatarRole[]): AgentAvatarArchetype => ({ id, slug, label, baseHue, roles, assetPath: `/agents/avatar-v3/${String(id).padStart(2, "0")}-${slug}.webp` });

/** Append-only catalog: released ids and files must never be reordered. */
export const AGENT_AVATAR_ARCHETYPES: readonly AgentAvatarArchetype[] = [
  entry(1,"project-lead","Project Lead",355,["lead"]), entry(2,"researcher","Researcher",188,["research"]),
  entry(3,"builder","Builder",210,["builder"]), entry(4,"qa-guardian","QA Guardian",116,["qa"]),
  entry(5,"data-analyst","Data Analyst",286,["analysis"]), entry(6,"knowledge-curator","Knowledge Curator",100,["knowledge"]),
  entry(7,"workflow-orchestrator","Workflow Orchestrator",288,["workflow","lead"]), entry(8,"operations-specialist","Operations Specialist",184,["ops"]),
  entry(9,"marketing-creative","Marketing Creative",330,["marketing"]), entry(10,"security-guardian","Security Guardian",42,["security"]),
  entry(11,"sales-navigator","Sales Navigator",38,["sales"]), entry(12,"support-concierge","Support Concierge",28,["support"]),
  entry(13,"finance-steward","Finance Steward",126,["analysis","ops"]), entry(14,"compliance-auditor","Compliance Auditor",220,["reviewer","security"]),
  entry(15,"content-producer","Content Producer",8,["marketing","builder"]), entry(16,"social-manager","Social Manager",188,["marketing","support"]),
  entry(17,"ecommerce-merchandiser","Ecommerce Merchandiser",332,["marketing","sales"]), entry(18,"inventory-planner","Inventory Planner",176,["ops","analysis"]),
  entry(19,"customer-success-guide","Customer Success Guide",202,["support","sales"]), entry(20,"legal-researcher","Legal Researcher",278,["research","reviewer"]),
  entry(21,"recruiter","Recruiter",8,["support","lead"]), entry(22,"product-designer","Product Designer",184,["builder","marketing"]),
  entry(23,"copywriter","Copywriter",38,["marketing","builder"]), entry(24,"video-producer","Video Producer",320,["marketing","builder"]),
  entry(25,"payment-coordinator","Payment Coordinator",104,["ops","analysis"]), entry(26,"risk-analyst","Risk Analyst",358,["analysis","security"]),
  entry(27,"event-coordinator","Event Coordinator",42,["workflow","support"]), entry(28,"localization-specialist","Localization Specialist",248,["support","research"]),
  entry(29,"data-clerk","Data Clerk",208,["knowledge","ops"]), entry(30,"executive-assistant","Executive Assistant",326,["lead","workflow"]),
] as const;

export type AgentAvatarIdentity = {
  version: typeof AGENT_AVATAR_IDENTITY_VERSION; generatorVersion: 3; recipeVersion: 2; seed: string; visualSignature: string;
  roleKey: AgentAvatarRole; archetypeId: number; archetypeSlug: string; assetPath: string;
  palette: (typeof AGENT_AVATAR_PALETTES)[number]; paletteIndex: number;
  expression: (typeof AGENT_AVATAR_EXPRESSIONS)[number]; expressionIndex: number;
  baseHue: number; accentHue: number; secondaryHue: number;
};

export function hashAvatarSeed(value: string): number { let hash=0x811c9dc5; for(let i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,0x01000193)} return hash>>>0 }

export function inferAgentAvatarRole(value: string): AgentAvatarRole {
  const label=value.toLowerCase();
  if(/lead|manager|coordinator|director|executive|\bpm\b/.test(label))return "lead";
  if(/build|engineer|develop|implement|code|design|producer|writer/.test(label))return "builder";
  if(/review|editor|audit|legal/.test(label))return "reviewer";
  if(/\bqa\b|quality|test|verif/.test(label))return "qa";
  if(/support|customer|concierge|care|localiz|recruit/.test(label))return "support";
  if(/research|discover|scout|search/.test(label))return "research";
  if(/analy|data|finance|account|report|risk/.test(label))return "analysis";
  if(/knowledge|learn|document|librar|clerk/.test(label))return "knowledge";
  if(/workflow|orchestrat|automation|event/.test(label))return "workflow";
  if(/operation|\bops\b|infra|inventory|payment/.test(label))return "ops";
  if(/sales|lead gen|business development|merchand/.test(label))return "sales";
  if(/market|content|social|brand|growth|copy|video/.test(label))return "marketing";
  if(/security|compliance|protect/.test(label))return "security";
  return "generalist";
}

function buildIdentity(seed:string, role?:string|null, salt=0):AgentAvatarIdentity {
  const normalized=seed.trim(); if(!normalized)throw new Error("Agent avatar seed is required");
  const roleKey=inferAgentAvatarRole(role||normalized); const hash=hashAvatarSeed(salt?`${normalized}:variant:${salt}`:normalized);
  const candidates=roleKey==="generalist"?AGENT_AVATAR_ARCHETYPES:AGENT_AVATAR_ARCHETYPES.filter(x=>x.roles.includes(roleKey));
  const archetype=candidates[hash%candidates.length]!; const paletteIndex=(hash>>>9)%AGENT_AVATAR_PALETTES.length; const expressionIndex=(hash>>>17)%AGENT_AVATAR_EXPRESSIONS.length;
  const accentHue=[356,188,214,282,112,42][paletteIndex]!;
  return {version:3,generatorVersion:3,recipeVersion:2,seed:normalized,visualSignature:[archetype.id,paletteIndex,expressionIndex].join(":"),roleKey,archetypeId:archetype.id,archetypeSlug:archetype.slug,assetPath:archetype.assetPath,palette:AGENT_AVATAR_PALETTES[paletteIndex]!,paletteIndex,expression:AGENT_AVATAR_EXPRESSIONS[expressionIndex]!,expressionIndex,baseHue:archetype.baseHue,accentHue,secondaryHue:(accentHue+38)%360};
}

export function deriveAgentAvatarIdentity(seed:string,role?:string|null):AgentAvatarIdentity{return buildIdentity(seed,role)}
export function allocateAgentAvatarIdentity(input:{seed:string;role?:string|null;existing:readonly Pick<AgentAvatarIdentity,"visualSignature">[]}):AgentAvatarIdentity{
  const occupied=new Set(input.existing.map(x=>x.visualSignature)); for(let salt=0;salt<720;salt+=1){const candidate=buildIdentity(input.seed,input.role,salt);if(!occupied.has(candidate.visualSignature))return{...candidate,seed:input.seed}} return{...buildIdentity(input.seed,input.role,720),seed:input.seed};
}

/**
 * One look per teammate inside a project: each agent keeps its usual identity
 * unless a teammate already took that archetype or color, then the next free
 * variant is used. Order matters, so pass the roster in a stable order.
 */
export function allocateTeamAvatarIdentities(names: readonly string[]): Map<string, AgentAvatarIdentity> {
  const team = new Map<string, AgentAvatarIdentity>();
  const archetypes = new Set<number>();
  const palettes = new Set<number>();
  const signatures = new Set<string>();
  const firstVariant = (seed: string, accept: (candidate: AgentAvatarIdentity) => boolean) => {
    for (let salt = 0; salt < 720; salt += 1) {
      const candidate = buildIdentity(seed, seed, salt);
      if (accept(candidate)) return candidate;
    }
    return null;
  };
  for (const name of names) {
    const seed = name.trim();
    if (!seed || team.has(name)) continue;
    const paletteFree = (candidate: AgentAvatarIdentity) =>
      palettes.size >= AGENT_AVATAR_PALETTES.length || !palettes.has(candidate.paletteIndex);
    const chosen =
      firstVariant(seed, (c) => !archetypes.has(c.archetypeId) && paletteFree(c)) ??
      firstVariant(seed, (c) => !signatures.has(c.visualSignature)) ??
      buildIdentity(seed, seed);
    archetypes.add(chosen.archetypeId);
    palettes.add(chosen.paletteIndex);
    signatures.add(chosen.visualSignature);
    team.set(name, { ...chosen, seed });
  }
  return team;
}
