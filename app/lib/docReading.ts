/**
 * Reading model for a project doc: pairs each plan task with its board task
 * and delivered result so the doc reads top to bottom (brief, done-when,
 * owner, result) instead of listing results apart at the end.
 */

import type { PlanBlock, Task } from "./perkosApi";

/** Owner the API stamps on the result notes it appends to a plan. */
export const RESULT_OWNER = "service:perkos-api";

export type ResultParts = { title: string; body: string };

/** Split a result note ("## Task name\n\nbody") into its heading and body. */
export function splitResult(text: string, fallback = "Completed task result"): ResultParts {
  const lines = text.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim().length > 0);
  if (headingIndex < 0) return { title: fallback, body: text };
  return {
    title: lines[headingIndex]!.replace(/^#{1,6}\s*/, "").trim() || fallback,
    body: lines.filter((_line, index) => index !== headingIndex).join("\n").trim(),
  };
}

/** Board task a result note belongs to (older notes only carry it in the id). */
function resultTaskId(block: PlanBlock): string | null {
  if (block.sourceTaskId) return block.sourceTaskId;
  return block.id?.startsWith("task-result-") ? block.id.slice("task-result-".length) : null;
}

export type PlanTaskView = {
  block: PlanBlock;
  number: number;
  /** The board task once the plan is approved. */
  task?: Task;
  /** Delivered text: the live board result, else the consolidated note. */
  result?: string;
  /** Who does it: the board assignee, else the lead's suggestion. */
  agent?: string | null;
};

export type DocItem =
  | { kind: "group"; block: PlanBlock }
  | { kind: "task"; view: PlanTaskView }
  | { kind: "note"; block: PlanBlock }
  | { kind: "result"; block: PlanBlock; parts: ResultParts };

export type DocReading = {
  items: DocItem[];
  taskCount: number;
  /** Plan tasks already on the board. */
  onBoard: number;
  /** Board tasks in progress or in review. */
  active: number;
  delivered: number;
};

export function readDoc(blocks: PlanBlock[], tasks: Task[]): DocReading {
  const tasksById = new Map(tasks.filter((t) => t.id).map((t) => [t.id as string, t]));
  const resultsByTask = new Map<string, PlanBlock>();
  for (const block of blocks) {
    if (block.type !== "note" || block.owner !== RESULT_OWNER) continue;
    const taskId = resultTaskId(block);
    if (taskId) resultsByTask.set(taskId, block);
  }
  const planTaskIds = new Set(
    blocks.filter((b) => b.type === "planTask" && b.materializedTaskId).map((b) => b.materializedTaskId as string),
  );

  const reading: DocReading = { items: [], taskCount: 0, onBoard: 0, active: 0, delivered: 0 };
  for (const block of blocks) {
    if (block.type === "planGroup") {
      reading.items.push({ kind: "group", block });
    } else if (block.type === "planTask") {
      reading.taskCount++;
      const taskId = block.materializedTaskId ?? null;
      const task = taskId ? tasksById.get(taskId) : undefined;
      const note = taskId ? resultsByTask.get(taskId) : undefined;
      const result = task?.result?.trim() || (note ? splitResult(note.text ?? "").body : "") || undefined;
      if (taskId) reading.onBoard++;
      if (task?.status === "Done") reading.delivered++;
      else if (task?.status === "In progress" || task?.status === "Review") reading.active++;
      reading.items.push({
        kind: "task",
        view: { block, number: reading.taskCount, task, result, agent: task?.agent || block.suggestedAgent },
      });
    } else if (block.owner === RESULT_OWNER) {
      const taskId = resultTaskId(block);
      // Shown under its plan task; only orphan results stand alone.
      if (taskId && planTaskIds.has(taskId)) continue;
      reading.items.push({ kind: "result", block, parts: splitResult(block.text ?? "") });
    } else {
      reading.items.push({ kind: "note", block });
    }
  }
  return reading;
}

export type DocMarkdownLabels = { doneWhen: string; assignedTo: string; result: string };

/** The whole doc as one Markdown file, for copy, download and full screen. */
export function docToMarkdown(title: string, items: DocItem[], labels: DocMarkdownLabels): string {
  const parts: string[] = [`# ${title}`];
  for (const item of items) {
    if (item.kind === "group") {
      parts.push(`## ${item.block.title ?? ""}`.trim());
    } else if (item.kind === "task") {
      const { block, number, result, agent } = item.view;
      parts.push(`### ${number}. ${block.title ?? ""}`.trim());
      if (block.desc?.trim()) parts.push(block.desc.trim());
      if (block.acceptance?.trim()) parts.push(`**${labels.doneWhen}:** ${block.acceptance.trim()}`);
      if (agent) parts.push(`**${labels.assignedTo}:** ${agent}`);
      if (result) parts.push(`#### ${labels.result}`, result);
    } else if (item.kind === "result") {
      parts.push(`## ${item.parts.title}`, item.parts.body);
    } else if (item.block.text?.trim()) {
      parts.push(item.block.text.trim());
    }
  }
  return parts.filter(Boolean).join("\n\n") + "\n";
}
