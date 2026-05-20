"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
};

const MAX_LENGTH = 4000;

export function ConversationComposer({
  onSend,
  disabled,
  disabledReason,
  autoFocus = true,
}: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Grow up to 8 rows.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const tooLong = value.length > MAX_LENGTH;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="border-t border-border bg-background/60 px-3 py-3 backdrop-blur md:px-4"
      aria-disabled={disabled}
    >
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              disabled
                ? disabledReason || "Cannot send right now"
                : "Write a message…"
            }
            disabled={disabled}
            autoFocus={autoFocus}
            maxLength={MAX_LENGTH + 200}
            rows={1}
            aria-label="Message"
            className={cn(
              "min-h-[40px] resize-none py-2 pr-12 text-sm",
              tooLong && "border-destructive focus-visible:border-destructive",
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
        <Button
          type="submit"
          size="sm"
          disabled={disabled || !value.trim() || tooLong}
          aria-label="Send"
          className="h-9"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      {disabled && disabledReason ? (
        <p className="mx-auto mt-1 max-w-3xl px-1 text-[11px] text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}
