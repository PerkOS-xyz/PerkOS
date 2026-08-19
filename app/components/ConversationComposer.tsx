"use client";

import { ImagePlus, Loader2, Mic, Pause, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useSpeechToText } from "../lib/useSpeechToText";
import {
  assertImageAttachment,
  attachmentMarkdown,
  type Attachment,
} from "../lib/uploadAttachment";

type Props = {
  /**
   * Called when the user submits a message. Should not throw — the
   * composer optimistically clears the input and the caller is responsible
   * for marking failures (we don't roll back automatically).
   */
  onSend: (text: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  /** Auto-focus on mount. Default true. */
  autoFocus?: boolean;
  /**
   * Upload a chosen image. When provided, the attach button is enabled
   * and each image is appended as markdown so it shows in the thread
   * and reaches the agent as context.
   */
  uploadFile?: (file: File, index: number) => Promise<Attachment>;
};

const MAX_LENGTH = 4000;

export function ConversationComposer({
  onSend,
  disabled,
  disabledReason,
  autoFocus = true,
  uploadFile,
}: Props) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Append speech-recognized phrases to the textarea. We use a ref so the
  // hook's onFinal callback doesn't capture a stale setter.
  const appendTranscript = useCallback((chunk: string) => {
    const cleaned = chunk.trim();
    if (!cleaned) return;
    setValue((prev) => {
      if (!prev) return cleaned;
      const sep = /[.,;:!?\s]$/.test(prev) ? "" : " ";
      return `${prev}${sep}${cleaned}`;
    });
  }, []);

  const speech = useSpeechToText({ onFinal: appendTranscript });

  // Grow up to 8 rows.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24)}px`;
  }, [value]);

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0 || !uploadFile || disabled) return;
    setUploading(true);
    try {
      const chosen = Array.from(files);
      for (const file of chosen) assertImageAttachment(file);
      const uploaded = await Promise.all(
        chosen.map((file, i) => uploadFile(file, i)),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      toast.error("Couldn't attach image", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  function submit() {
    const text = value.trim();
    if (disabled || uploading) return;
    if (!text && attachments.length === 0) return;
    if (speech.listening) speech.stop();
    const parts = [text, ...attachments.map(attachmentMarkdown)].filter(Boolean);
    onSend(parts.join("\n\n"));
    setValue("");
    setAttachments([]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const tooLong = value.length > MAX_LENGTH;
  const canSend =
    !disabled && !uploading && !tooLong && (value.trim().length > 0 || attachments.length > 0);
  const placeholder = speech.listening
    ? speech.interimText || "Listening… speak now"
    : disabled
    ? disabledReason || "Cannot send right now"
    : "Write a message…";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="border-t border-border bg-background/60 px-3 py-3 backdrop-blur md:px-4"
      aria-disabled={disabled}
    >
      {attachments.length > 0 ? (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span
              key={a.url}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt="" className="h-5 w-5 rounded object-cover" />
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(a.url)}
                aria-label={`Remove ${a.name}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        {uploadFile ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              aria-label="Attach image"
              title="Attach image"
              onClick={() => fileInputRef.current?.click()}
              className="h-9 w-9 p-0"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
            </Button>
          </>
        ) : null}
        <div className="relative flex-1">
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            maxLength={MAX_LENGTH + 200}
            rows={1}
            aria-label="Message"
            className={cn(
              "min-h-[40px] resize-none py-2 pr-12 text-sm",
              tooLong && "border-destructive focus-visible:border-destructive",
              speech.listening && "border-primary/60 focus-visible:border-primary/60",
            )}
          />
          {value.length > MAX_LENGTH - 200 ? (
            <span
              className={cn(
                "pointer-events-none absolute bottom-1 right-2 font-mono text-[10px]",
                tooLong ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {value.length}/{MAX_LENGTH}
            </span>
          ) : null}
        </div>
        {speech.supported ? (
          <Button
            type="button"
            variant={speech.listening ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            aria-label={speech.listening ? "Pause dictation" : "Start dictation"}
            title={speech.listening ? "Pause dictation" : "Dictate with microphone"}
            onClick={speech.toggle}
            className={cn(
              "h-9 w-9 p-0",
              speech.listening && "animate-pulse",
            )}
          >
            {speech.listening ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : null}
        <Button
          type="submit"
          size="sm"
          disabled={!canSend}
          aria-label="Send"
          className="h-9"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      {speech.error ? (
        <p className="mx-auto mt-1 max-w-3xl px-1 text-[11px] text-destructive">
          Dictation error: {speech.error}
        </p>
      ) : disabled && disabledReason ? (
        <p className="mx-auto mt-1 max-w-3xl px-1 text-[11px] text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}
