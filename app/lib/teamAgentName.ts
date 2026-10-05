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

/**
 * Names for a whole team, sharing ONE project prefix so teammates read as a
 * set ("Harbor-Tea-Product-Copywriter", "Harbor-Tea-Customer-Support"), not
 * one cut per role ("Harbor-Tea-Sh-…", "Harbor-Tea-S-…"). The prefix is cut at
 * a word boundary to fit the longest role, falls back to the project's
 * initials, and is dropped only when not even those fit.
 */
export function teamAgentNames(projectSlug: string, roleSlugs: string[]): string[] {
  const roles = roleSlugs.map((r) => r.slice(0, AGENT_NAME_MAX - 2).replace(/-+$/g, ""));
  const longest = Math.max(0, ...roles.map((r) => r.length));
  const room = AGENT_NAME_MAX - longest - 1;
  const words = projectSlug.split("-").filter(Boolean);
  let prefix = "";
  for (const word of words) {
    const next = prefix ? `${prefix}-${word}` : word;
    if (next.length > room) break;
    prefix = next;
  }
  if (!prefix && words.length > 0) {
    const initials = words.map((w) => w[0]).join("");
    if (initials.length >= 2 && initials.length <= room) prefix = initials.toUpperCase();
  }
  return roles.map((role) => (prefix ? `${prefix}-${role}` : role));
}
