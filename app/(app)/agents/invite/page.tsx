"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Loader2, UserPlus } from "lucide-react";

import { inviteAgent, type InviteAgentResult } from "../../../lib/perkosApi";

type RuntimeKind = "hermes" | "openclaw" | "custom";

const RUNTIMES: { id: RuntimeKind; label: string; hint: string }[] = [
  { id: "hermes", label: "Hermes", hint: "/v1/responses" },
  { id: "openclaw", label: "OpenClaw", hint: "/v1/chat/completions" },
  { id: "custom", label: "Custom", hint: "your own HTTP runtime" },
];

const NAME_RE = /^[a-zA-Z0-9_-]{2,32}$/;

export default function InviteAgentPage() {
  const [name, setName] = useState("");
  const [runtimeKind, setRuntimeKind] = useState<RuntimeKind>("custom");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<InviteAgentResult | null>(null);

  const nameError = name.length > 0 && !NAME_RE.test(name)
    ? "2-32 chars, letters/numbers/_/- only"
    : undefined;

  const mutation = useMutation({
    mutationFn: () => inviteAgent({ name: name.trim(), runtimeKind, note: note.trim() || undefined }),
    onSuccess: (data) => setResult(data),
  });

  const canSubmit = NAME_RE.test(name) && !mutation.isPending;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/agents"
        className="flex w-fit items-center gap-2 text-sm text-[#7975a8] transition-colors hover:text-[#ececff]"
      >
        <ArrowLeft className="h-4 w-4" /> Agents
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-[#ececff]">Invite an external agent</h1>
        <p className="max-w-xl text-sm text-[#7975a8]">
          Already have your own agent, with its own knowledge? Invite it to your
          organization. PerkOS provisions nothing — you get a prompt to hand to
          your agent so it connects via perkos-a2a + perkos-chat and joins your
          projects, with full job-board access like a native agent.
        </p>
      </header>

      {result ? (
        <InviteResult result={result} />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
          className="flex flex-col gap-5 rounded-md border border-[#1b1833] bg-[#0e0716] p-5"
        >
          <Field label="Agent name (handle)" hint="How it's known on the relay + in chat. Must be unique.">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-research-agent"
              autoFocus
              className="w-full rounded-md border border-[#1b1833] bg-[#06030d] px-3 py-2 text-sm text-[#ececff] outline-none focus:border-[#ec1b69]"
            />
            {nameError ? <span className="text-xs text-[#ec1b69]">{nameError}</span> : null}
          </Field>

          <Field label="Runtime" hint="What your agent speaks — sets the bridge endpoint in the prompt.">
            <div className="flex flex-wrap gap-2">
              {RUNTIMES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRuntimeKind(r.id)}
                  className={`flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors ${
                    runtimeKind === r.id
                      ? "border-[#ec1b69] bg-[#ec1b69]/10"
                      : "border-[#1b1833] bg-[#06030d] hover:border-[#7975a8]/40"
                  }`}
                >
                  <span className="text-sm text-[#ececff]">{r.label}</span>
                  <span className="text-[10px] text-[#7975a8]">{r.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Note for the agent (optional)" hint="Context the agent sees in its invitation prompt.">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="You'll help the team with market research and weekly reports."
              className="w-full rounded-md border border-[#1b1833] bg-[#06030d] px-3 py-2 text-sm text-[#ececff] outline-none focus:border-[#ec1b69]"
            />
          </Field>

          {mutation.isError ? (
            <p className="rounded-md border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-3 py-2 text-xs text-[#ec1b69]">
              {mutation.error instanceof Error ? mutation.error.message : "Invite failed"}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-fit items-center gap-2 rounded-md bg-[#ec1b69] px-5 py-2.5 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {mutation.isPending ? "Creating invitation…" : "Generate invitation"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-[#ececff]">{label}</span>
      {hint ? <span className="text-xs text-[#7975a8]">{hint}</span> : null}
      {children}
    </label>
  );
}

function InviteResult({ result }: { result: InviteAgentResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        <Check className="h-4 w-4 text-emerald-300" />
        <span>
          <span className="font-medium">{result.agentName}</span> registered in your org. It shows as
          <span className="font-medium"> invited</span> until it connects.
        </span>
      </div>

      <div className="rounded-md border border-[#1b1833] bg-[#0e0716] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#ececff]">Invitation prompt</h2>
          <CopyButton text={result.invitePrompt} label="Copy prompt" />
        </div>
        <p className="mb-3 text-xs text-[#7975a8]">
          Paste this to your agent. It contains its credential (relayApiKey) — treat it like a
          password and only give it to the agent you&apos;re inviting.
        </p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#1b1833] bg-[#06030d] p-3 text-[11px] leading-relaxed text-[#c9c6f0]">
          {result.invitePrompt}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/agents"
          className="rounded-md border border-[#1b1833] px-4 py-2 text-sm text-[#ececff] transition-colors hover:border-[#7975a8]/50"
        >
          Done — back to agents
        </Link>
        <CopyButton text={result.relayApiKey} label="Copy relayApiKey" subtle />
      </div>
    </div>
  );
}

function CopyButton({ text, label, subtle }: { text: string; label: string; subtle?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — ignore */
        }
      }}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${
        subtle
          ? "border border-[#1b1833] text-[#7975a8] hover:text-[#ececff]"
          : "bg-[#ec1b69] text-[#ececff] hover:opacity-90"
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
