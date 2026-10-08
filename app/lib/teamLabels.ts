/**
 * Short names for a project roster. Team launches name agents
 * "<Project>-<Role>", so every seat would repeat the project; drop the leading
 * words all teammates share and space the rest ("Northline-Market-Researcher"
 * → "Market Researcher"). A roster without a shared prefix keeps its names.
 */
export function teamShortLabels(names: readonly string[]): Map<string, string> {
  const unique = [...new Set(names.filter((name) => name.trim()))];
  const labels = new Map(unique.map((name) => [name, name]));
  if (unique.length < 2) return labels;
  const words = unique.map((name) => name.split(/[-_]+/).filter(Boolean));
  let shared = 0;
  while (
    words.every((parts) => parts.length > shared + 1) &&
    words.every((parts) => parts[shared]!.toLowerCase() === words[0]![shared]!.toLowerCase())
  ) {
    shared += 1;
  }
  if (shared === 0) return labels;
  const short = unique.map((name, i) => [name, words[i]!.slice(shared).join(" ")] as const);
  const counts = new Map<string, number>();
  short.forEach(([, label]) => counts.set(label.toLowerCase(), (counts.get(label.toLowerCase()) ?? 0) + 1));
  short.forEach(([name, label]) => {
    if (counts.get(label.toLowerCase()) === 1) labels.set(name, label);
  });
  return labels;
}
