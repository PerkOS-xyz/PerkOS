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
  Plus,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VoiceCapture = {
  blob: Blob;
  duration: number;
  durationLabel: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onVoiceCapture?: (capture: VoiceCapture) => void;
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  className?: string;
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

// Speech-to-text uses the shared hook. The existing voice-note machinery
// (MediaRecorder + audio blob capture) remains in place but the visible
// Mic button now triggers dictation, which the user actually finds useful
// (the voice-note path only produced a text marker and was never wired
// to a real audio handler in callers).
import { useSpeechToText } from "../lib/useSpeechToText";

function matchCommands(input: string): SlashCommand[] {
  if (!input.startsWith("/")) return [];
  const query = input.slice(1).toLowerCase().split(/\s+/)[0] ?? "";
  return SLASH_COMMANDS.filter((c) =>
    c.trigger.slice(1).toLowerCase().startsWith(query)
  );
}

function formatRecordingTime(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onVoiceCapture,
  onClear,
  placeholder = "Write a message…",
  disabled,
  sending,
  className,
}: Props) {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  // Dictation (Web Speech API). Appends transcribed phrases to the input.
  const speech = useSpeechToText({
    onFinal: (chunk) => {
      const cleaned = chunk.trim();
      if (!cleaned) return;
      const sep = !value || /[.,;:!?\s]$/.test(value) ? "" : " ";
      onChange(`${value}${sep}${cleaned}`);
    },
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;
    onSend(trimmed);
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
        setSlashIndex((i) => (i + 1) % slashMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex(
          (i) => (i - 1 + slashMatches.length) % slashMatches.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(value);
    }
  }

  function cleanupStream() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }

  async function startRecording() {
    setRecordError(null);
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordError("Voice recording isn't supported on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(
        () => setRecordSeconds((s) => s + 1),
        1000
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Microphone permission was denied.";
      setRecordError(message);
      cleanupStream();
      setRecording(false);
    }
  }

  function stopRecordingAndSend() {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    const duration = recordSeconds;
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const durationLabel = formatRecordingTime(duration);
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.info(
          "[ChatComposer] Voice note captured",
          { duration, sizeBytes: blob.size, type: blob.type }
        );
      }
      if (onVoiceCapture) {
        onVoiceCapture({ blob, duration, durationLabel });
      } else {
        // Fallback: send as a text marker so the message surfaces in the chat.
        onSend(`🎤 Voice note · ${durationLabel}`);
      }
      cleanupStream();
      setRecording(false);
      setRecordSeconds(0);
    };
    mr.stop();
  }

  function cancelRecording() {
    const mr = mediaRecorderRef.current;
    if (mr) {
      mr.onstop = null;
      try {
        mr.stop();
      } catch {
        // ignore
      }
    }
    cleanupStream();
    setRecording(false);
    setRecordSeconds(0);
  }

  useEffect(() => {
    return () => cleanupStream();
  }, []);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {recordError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {recordError}
        </p>
      ) : null}

      {recording ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary/10 px-3 py-2">
          <button
            type="button"
            onClick={cancelRecording}
            aria-label="Cancel recording"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium text-foreground">
              Recording…
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatRecordingTime(recordSeconds)}
            </span>
          </div>
          <Button
            type="button"
            size="icon"
            onClick={stopRecordingAndSend}
            className="h-8 w-8 rounded-full"
            aria-label="Stop and send"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      ) : (
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
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
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

          <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <button
              type="button"
              aria-label="Attach"
              disabled
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground/60"
              title="Attachments coming soon"
            >
              <Plus className="h-4 w-4" />
            </button>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKey}
              placeholder={placeholder}
              rows={1}
              disabled={disabled}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            {speech.supported && value.trim().length === 0 ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={speech.toggle}
                disabled={disabled || sending}
                className={cn(
                  "h-8 w-8 rounded-full text-muted-foreground hover:text-primary",
                  speech.listening && "animate-pulse text-primary",
                )}
                aria-label={speech.listening ? "Stop dictation" : "Dictate"}
                title={speech.listening ? "Stop dictation" : "Dictate with microphone"}
              >
                <Mic className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={disabled || sending}
                className="h-8 w-8 rounded-full"
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
