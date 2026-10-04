/** Agent names are 2-32 letters, digits, `_` or `-` (the API's rule). */
export const AGENT_NAME_MAX = 32;

/**
 * `<project>-<role>` for an agent launched from a team template, shortening the
 * project part first so the name always fits: "Seoul Bean Roasters" with
 * "Social Media Manager" would otherwise be 40 characters and the API rejects it.
 */
export function teamAgentName(projectSlug: string, roleSlug: string): string {
  const role = roleSlug.slice(0, AGENT_NAME_MAX - 2).replace(/-+$/g, "");
  const room = AGENT_NAME_MAX - role.length - 1;
  const project = room > 0 ? projectSlug.slice(0, room).replace(/-+$/g, "") : "";
  return project ? `${project}-${role}` : role;
}
