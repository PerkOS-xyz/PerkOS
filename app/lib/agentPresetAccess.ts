"use client";

import { authedFetch } from "./apiClient";
import { AGENT_PRESETS, type AgentPreset, type SoulFields } from "./agentPresets";

/** Per-preset admin overlay decision for the current viewer. */
type ViewerPreset = {
  id: string;
  allowed: boolean;
  name: string | null;
  blurb: string | null;
  recommendedPlugins: string[] | null;
  recommendedSkills: string[] | null;
  soul: SoulFields | null;
};

/**
 * Resolve which starter templates the current viewer should see in the
 * wizard, with admin property overrides merged in.
 *
 * The admin overlay (collection `/agent_presets`) lets a super-admin gate a
 * template to Public / Beta (testers) / Private (specific wallets) / Hidden,
 * and override its name / blurb / recommended plugins & skills. A template
 * with no overlay defaults to Public + unchanged. The viewer's wallet is
 * resolved server-side from the Firebase token (best-effort) so testers see
 * their beta/private templates.
 *
 * Fails OPEN to the unmodified public catalogue on any error: the template
 * CONTENT already ships in the client bundle, so visibility is a curation /
 * UX choice, not a confidentiality boundary — a blank wizard would be a worse
 * failure than briefly showing a curated-away card.
 */
export async function fetchVisiblePresets(): Promise<AgentPreset[]> {
  try {
    const res = await authedFetch("/api/presets");
    if (!res.ok) return AGENT_PRESETS;
    const { presets } = (await res.json()) as { presets: ViewerPreset[] };
    const byId = new Map(presets.map((p) => [p.id, p]));
    return AGENT_PRESETS.filter((p) => {
      const o = byId.get(p.id);
      // No overlay → public default (show). Overlay → respect `allowed`.
      return !o || o.allowed;
    }).map((p) => {
      const o = byId.get(p.id);
      if (!o) return p;
      return {
        ...p,
        name: o.name ?? p.name,
        blurb: o.blurb ?? p.blurb,
        recommendedPlugins: o.recommendedPlugins ?? p.recommendedPlugins,
        recommendedSkills: o.recommendedSkills ?? p.recommendedSkills,
        // Soul override replaces the whole persona; the wizard renders SOUL.md
        // and shows the persona detail entirely off preset.soul, so overriding
        // it here flows into both the preview and the launched agent.
        soul: o.soul ?? p.soul,
      };
    });
  } catch {
    return AGENT_PRESETS;
  }
}
