export type ExistingTeamMember = {
  name: string;
  isPM: boolean;
};

/** Preserve registered agent identities while marking exactly one coordinator. */
export function buildExistingTeamRoster(
  agentNames: string[],
  pmAgent: string,
): ExistingTeamMember[] {
  const seen = new Set<string>();
  return agentNames.flatMap((name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return [];
    seen.add(key);
    return [{ name, isPM: name === pmAgent }];
  });
}
