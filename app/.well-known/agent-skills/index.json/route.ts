/**
 * GET /.well-known/agent-skills/index.json — Agent Skills Discovery index.
 *
 * Lists the skills an agent can fetch to learn how to work with PerkOS. Each
 * digest is computed from the text actually served, so a caller can verify it
 * received what this index promised, and the index cannot drift from the
 * skills the way a pinned hash would.
 */
import { SKILLS, skillDigest, skillUrl } from "../../../lib/agentSkills";

export const dynamic = "force-static";

export function GET(): Response {
  const body = {
    $schema: "https://agentskills.io/schemas/v0.2.0/index.json",
    skills: SKILLS.map((skill) => ({
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: skillUrl(skill),
      sha256: skillDigest(skill),
    })),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
