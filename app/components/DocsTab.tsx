"use client";

import { normalizeWalletAddress } from "@perkos/shared-types";

import { useEffect, useMemo, useState } from "react";
import { useAppAccount } from "../lib/useAppAccount";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Bot,
  Check,
  FileText,
  History,
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
import { DocumentView } from "./DocumentView";
import { DocGroupHeading, DocSheet, PlanProgress, PlanTaskSection, ResultPanel } from "./DocReader";
import { readingStats } from "./TaskDetailLayout";
import { MentionText } from "./MentionText";
import { MentionInput } from "./MentionInput";
import { extractMentions, type MentionParticipant } from "../lib/mentions";
import { useMentionParticipants } from "../lib/useMentionParticipants";
import { formatAddress } from "../lib/format";
import { docToMarkdown, readDoc } from "../lib/docReading";
import {
  useDoc,
  useDocMessages,
  useDocRevisions,
  useDocs,
  useActivePlanId,
} from "../lib/useDocs";

// `labelKey` maps a plan status to its translation key; `cls` stays a CSS token.
const PLAN_STATUS_META: Record<string, { labelKey: string; cls: string }> = {
  draft: { labelKey: "chat.docs.planStatus.draft", cls: "border-[#1b1833] text-[#7975a8]" },
  under_discussion: {
    labelKey: "chat.docs.planStatus.underDiscussion",
    cls: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  },
  plan_proposed: {
    labelKey: "chat.docs.planStatus.planProposed",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  approved: {
    labelKey: "chat.docs.planStatus.approved",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  materialized: {
    labelKey: "chat.docs.planStatus.materialized",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
};

// Doc-type enum value → translation key for its human-readable label.
const DOC_TYPE_LABEL: Record<string, string> = {
  note: "chat.docs.docType.note",
  plan: "chat.docs.docType.plan",
  spec: "chat.docs.docType.spec",
};

function docIcon(type?: string | null) {
  return type === "plan" ? ListChecks : FileText;
}

function ownerLabel(owner: string | null | undefined, t: TFunction): string {
  if (!owner) return t("chat.docs.someone");
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
  const { t } = useTranslation();
  const { address } = useAppAccount();
  const wallet = ownerWallet ?? address ?? undefined;
  const { docs, loading } = useDocs(wallet, projectId);
  const activePlanId = useActivePlanId(wallet, projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const liveDocs = useMemo(() => docs.filter((d) => !d.draft), [docs]);
  const pmDrafts = useMemo(() => docs.filter((d) => d.draft), [docs]);

  // @-mention participants: human members (by username) + project agents.
  const participants = useMentionParticipants(detail, projectId, ownerWallet);

  // Default selection: the active plan, else the first live doc.
  useEffect(() => {
    if (selectedId && docs.some((d) => d.id === selectedId)) return;
    const fallback = activePlanId ?? liveDocs[0]?.id ?? docs[0]?.id ?? null;
    setSelectedId(fallback);
  }, [docs, liveDocs, activePlanId, selectedId]);

  const startPlan = async () => {
    if (!address || !wallet) {
      toast.error(t("projectRoom.chat.errors.connectWalletFirst"));
      return;
    }
    setBusy(true);
    try {
      const id = await ensureProjectPlan({
        walletAddress: wallet,
        projectId,
        createdBy: `user:${normalizeWalletAddress(address)}`,
      });
      setSelectedId(id);
    } catch (e) {
      toast.error(t("chat.docs.toast.startPlanError"), {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (type: DocType, title: string) => {
    if (!address || !wallet) {
      toast.error(t("projectRoom.chat.errors.connectWalletFirst"));
      return;
    }
    setBusy(true);
    try {
      const { id } = await createDoc({
        walletAddress: wallet,
        projectId,
        type,
        title,
        createdBy: `user:${normalizeWalletAddress(address)}`,
      });
      setSelectedId(id);
      setCreating(false);
    } catch (e) {
      toast.error(t("chat.docs.toast.createDocError"), {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading && docs.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-8 text-sm text-[#7975a8]">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("chat.docs.loadingDocs")}
      </div>
    );
  }

  if (docs.length === 0 && !creating) {
    return (
      <EmptyState
        icon={FileText}
        title={t("chat.docs.empty.title")}
        description={t("chat.docs.empty.description")}
        actions={[
          {
            label: busy ? t("chat.docs.empty.starting") : t("chat.docs.empty.startSprintPlan"),
            onClick: startPlan,
            icon: ListChecks,
          },
          { label: t("chat.docs.empty.newNote"), onClick: () => setCreating(true), variant: "outline", icon: Plus },
        ]}
      />
    );
  }

  return (
    // The doc tree sits beside the document only when the Docs area itself is
    // wide enough; in the project room's middle stage it stacks above it.
    <div className="@container min-w-0">
    <div className="grid min-w-0 grid-cols-1 gap-4 @2xl:grid-cols-[220px_minmax(0,1fr)]">
      {/* Doc tree */}
      <aside className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-[#7975a8]">
            {t("chat.docs.tree.heading")}
          </span>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded p-1 text-[#7975a8] hover:text-[#ececff]"
            aria-label={t("chat.docs.tree.newDocAria")}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {creating ? (
          <NewDocForm busy={busy} onCreate={handleCreate} onCancel={() => setCreating(false)} />
        ) : null}

        {liveDocs.length === 0 && pmDrafts.length === 0 && !creating ? (
          <p className="px-1 py-2 text-xs text-[#4f4b6e]">{t("chat.docs.tree.noDocsYet")}</p>
        ) : null}

        {/* Phones: one scrollable row of chips. md and up: the vertical tree. */}
        <nav
          aria-label={t("chat.docs.tree.heading")}
          className="-mx-1 flex snap-x gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] md:mx-0 md:flex-col md:gap-1.5 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
        >
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
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-[#1b1833] px-2 py-1.5 text-xs text-[#7975a8] hover:text-[#ececff] md:mt-1"
            >
              <ListChecks className="h-3.5 w-3.5" /> {t("chat.docs.empty.startSprintPlan")}
            </button>
          ) : null}

          {pmDrafts.length > 0 ? (
            <div className="contents md:mt-3 md:flex md:flex-col md:gap-1.5">
              <span className="hidden items-center gap-1 text-xs font-medium uppercase tracking-wide text-[#7975a8] md:flex">
                <Bot className="h-3 w-3" /> {t("chat.docs.tree.teamLeadDrafts")}
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
        </nav>
      </aside>

      {/* Editor + per-doc chat */}
      {selectedId ? (
        <DocEditor
          key={selectedId}
          wallet={wallet}
          projectId={projectId}
          ownerWallet={ownerWallet}
          tasks={detail.tasks}
          docId={selectedId}
          me={address ? `user:${normalizeWalletAddress(address)}` : null}
          meWallet={address ?? undefined}
          participants={participants}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <div className="grid place-items-center rounded-md border border-dashed border-[#1b1833] bg-[#0e0716] p-10 text-sm text-[#7975a8]">
          {t("chat.docs.selectPrompt")}
        </div>
      )}
    </div>
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
  const { t } = useTranslation();
  const Icon = docIcon(doc.type);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={`flex max-w-[15rem] shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-left text-sm transition-colors md:w-full md:max-w-none md:rounded-md md:border-transparent md:px-2 ${
        isDraft ? "border-dashed border-[#1b1833]" : "border-[#1b1833]"
      } ${
        active
          ? "bg-[#1b1833] text-[#ececff]"
          : "text-[#a9a4d4] hover:bg-[#14101f] hover:text-[#ececff]"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${isDraft ? "text-[#7975a8]" : ""}`} />
      <span className="min-w-0 flex-1 truncate">
        {doc.title || t("chat.docs.untitled")}
      </span>
      {isPlan ? (
        <span className="shrink-0 rounded-full bg-[#ec1b69]/15 px-1.5 text-[10px] text-[#ec1b69]">
          {t("chat.docs.tree.planBadge")}
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
  const { t } = useTranslation();
  const [type, setType] = useState<DocType>("note");
  const [title, setTitle] = useState("");
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] p-2">
      <div className="flex gap-1">
        {(["note", "plan", "spec"] as DocType[]).map((dt) => (
          <button
            key={dt}
            type="button"
            onClick={() => setType(dt)}
            className={`flex-1 rounded px-1.5 py-1 text-[11px] capitalize ${
              type === dt
                ? "bg-[#ec1b69]/15 text-[#ec1b69]"
                : "text-[#7975a8] hover:text-[#ececff]"
            }`}
          >
            {t(DOC_TYPE_LABEL[dt])}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("chat.docs.newDoc.titlePlaceholder")}
        className="w-full rounded-md border border-[#1b1833] bg-[#0a0511] px-2 py-1.5 text-sm text-[#ececff] outline-none placeholder:text-[#4f4b6e] focus:border-[#ec1b69]/50"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) onCreate(type, title.trim());
        }}
      />
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          {t("chat.docs.newDoc.cancel")}
        </Button>
        <Button
          size="sm"
          onClick={() => title.trim() && onCreate(type, title.trim())}
          disabled={busy || !title.trim()}
        >
          {t("chat.docs.newDoc.create")}
        </Button>
      </div>
    </div>
  );
}

function DocEditor({
  wallet,
  projectId,
  ownerWallet,
  tasks,
  docId,
  me,
  meWallet,
  participants,
  onDeleted,
}: {
  wallet?: string;
  projectId: string;
  ownerWallet?: string;
  tasks: ProjectDetail["tasks"];
  docId: string;
  me: string | null;
  meWallet?: string;
  participants: MentionParticipant[];
  onDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { doc, blocks, loading } = useDoc(wallet, projectId, docId);
  const { revisions } = useDocRevisions(wallet, projectId, docId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isPlan = doc?.type === "plan";
  const status = (doc?.status as string) ?? null;
  const statusMeta = status ? PLAN_STATUS_META[status] : null;
  const reading = useMemo(() => readDoc(blocks, tasks), [blocks, tasks]);
  const docTitle = doc?.title || t("chat.docs.untitled");
  const source = useMemo(
    () =>
      docToMarkdown(docTitle, reading.items, {
        doneWhen: t("chat.docs.reader.doneWhen"),
        assignedTo: t("chat.docs.reader.assignedTo"),
        result: t("chat.docs.reader.result"),
      }),
    [docTitle, reading, t],
  );
  const { words, minutes } = readingStats(source);
  // Who wrote it: the doc's creator, else the lead that proposed its tasks.
  const author = doc?.createdBy ?? blocks.find((b) => b.type === "planTask")?.owner ?? null;
  const meta = [
    author ? t("chat.docs.reader.byline", { name: ownerLabel(author, t) }) : null,
    isPlan ? t("chat.docs.reader.taskCount", { count: reading.taskCount }) : null,
    t("chat.docs.reader.stats", { words: words.toLocaleString(i18n.language), minutes }),
    doc?.updatedAt
      ? t("chat.docs.reader.updated", {
          date: new Date(doc.updatedAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" }),
        })
      : null,
  ].filter((piece): piece is string => Boolean(piece));
  const taskHref = (taskId: string) =>
    `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}` +
    (ownerWallet ? `?owner=${encodeURIComponent(ownerWallet)}` : "");

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
      toast.error(t("chat.docs.editor.addNoteError"), { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!wallet) return;
    if (doc?.draft !== true) {
      if (!confirm(t("chat.docs.editor.confirmDeleteDoc"))) return;
    }
    try {
      await deleteProjectDoc({ walletAddress: wallet, projectId, docId });
      onDeleted();
    } catch (e) {
      toast.error(t("chat.docs.editor.deleteDocError"), { description: (e as Error).message });
    }
  };

  const promote = async () => {
    if (!wallet) return;
    try {
      await promoteDoc({ walletAddress: wallet, projectId, docId });
      toast.success(t("chat.docs.editor.promotedSuccess"));
    } catch (e) {
      toast.error(t("chat.docs.editor.promoteError"), { description: (e as Error).message });
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
          ? t("chat.docs.editor.tasksCreatedOnBoard", { count: res.created })
          : t("chat.docs.editor.planApproved"),
      );
    } catch (e) {
      toast.error(t("chat.docs.editor.approvePlanError"), {
        description: (e as Error).message,
      });
    } finally {
      setApproving(false);
    }
  };

  const editor = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {doc?.draft ? (
          <Button size="sm" variant="outline" onClick={promote}>
            {t("chat.docs.editor.promote")}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={showChat ? "secondary" : "outline"}
          onClick={() => setShowChat((v) => !v)}
        >
          <MessageSquare className="h-4 w-4" /> {t("chat.docs.editor.discussion")}
        </Button>
        <Button
          size="sm"
          variant={showHistory ? "secondary" : "outline"}
          onClick={() => setShowHistory((value) => !value)}
        >
          <History className="h-4 w-4" /> History ({revisions.length})
        </Button>
        <button
          type="button"
          onClick={remove}
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:text-red-400 sm:h-8 sm:w-8"
          aria-label={t("chat.docs.editor.deleteDocAria")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {showHistory ? (
        <div className="rounded-md border border-[#1b1833] bg-[#0e0716] p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#a9a4d4]">
            Revision history
          </h3>
          {revisions.length === 0 ? (
            <p className="mt-2 text-xs text-[#7975a8]">No revisions recorded yet.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {[...revisions].reverse().map((revision) => (
                <li key={revision.id} className="rounded border border-[#1b1833] px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[#cfcbef]">
                      {revision.action.replaceAll("_", " ")}
                    </span>
                    <span className="text-[#4f4b6e]">
                      {revision.createdAt ? new Date(revision.createdAt).toLocaleString() : "pending"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#7975a8]">
                    {ownerLabel(revision.actor, t)}
                    {revision.summary ? ` · ${revision.summary}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}

      {loading && blocks.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-sm text-[#7975a8]">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <DocSheet
          title={docTitle}
          eyebrow={`${t(DOC_TYPE_LABEL[doc?.type ?? "note"] ?? DOC_TYPE_LABEL.note)}${doc?.draft ? ` · ${t("chat.docs.editor.leadsDraft")}` : ""}`}
          icon={docIcon(doc?.type)}
          meta={meta.map((piece, index) => (
            <span key={index} className="inline-flex min-w-0 max-w-full items-center gap-x-1.5">
              {index > 0 ? <span aria-hidden>·</span> : null}
              <span className="min-w-0 truncate">{piece}</span>
            </span>
          ))}
          source={source}
        >
          {isPlan ? (
            <PlanProgress
              reading={reading}
              statusPill={
                statusMeta ? (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${statusMeta.cls}`}>
                    {t(statusMeta.labelKey)}
                  </span>
                ) : null
              }
              action={
                canApprove ? (
                  <Button size="sm" onClick={approve} disabled={approving}>
                    {approving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("chat.docs.editor.approving")}
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />{" "}
                        {t("chat.docs.editor.approveAndCreate", { count: unmaterializedTasks })}
                      </>
                    )}
                  </Button>
                ) : status === "plan_proposed" ? (
                  <span className="text-xs text-amber-200/80">{t("chat.docs.editor.proposedNoTasks")}</span>
                ) : null
              }
            />
          ) : null}
          {reading.items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {isPlan ? t("chat.docs.editor.emptyDocPlan") : t("chat.docs.editor.emptyDocNote")}
            </p>
          ) : (
            reading.items.map((item, index) => {
              if (item.kind === "group") {
                return (
                  <DocGroupHeading key={item.block.id}>
                    {item.block.title || t("chat.docs.editor.untitledGroup")}
                  </DocGroupHeading>
                );
              }
              if (item.kind === "task") {
                return (
                  <PlanTaskSection
                    key={item.view.block.id}
                    view={item.view}
                    last={reading.items[index + 1]?.kind !== "task"}
                    taskHref={taskHref}
                    proposedBy={t("chat.docs.task.proposedBy", { owner: ownerLabel(item.view.block.owner, t) })}
                  />
                );
              }
              if (item.kind === "result") {
                return <ResultPanel key={item.block.id} title={item.parts.title} text={item.parts.body} showTitle />;
              }
              const b = item.block;
              return (
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
              );
            })
          )}
        </DocSheet>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-[#1b1833] bg-[#0e0716] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("chat.docs.editor.notePlaceholder")}
          rows={3}
          className="w-full resize-y rounded-md border border-[#1b1833] bg-[#0a0511] px-3 py-2 text-sm text-[#ececff] outline-none placeholder:text-[#4f4b6e] focus:border-[#ec1b69]/50"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={addNote} disabled={busy || !draft.trim()}>
            <Plus className="h-4 w-4" /> {t("chat.docs.editor.addNote")}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!showChat) return editor;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      {editor}
      <div className="fixed inset-0 z-50 bg-background/80 p-2 pb-20 backdrop-blur-sm lg:static lg:z-auto lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <DocChat
          wallet={wallet}
          projectId={projectId}
          docId={docId}
          docTitle={doc?.title ?? t("chat.docs.docFallback")}
          participants={participants}
          meWallet={meWallet}
          onClose={() => setShowChat(false)}
        />
      </div>
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
  const { t } = useTranslation();
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
      toast.error(t("chat.docs.note.saveError"), { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group rounded-r-md border-l-2 border-border py-1 pl-4">
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
              {t("chat.docs.note.cancel")}
            </Button>
            <Button size="sm" onClick={save} disabled={busy || !val.trim()}>
              <Check className="h-4 w-4" /> {t("chat.docs.note.save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <DocumentView title={t("chat.docs.docType.note")} toolbar={false}>
              {block.text ?? ""}
            </DocumentView>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t("chat.docs.reader.noteBy", { owner: ownerLabel(block.owner, t) })}
            </p>
          </div>
          {canEdit ? (
            // Always visible on touch screens; revealed on hover with a mouse.
            <div className="flex shrink-0 items-center gap-1 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded p-1 text-[#7975a8] hover:text-[#ececff]"
                aria-label={t("chat.docs.note.editAria")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete().catch(() => {})}
                className="rounded p-1 text-[#7975a8] hover:text-red-400"
                aria-label={t("chat.docs.note.deleteAria")}
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
  const { t } = useTranslation();
  const { address } = useAppAccount();
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
      toast.error(t("chat.docs.docChat.sendError"), { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border border-[#1b1833] bg-[#0e0716] lg:h-[60vh] lg:min-h-[420px]">
      <div className="flex items-center justify-between border-b border-[#1b1833] px-3 py-2">
        <span className="truncate text-sm font-medium text-[#ececff]">
          {t("chat.docs.docChat.headerTitle", { title: docTitle })}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#7975a8] hover:text-[#ececff]"
          aria-label={t("chat.docs.docChat.closeAria")}
        >
          ✕
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#4f4b6e]">
            {t("chat.docs.docChat.empty")}
          </p>
        ) : (
          messages.map((m) => {
            const mine =
              m.from === "user" &&
              (!m.agentName ||
                normalizeWalletAddress(m.agentName) === normalizeWalletAddress(address ?? ""));
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] text-[#4f4b6e]">
                  {m.from === "agent" ? ownerLabel(m.agentName ?? "agent", t) : t("chat.docs.docChat.you")}
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
            placeholder={t("chat.docs.docChat.composerPlaceholder")}
            rows={1}
            className="min-h-[38px] w-full resize-y rounded-md border border-[#1b1833] bg-[#0a0511] px-2.5 py-2 text-sm text-[#ececff] outline-none placeholder:text-[#4f4b6e] focus:border-[#ec1b69]/50"
          />
        </div>
        <Button size="sm" onClick={send} disabled={busy || !draft.trim()}>
          {t("chat.docs.docChat.send")}
        </Button>
      </div>
    </div>
  );
}
