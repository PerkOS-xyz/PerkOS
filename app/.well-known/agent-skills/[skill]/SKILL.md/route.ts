/**
 * GET /.well-known/agent-skills/{skill}/SKILL.md
 *
 * Serves one skill as markdown. The digest published in the index is taken
 * from this same string, so what a caller verifies is what it read.
 */
import { SKILLS, skillByName } from "../../../../lib/agentSkills";

export const dynamic = "force-static";

export function generateStaticParams(): Array<{ skill: string }> {
  return SKILLS.map((skill) => ({ skill: skill.name }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ skill: string }> },
): Promise<Response> {
  const { skill: name } = await context.params;
  const skill = skillByName(name);

  if (!skill) {
    return new Response(`Unknown skill: ${name}\n`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(skill.body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });
}
