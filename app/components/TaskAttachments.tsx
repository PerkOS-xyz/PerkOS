"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadAttachment, type Attachment } from "../lib/uploadAttachment";
import { useAppAccount } from "../lib/useAppAccount";
import type { TaskAttachment } from "../lib/perkosApi";

/** Same ceiling the API schema and the Storage rule enforce. */
const MAX_ATTACHMENTS = 10;

/**
 * Attach files to a task, reusing the chat composer's upload path.
 *
 * Files go straight from the browser to Firebase Storage under
 * `attachments/{wallet}/{scope}/...`; we keep only the returned download URL,
 * which carries its own capability token. That token is what lets the assigned
 * agent fetch the image later, exactly as it already works for chat.
 *
 * Shared by the create form and the edit dialog so a task attached at creation
 * and one attached later are the same thing.
 */
export function TaskAttachments({
  scope,
  value,
  onChange,
  disabled,
}: {
  /** Path segment that groups a task's files, e.g. the project id. */
  scope: string;
  value: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  // Derived here, never passed in. The Storage rule is
  // `request.auth.uid == wallet` on the PATH, so the only wallet that can ever
  // work is the signed-in one. Passing the project OWNER instead — the right
  // answer for the Firestore write, the wrong one here — is what produced
  // storage/unauthorized for every org member who was not the owner.
  const { address: walletAddress } = useAppAccount();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const atLimit = value.length >= MAX_ATTACHMENTS;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!walletAddress) {
      toast.error(t("tasks.attachments.connectFirst"));
      return;
    }
    const room = MAX_ATTACHMENTS - value.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length) {
      toast.warning(t("tasks.attachments.limit", { max: MAX_ATTACHMENTS }));
    }

    setBusy(true);
    const uploaded: Attachment[] = [];
    for (const [index, file] of picked.entries()) {
      try {
        uploaded.push(await uploadAttachment({ file, walletAddress, conversationId: scope, index }));
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
    setBusy(false);
    if (uploaded.length > 0) onChange([...value, ...uploaded]);
    // Let the same file be picked again after a removal.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md,.csv,.json"
        className="sr-only"
        disabled={disabled || busy || atLimit}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
          )}
          {t("chat.composer.attachFiles")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("tasks.attachments.hint")}
        </span>
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((a) => (
            <li
              key={a.url}
              className="group relative flex items-center gap-2 rounded-lg border border-border bg-card p-1.5 pr-7"
            >
              {a.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
              )}
              <span className="max-w-[10rem] truncate text-xs">{a.name}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((x) => x.url !== a.url))}
                aria-label={t("chat.composer.removeAttachment", { name: a.name })}
                className="absolute right-1 top-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Read-only strip used on the task detail page. */
export function TaskAttachmentList({ attachments }: { attachments: TaskAttachment[] }) {
  const { t } = useTranslation();
  if (attachments.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("tasks.attachments.label")}
      </h2>
      <ul className="flex flex-wrap gap-3">
        {attachments.map((a) => (
          <li key={a.url}>
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-2 hover:border-primary/50"
            >
              {a.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.name}
                  className="h-28 w-40 rounded object-cover"
                />
              ) : (
                <FileText className="h-10 w-10 text-muted-foreground" aria-hidden />
              )}
              <span className="max-w-[10rem] truncate text-xs">{a.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
