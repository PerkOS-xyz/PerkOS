"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bot,
  Folder,
  ListTodo,
  Loader2,
  Mic,
  Paperclip,
  Pause,
  Plus,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useSpeechToText } from "../lib/useSpeechToText";
import { attachmentMarkdown, type Attachment } from "../lib/uploadAttachment";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  className?: string;
  /**
   * Upload a chosen file and resolve to its attachment. When provided, the
   * attach button is enabled; the composer appends each attachment to the
   * message body as markdown on send. Parent supplies it because it knows
   * the wallet + conversation scope.
   */
  uploadFile?: (file: File, index: number) => Promise<Attachment>;
};

type SlashCommand = {
  id: string;
  trigger: string;
  label: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  action?: "clear";
};

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "task",
    trigger: "/task",
    label: "Create task",
    description: "Open the task creator.",
    icon: ListTodo,
    href: "/tasks/new",
  },
  {
    id: "project",
    trigger: "/project",
    label: "Create project",
    description: "Open the project creator.",
    icon: Folder,
    href: "/projects/new",
  },
  {
    id: "agent",
    trigger: "/agent",
    label: "Launch agent",
    description: "Start the 7-step agent launcher.",
    icon: Bot,
    href: "/agents/new",
  },
  {
    id: "perkos",
    trigger: "/perkos",
    label: "Open PerkOS Agent",
    description: "Get help from the in-app assistant.",
    icon: Sparkles,
    href: "/chat",
  },
  {
    id: "clear",
    trigger: "/clear",
    label: "Clear conversation",
    description: "Reset this chat history.",
    icon: Trash2,
    action: "clear",
  },
];

function matchCommands(input: string): SlashCommand[] {
  if (!input.startsWith("/")) return [];
  const query = input.slice(1).toLowerCase().split(/\s+/)[0] ?? "";
  return SLASH_COMMANDS.filter((c) =>
    c.trigger.slice(1).toLowerCase().startsWith(query),
  );
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onClear,
  placeholder = "Write a message…",
  disabled,
  sending,
  className,
  uploadFile,
}: Props) {
  const router = useRouter();
  const [slashIndex, setSlashIndex] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dictation (Web Speech API). Appends transcribed phrases to the input.
  const speech = useSpeechToText({
    onFinal: (chunk) => {
      const cleaned = chunk.trim();
      if (!cleaned) return;
      const sep = !value || /[.,;:!?\s]$/.test(value) ? "" : " ";
      onChange(`${value}${sep}${cleaned}`);
    },
  });

  const slashMatches = useMemo(() => matchCommands(value), [value]);
  const slashOpen = slashMatches.length > 0;

  useEffect(() => {
    if (slashIndex >= slashMatches.length) setSlashIndex(0);
  }, [slashIndex, slashMatches.length]);

  function runCommand(cmd: SlashCommand) {
    if (cmd.action === "clear") {
      onClear?.();
      onChange("");
      return;
    }
    if (cmd.href) {
      router.push(cmd.href);
      onChange("");
    }
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0 || !uploadFile) return;
    setUploading(true);
    try {
      const chosen = Array.from(files);
      const uploaded = await Promise.all(
        chosen.map((file, i) => uploadFile(file, i)),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      toast.error("Upload failed", {
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

  const canSend =
    !disabled &&
    !sending &&
    !uploading &&
    (value.trim().length > 0 || attachments.length > 0);

  function send(text: string) {
    if (!canSend) return;
    const parts = [text.trim(), ...attachments.map(attachmentMarkdown)].filter(
      Boolean,
    );
    onSend(parts.join("\n\n"));
    setAttachments([]);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (slashOpen) {
      runCommand(slashMatches[slashIndex]);
      return;
    }
    send(value);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (slashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, slashMatches.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        runCommand(slashMatches[slashIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onChange("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(value);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {speech.error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Dictation: {speech.error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="relative">
        {slashOpen ? (
          <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <ul role="listbox" aria-label="Slash commands">
              {slashMatches.map((cmd, idx) => {
                const Icon = cmd.icon;
                const active = idx === slashIndex;
                return (
                  <li key={cmd.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setSlashIndex(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => runCommand(cmd)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="font-mono text-xs text-foreground">
                          {cmd.trigger}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {cmd.description}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((a) => (
              <span
                key={a.url}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
              >
                {a.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt=""
                    className="h-5 w-5 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                )}
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

        <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          {uploadFile ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              <button
                type="button"
                aria-label="Attach files"
                disabled={disabled || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                title="Attach files"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label="Attach"
              disabled
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground/60"
              title="Attachments coming soon"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={speech.listening ? (speech.interimText || "Listening…") : placeholder}
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex shrink-0 items-center gap-1">
            {speech.supported ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={speech.toggle}
                disabled={disabled || sending}
                className={cn(
                  "h-8 w-8 rounded-full text-muted-foreground hover:text-primary",
                  speech.listening &&
                    "animate-pulse bg-primary/10 text-primary",
                )}
                aria-label={speech.listening ? "Pause dictation" : "Dictate"}
                title={
                  speech.listening
                    ? "Pause dictation"
                    : "Dictate with microphone"
                }
              >
                {speech.listening ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            ) : null}
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              className="h-8 w-8 rounded-full"
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
