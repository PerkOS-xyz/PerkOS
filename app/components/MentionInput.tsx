"use client";

import { useRef, useState } from "react";

import { Bot, User } from "lucide-react";

import type { MentionParticipant } from "../lib/mentions";

/**
 * Textarea with `@`-mention autocomplete. Typing `@` (at start or after a
 * space) opens a participant picker; selecting one inserts `@<label> `.
 * Enter sends (unless the picker is open → it selects); Shift+Enter newlines.
 * The PARENT extracts the structured mention ids on send via extractMentions.
 */
export function MentionInput({
  value,
  onChange,
  onSend,
  participants,
  placeholder,
  disabled,
  rows = 2,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  participants: MentionParticipant[];
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [anchor, setAnchor] = useState(0); // index of the "@"
  const [hi, setHi] = useState(0);

  const matches =
    query === null
      ? []
      : participants
          .filter((p) =>
            p.label.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 6);
  const open = query !== null && matches.length > 0;

  function recompute(v: string, caret: number) {
    const before = v.slice(0, caret);
    const m = /(^|\s)@([^\s@]*)$/.exec(before);
    if (m) {
      setQuery(m[2] ?? "");
      setAnchor(caret - (m[2]?.length ?? 0) - 1); // position of "@"
      setHi(0);
    } else {
      setQuery(null);
    }
  }

  function pick(p: MentionParticipant) {
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = `${value.slice(0, anchor)}@${p.label} ${value.slice(caret)}`;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = anchor + p.label.length + 2;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  return (
    <div className="relative">
      {open ? (
        <div className="absolute bottom-full z-20 mb-1 w-64 overflow-hidden rounded-md border border-[#1b1833] bg-[#0e0716] shadow-lg">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm ${
                i === hi ? "bg-[#1b1833] text-[#ececff]" : "text-[#a9a4d4]"
              }`}
            >
              {p.kind === "agent" ? (
                <Bot className="h-3.5 w-3.5 text-[#ec1b69]" />
              ) : (
                <User className="h-3.5 w-3.5 text-emerald-300" />
              )}
              <span className="truncate">@{p.label}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-[#4f4b6e]">
                {p.kind}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ref}
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={
          className ??
          "w-full resize-y rounded-md border border-[#1b1833] bg-[#0a0511] px-3 py-2 text-sm text-[#ececff] outline-none placeholder:text-[#4f4b6e] focus:border-[#ec1b69]/50"
        }
        onChange={(e) => {
          onChange(e.target.value);
          recompute(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => (h + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => (h - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[hi] ?? matches[0]!);
            } else if (e.key === "Escape") {
              setQuery(null);
            }
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) onSend();
          }
        }}
      />
    </div>
  );
}
