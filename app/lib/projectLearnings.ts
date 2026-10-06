import type { Task } from "./perkosApi";

export type Source = { label: string; url: string };

export type Learning = {
  taskId?: string;
  task: string;
  agent: string;
  /** The deliverable's headline or first key points, as plain text. */
  points: string[];
  /** Links the teammate cited, one per address. */
  sources: Source[];
};

const MAX_POINTS = 3;
const MAX_POINT_CHARS = 180;
const SOURCE_HEADING = /^#{1,6}\s*(sources?|references?|citations?|links)\b/i;
const MD_LINK = /\[([^\]]{1,120})\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL = /(?<!\]\()\bhttps?:\/\/[^\s)<>\]]+/g;

function plain(text: string): string {
  return text
    .replace(MD_LINK, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text: string): string {
  return text.length > MAX_POINT_CHARS ? `${text.slice(0, MAX_POINT_CHARS - 1).trimEnd()}…` : text;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Every link in a result, labelled by its text or its site. */
export function citedSources(markdown: string): Source[] {
  const seen = new Map<string, Source>();
  for (const match of markdown.matchAll(MD_LINK)) {
    const url = match[2]!.replace(/[.,;]+$/, "");
    if (!seen.has(url)) seen.set(url, { label: plain(match[1]!) || hostLabel(url), url });
  }
  for (const match of markdown.matchAll(BARE_URL)) {
    const url = match[0].replace(/[.,;]+$/, "");
    if (!seen.has(url)) seen.set(url, { label: hostLabel(url), url });
  }
  return [...seen.values()];
}

/**
 * The deliverable's key points: a "Headline:" line when there is one, then the
 * first bullet points outside a Sources section, else its first sentences.
 */
export function keyPoints(markdown: string): string[] {
  const points: string[] = [];
  let inSources = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) {
      inSources = SOURCE_HEADING.test(line);
      continue;
    }
    if (inSources) continue;
    const headline = line.match(/^\**\s*headline\s*:?\**\s*:?\s*(.+)$/i);
    if (headline) {
      points.unshift(clip(plain(headline[1]!)));
      continue;
    }
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (bullet && points.length < MAX_POINTS + 1) {
      const text = plain(bullet[1]!);
      if (text.length > 12) points.push(clip(text));
    }
  }
  if (points.length === 0) {
    const firstSentences = plain(markdown.replace(/^#{1,6}\s.*$/gm, "")).match(/[^.!?]+[.!?]/g) ?? [];
    for (const sentence of firstSentences.slice(0, 2)) points.push(clip(sentence.trim()));
  }
  return points.slice(0, MAX_POINTS);
}

/** What the team learned: one entry per delivered result, newest work last. */
export function projectLearnings(tasks: Task[]): Learning[] {
  return tasks
    .filter((task) => task.status === "Done" && typeof task.result === "string" && task.result.trim().length > 0)
    .map((task) => ({
      taskId: task.id,
      task: task.name,
      agent: task.agent || "",
      points: keyPoints(task.result as string),
      sources: citedSources(task.result as string),
    }));
}
