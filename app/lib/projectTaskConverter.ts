import type { FirestoreDataConverter, Timestamp } from "firebase/firestore";
import type { Task, TaskAttachment } from "./perkosApi";

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate().toISOString();
  return undefined;
}

/** One projection for initial reads and realtime snapshots. No writes or inference. */
export const taskConverter: FirestoreDataConverter<Task> = {
  toFirestore(task) {
    const rest = { ...task };
    delete rest.id;
    delete rest.createdAt;
    delete rest.updatedAt;
    return rest;
  },
  fromFirestore(snap) {
    const data = snap.data();
    return {
      id: snap.id,
      name: (data.name as string) ?? "",
      status: (data.status as Task["status"]) ?? "Backlog",
      priority: (data.priority as Task["priority"]) ?? "Medium",
      executionMode: data.executionMode === "artizen-on-demand" ? "artizen-on-demand" : undefined,
      artizenRunId: typeof data.artizenRunId === "string" ? data.artizenRunId : undefined,
      executionPhase: typeof data.executionPhase === "string" ? data.executionPhase : undefined,
      stopReason: typeof data.stopReason === "string" ? data.stopReason : undefined,
      failureCode: data.failureCode === "runtime-start-failed" ? "runtime-start-failed" : undefined,
      humanApproved: data.humanApproved === true,
      approvedExample: typeof data.approvedExample === "string" ? data.approvedExample : undefined,
      agent: (data.agent as string) ?? "",
      agentId: (data.agentId as string | undefined) ?? undefined,
      prompt: (data.prompt as string | undefined) ?? undefined,
      result: (data.result as string | undefined) ?? undefined,
      logs: (data.logs as string[] | undefined) ?? undefined,
      attachments: Array.isArray(data.attachments) ? (data.attachments as TaskAttachment[]) : undefined,
      createdAt: tsToIso(data.createdAt),
      updatedAt: tsToIso(data.updatedAt),
    };
  },
};
