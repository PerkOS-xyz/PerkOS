/**
 * A one-line, plain-text peek at a Markdown result for board cards: drops
 * headings, quotes, list bullets, table rules and emphasis, but keeps the
 * hyphens inside words ("two-line", "7-day").
 */
export function plainPreview(markdown: string, max = 120): string {
  return markdown
    .replace(/^[\s|:-]*-{3,}[\s|:-]*$/gm, "")
    .replace(/^\s*(?:#{1,6}|>+|[-*+]|\d+[.)]|\|)\s+/gm, "")
    .replace(/[*_`|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
