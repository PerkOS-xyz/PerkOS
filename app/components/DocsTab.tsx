"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  Bot,
  Check,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  addDocMessage,
  addDocNote,
  approvePlan,
  createDoc,
  deleteDocBlock,
  deleteProjectDoc,
  ensureProjectPlan,
  promoteDoc,
  updateDocNote,
  type Doc,
  type DocType,
  type PlanBlock,
  type ProjectDetail,
} from "../lib/perkosApi";
import { EmptyState } from "./EmptyState";
import { Markdown } from "./Markdown";
import { MentionText } from "./MentionText";
import { MentionInput } from "./MentionInput";
import { extractMentions, type MentionParticipant } from "../lib/mentions";
import { useMentionParticipants } from "../lib/useMentionParticipants";
import { formatAddress } from "../lib/format";
import {
  useDoc,
  useDocMessages,
  useDocs,
  useActivePlanId,
} from "../lib/useDocs";

const PLAN_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "border-[#1b1833] text-[#7975a8]" },
  under_discussion: {
    label: "Under discussion",
    cls: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  plan_proposed: {
    label: "Plan proposed",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  approved: {
    label: "Approved",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  materialized: {
    label: "Materialized",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
};

const DOC_TYPE_LABEL: Record<string, string> = {
  note: "Note",
  plan: "Plan",
  spec: "Spec",
};

function docIcon(type?: string | null) {
  return type === "plan" ? ListChecks : FileText;
}

function ownerLabel(owner?: string | null): string {
  if (!owner) return "someone";
  if (owner.startsWith("agent:")) return owner.slice("agent:".length);
  if (owner.startsWith("user:")) return formatAddress(owner.slice("user:".length));
  return owner;
}

/**
 * Docs workspace tab — a tree of docs (note|plan|spec), each with its own
 * editor + discussion. Humans write note blocks; the PM proposes
 * planGroup/planTask blocks (read-only here). PM-created docs sit under "PM
 * Drafts" until promoted. A proposed plan can be approved → its planTask
 * blocks materialize into board tasks server-side (see approvePlan).
 */
export function DocsTab({
  detail,
  projectId,
  ownerWallet,
}: {
  detail: ProjectDetail;
  projectId: string;
  ownerWallet?: string;
}) {
  const { address } = useConnection();
  const wallet = ownerWallet ?? address ?? undefined;
  const { docs, loading } = useDocs(wallet, projectId);
  const activePlanId = useActivePlanId(wallet, projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const liveDocs = useMemo(() => docs.filter((d) => !d.draft), [docs]);
  const pmDrafts = useMemo(() => docs.filter((d) => d.draft), [docs]);

  // @-mention participants: human members (by username) + project agents.
  const participants = useMentionParticipants(detail, projectId);

  // Default selection: the active plan, else the first live doc.
  useEffect(() => {
    if (selectedId && docs.some((d) => d.id === selectedId)) return;
    const fallback = activePlanId ?? liveDocs[0]?.id ?? docs[0]?.id ?? null;
    setSelectedId(fallback);
  }, [docs, liveDocs, activePlanId, selectedId]);

  const startPlan = async () => {
    if (!address || !wallet) {
      toast.error("Connect a wallet first.");
      return;
    }
    setBusy(true);
    try {
      const id = await ensureProjectPlan({
        walletAddress: wallet,
        projectId,
        createdBy: `user:${address.toLowerCase()}`,
      });
      setSelectedId(id);
    } catch (e) {
      toast.error("Couldn't start the plan", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (type: DocType, title: string) => {
    if (!address || !wallet) {
      toast.error("Connect a wallet first.");
      return;
    }
    setBusy(true);
    try {
      const { id } = await createDoc({
        walletAddress: wallet,
        projectId,
        type,
        title,
        createdBy: `user:${address.toLowerCase()}`,
      });
      setSelectedId(id);
      setCreating(false);
    } catch (e) {
      toast.error("Couldn't create the doc", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading && docs.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-8 text-sm text-[#7975a8]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading docs…
      </div>
    );
  }

  if (docs.length === 0 && !creating) {
    return (
      <EmptyState
        icon={FileText}
        title="No docs yet"
        description="Docs are where your team and the PM agent think together — a sprint plan, a spec, meeting notes. Start the sprint plan, or create a free-form note."
        actions={[
          { label: busy ? "Starting…" : "Start sprint plan", onClick: startPlan, icon: ListChecks },
          { label: "New note", onClick: () => setCreating(true), variant: "outline", icon: Plus },
        ]}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      {/* Doc tree */}
      <aside className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-[#7975a8]">
            Docs
          </span>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded p-1 text-[#7975a8] hover:text-[#ececff]"
            aria-label="New doc"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {creating ? (
          <NewDocForm busy={busy} onCreate={handleCreate} onCancel={() => setCreating(false)} />
        ) : null}

        {liveDocs.length === 0 && !creating ? (
          <p className="px-1 py-2 text-xs text-[#4f4b6e]">No docs yet.</p>
        ) : null}

        {liveDocs.map((d) => (
          <DocTreeItem
            key={d.id}
            doc={d}
            active={d.id === selectedId}
            isPlan={d.id === activePlanId}
            onSelect={() => setSelectedId(d.id ?? null)}
          />
        ))}

        {!activePlanId ? (
          <button
            type="button"
            onClick={startPlan}
            disabled={busy}
            className="mt-1 flex items-center gap-1.5 rounded-md border border-dashed border-[#1b1833] px-2 py-1.5 text-xs text-[#7975a8] hover:text-[#ececff]"
          >
            <ListChecks className="h-3.5 w-3.5" /> Start sprint plan
          </button>
        ) : null}

        {pmDrafts.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-[#7975a8]">
              <Bot className="h-3 w-3" /> PM Drafts
            </span>
            {pmDrafts.map((d) => (
              <DocTreeItem
                key={d.id}
                doc={d}
                active={d.id === selectedId}
                isDraft
                onSelect={() => setSelectedId(d.id ?? null)}
              />
            ))}
          </div>
        ) : null}
      </aside>

      {/* Editor + per-doc chat */}
      {selectedId ? (
        <DocEditor
          key={selectedId}
          wallet={wallet}
          projectId={projectId}
          docId={selectedId}
          me={address ? `user:${address.toLowerCase()}` : null}
          meWallet={address ?? undefined}
          participants={participants}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <div className="grid place-items-center rounded-md border border-dashed border-[#1b1833] bg-[#0e0716] p-10 text-sm text-[#7975a8]">
          Select a doc, or create one.
        </div>
      )}
    </div>
  );
}

function DocTreeItem({
  doc,
  active,
  isPlan,
  isDraft,
  onSelect,
}: {
  doc: Doc;
  active: boolean;
  isPlan?: boolean;
  isDraft?: boolean;
  onSelect: () => void;
}) {
  const Icon = docIcon(doc.type);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-[#1b1833] text-[#ececff]"
          : "text-[#a9a4d4] hover:bg-[#14101f] hover:text-[#ececff]"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${isDraft ? "text-[#7975a8]" : ""}`} />
      <span className="min-w-0 flex-1 truncate">
        {doc.title || "Untitled"}
      </span>
      {isPlan ? (
        <span className="shrink-0 rounded-full bg-[#ec1b69]/15 px-1.5 text-[10px] text-[#ec1b69]">
          plan
        </span>
      ) : null}
    </button>
  );
}

function NewDocForm({
  busy,
  onCreate,
  onCancel,
}: {
  busy: boolean;
  onCreate: (type: DocType, title: string) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<DocType>("note");
  const [title, setTitle] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] p-2">
      <div className="flex gap-1">
        {(["note", "plan", "spec"] as DocType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded px-1.5 py-1 text-[11px] capitalize ${
              type === t
                ? "bg-[#ec1b69]/15 text-[#ec1b69]"
                : "text-[#7975a8] hover:text-[#ececff]"
            }`}
          >
            {DOC_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title…"
        className="w-full rounded-md border border-[#1b1833] bg-[#0a0511] px-2 py-1.5 text-sm text-[#ececff] outline-none placeholder:text-[#4f4b6e] focus:border-[#ec1b69]/50"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) onCreate(type, title.trim());
        }}
      />
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => title.trim() && onCreate(type, title.trim())}
          disabled={busy || !title.trim()}
        >
          Create
        </Button>
      </div>
    </div>
  );
}

function DocEditor({
  wallet,
  projectId,
  docId,
  me,
  meWallet,
  participants,
  onDeleted,
}: {
  wallet?: string;
  projectId: string;
  docId: string;
  me: string | null;
  meWallet?: string;
  participants: MentionParticipant[];
  onDeleted: () => void;
}) {
  const { doc, blocks, loading } = useDoc(wallet, projectId, docId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const isPlan = doc?.type === "plan";
  const status = (doc?.status as string) ?? null;
  const statusMeta = status ? PLAN_STATUS_META[status] : null;
  const taskCount = blocks.filter((b) => b.type === "planTask").length;

  const addNote = async () => {
    const text = draft.trim();
    if (!text || !wallet || !me) return;
    setBusy(true);
    try {
      const order = blocks.length
        ? Math.max(...blocks.map((b) => b.order)) + 1
        : 0;
      await addDocNote({ walletAddress: wallet, projectId, docId, text, owner: me, order });
      setDraft("");
    } catch (e) {
      toast.error("Couldn't add note", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!wallet) return;
    if (doc?.draft !== true) {
      if (!confirm("Delete this doc?")) return;
    }
    try {
      await deleteProjectDoc({ walletAddress: wallet, projectId, docId });
      onDeleted();
    } catch (e) {
      toast.error("Couldn't delete the doc", { description: (e as Error).message });
    }
  };

  const promote = async () => {
    if (!wallet) return;
    try {
      await promoteDoc({ walletAddress: wallet, projectId, docId });
      toast.success("Doc promoted to the tree");
    } catch (e) {
      toast.error("Couldn't promote", { description: (e as Error).message });
    }
  };

  const [approving, setApproving] = useState(false);
  // planTask blocks not yet turned into board tasks.
  const unmaterializedTasks = blocks.filter(
    (b) => b.type === "planTask" && !b.materializedTaskId,
  ).length;
  const canApprove =
    isPlan &&
    unmaterializedTasks > 0 &&
    (status === "plan_proposed" || status === "approved");

  const approve = async () => {
    if (!wallet) return;
    setApproving(true);
    try {
      const res = await approvePlan({ projectId, docId, owner: wallet });
      toast.success(
        res.created > 0
          ? `Created ${res.created} task${res.created === 1 ? "" : "s"} on the board`
          : "Plan approved",
      );
    } catch (e) {
      toast.error("Couldn't approve the plan", {
        description: (e as Error).message,
      });
    } finally {
      setApproving(false);
    }
  };

  const editor = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-[#ececff]">
            {doc?.title || "Untitled"}
          </h2>
          <span className="text-[11px] uppercase tracking-wide text-[#7975a8]">
            {DOC_TYPE_LABEL[doc?.type ?? "note"] ?? "Note"}
            {doc?.draft ? " · PM draft" : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {doc?.draft ? (
            <Button size="sm" variant="outline" onClick={promote}>
              Promote
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={showChat ? "secondary" : "outline"}
            onClick={() => setShowChat((v) => !v)}
          >
            <MessageSquare className="h-4 w-4" /> Discussion
          </Button>
          <button
            type="button"
            onClick={remove}
            className="rounded p-1.5 text-[#7975a8] hover:text-red-400"
            aria-label="Delete doc"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isPlan ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] px-3 py-2">
          {statusMeta ? (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${statusMeta.cls}`}>
              {statusMeta.label}
            </span>
          ) : null}
          <span className="text-xs text-[#7975a8]">
            {taskCount} draft task{taskCount === 1 ? "" : "s"}
          </span>
          {canApprove ? (
            <Button size="xs" onClick={approve} disabled={approving}>
              {approving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Approving…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> Approve &amp; create{" "}
                  {unmaterializedTasks} task{unmaterializedTasks === 1 ? "" : "s"}
                </>
              )}
            </Button>
          ) : status === "materialized" ? (
            <span className="text-xs text-emerald-200/80">
              Tasks created on the board.
            </span>
          ) : status === "plan_proposed" ? (
            <span className="text-xs text-amber-200/80">
              Proposed — no draft tasks to create yet.
            </span>
          ) : null}
        </div>
      ) : null}

      {loading && blocks.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[#7975a8]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {blocks.length === 0 ? (
            <p className="rounded-md border border-dashed border-[#1b1833] bg-[#0e0716] px-4 py-6 text-center text-sm text-[#7975a8]">
              Empty doc. Add a note below{isPlan ? ", or ask the PM in the discussion to draft the plan." : "."}
            </p>
          ) : (
            blocks.map((b) =>
              b.type === "note" ? (
                <PlanNoteBlock
                  key={b.id}
                  block={b}
                  canEdit={Boolean(me) && b.owner === me}
                  onSave={async (text) => {
                    if (!wallet) return;
                    await updateDocNote({ walletAddress: wallet, projectId, docId, blockId: b.id!, text });
                  }}
                  onDelete={async () => {
                    if (!wallet) return;
                    await deleteDocBlock({ walletAddress: wallet, projectId, docId, blockId: b.id! });
                  }}
                />
              ) : b.type === "planGroup" ? (
                <div key={b.id} className="pt-2">
                  <h3 className="text-sm font-semibold text-[#ececff]">
                    {b.title || "Untitled group"}
                  </h3>
                  <div className="mt-1 h-px bg-[#1b1833]" />
                </div>
              ) : (
                <PlanTaskBlock key={b.id} block={b} />
              )
            )
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note (context, constraints, feedback)…"
          rows={3}
          className="w-full resize-y rounded-md border border-[#1b1833] bg-[#0a0511] px-3 py-2 text-sm text-[#ececff] outline-none placeholder:text-[#4f4b6e] focus:border-[#ec1b69]/50"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={addNote} disabled={busy || !draft.trim()}>
            <Plus className="h-4 w-4" /> Add note
          </Button>
        </div>
      </div>
    </div>
  );

  if (!showChat) return editor;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      {editor}
      <DocChat
        wallet={wallet}
        projectId={projectId}
        docId={docId}
        docTitle={doc?.title ?? "Doc"}
        participants={participants}
        meWallet={meWallet}
        onClose={() => setShowChat(false)}
      />
    </div>
  );
}

function PlanNoteBlock({
  block,
  canEdit,
  onSave,
  onDelete,
}: {
  block: PlanBlock;
  canEdit: boolean;
  onSave: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(block.text ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editing) setVal(block.text ?? "");
  }, [block.text, editing]);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(val.trim());
      setEditing(false);
    } catch (e) {
      toast.error("Couldn't save note", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group rounded-md border border-[#1b1833] bg-[#0e0716] px-3 py-2.5">
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={3}
            className="w-full resize-y rounded-md border border-[#1b1833] bg-[#0a0511] px-3 py-2 text-sm text-[#ececff] outline-none focus:border-[#ec1b69]/50"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={busy || !val.trim()}>
              <Check className="h-4 w-4" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 text-sm text-[#cfcbef]">
            <Markdown>{block.text ?? ""}</Markdown>
            <p className="mt-1 text-[11px] text-[#4f4b6e]">{ownerLabel(block.owner)}</p>
          </div>
          {canEdit ? (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded p-1 text-[#7975a8] hover:text-[#ececff]"
                aria-label="Edit note"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete().catch(() => {})}
                className="rounded p-1 text-[#7975a8] hover:text-red-400"
                aria-label="Delete note"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PlanTaskBlock({ block }: { block: PlanBlock }) {
  return (
    <div className="ml-3 rounded-md border-l-2 border-[#ec1b69]/40 border-y border-r border-y-[#1b1833] border-r-[#1b1833] bg-[#0c0613] px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-[#ececff]">
          {block.title || "Untitled task"}
        </span>
        {block.suggestedAgent ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#1b1833] px-2 py-0.5 text-[11px] text-[#a9a4d4]">
            <Bot className="h-3 w-3" /> {block.suggestedAgent}
          </span>
        ) : null}
      </div>
      {block.desc ? (
        <p className="mt-1 whitespace-pre-wrap text-xs text-[#a9a4d4]">{block.desc}</p>
      ) : null}
      {block.acceptance ? (
        <p className="mt-1.5 text-[11px] text-[#7975a8]">
          <span className="text-[#a9a4d4]">Done when:</span> {block.acceptance}
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-[#4f4b6e]">
        Proposed by {ownerLabel(block.owner)} · draft
      </p>
    </div>
  );
}

function DocChat({
  wallet,
  projectId,
  docId,
  docTitle,
  participants,
  meWallet,
  onClose,
}: {
  wallet?: string;
  projectId: string;
  docId: string;
  docTitle: string;
  participants: MentionParticipant[];
  meWallet?: string;
  onClose: () => void;
}) {
  const { address } = useConnection();
  const { messages } = useDocMessages(wallet, projectId, docId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = draft.trim();
    if (!text || !wallet) return;
    setBusy(true);
    try {
      await addDocMessage({
        walletAddress: wallet,
        projectId,
        docId,
        text,
        from: "user",
        mentions: extractMentions(text, participants),
      });
      setDraft("");
    } catch (e) {
      toast.error("Couldn't send", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[60vh] min-h-[420px] flex-col rounded-md border border-[#1b1833] bg-[#0e0716]">
      <div className="flex items-center justify-between border-b border-[#1b1833] px-3 py-2">
        <span className="truncate text-sm font-medium text-[#ececff]">
          {docTitle} — Discussion
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#7975a8] hover:text-[#ececff]"
          aria-label="Close discussion"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#4f4b6e]">
            Discuss this doc with your team + the PM. The PM posts here when it
            edits the doc.
          </p>
        ) : (
          messages.map((m) => {
            const mine =
              m.from === "user" &&
              (!m.agentName ||
                m.agentName.toLowerCase() === (address ?? "").toLowerCase());
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] text-[#4f4b6e]">
                  {m.from === "agent" ? ownerLabel(m.agentName ?? "agent") : "You"}
                </span>
                <div
                  className={`max-w-[85%] rounded-md px-2.5 py-1.5 text-sm ${
                    m.from === "agent"
                      ? "bg-[#14101f] text-[#cfcbef]"
                      : "bg-[#ec1b69]/15 text-[#ececff]"
                  }`}
                >
                  <MentionText
                    text={m.text}
                    participants={participants}
                    meWallet={meWallet}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-end gap-2 border-t border-[#1b1833] p-2">
        <div className="flex-1">
          <MentionInput
            value={draft}
            onChange={setDraft}
            onSend={send}
            participants={participants}
            placeholder="Message…  (type @ to mention)"
            rows={1}
            className="min-h-[38px] w-full resize-y rounded-md border border-[#1b1833] bg-[#0a0511] px-2.5 py-2 text-sm text-[#ececff] outline-none placeholder:text-[#4f4b6e] focus:border-[#ec1b69]/50"
          />
        </div>
        <Button size="sm" onClick={send} disabled={busy || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
