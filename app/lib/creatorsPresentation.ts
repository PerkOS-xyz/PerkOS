/** Visible labels only. Persisted IDs, mode and request payloads stay stable. */
export function creatorDisplayText(value: string): string {
  return value.replace(/Artizen Creator Companion/gi, "Creators Companion")
    .replace(/Artizen Creator Update/gi, "Creators Update")
    .replace(/\bArtizen\b/gi, "Creators");
}

export function creatorAgentLabel(value?: string | null): string {
  return value?.trim() ? creatorDisplayText(value) : "Creators Companion";
}

export function creatorTemplatePathId(id: string): string {
  return id === "artizen-creator-update" ? "creators-update" : id;
}

export function creatorTemplateStorageId(id: string): string {
  return id === "creators-update" ? "artizen-creator-update" : id;
}
