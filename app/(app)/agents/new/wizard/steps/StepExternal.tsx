"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { InviteAgentResult } from "@/app/lib/perkosApi";

import type { RuntimeKindChoice, StepProps } from "../types";
import { EXTERNAL_NAME_RE } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { SelectableCard } from "../ui/SelectableCard";

const RUNTIME_KINDS: { id: RuntimeKindChoice; label: string; hint: string }[] = [
  { id: "hermes", label: "Hermes", hint: "/v1/responses" },
  { id: "openclaw", label: "OpenClaw", hint: "/v1/chat/completions" },
  { id: "custom", label: "Custom", hint: "your own HTTP runtime" },
];

// The external branch. The agent already exists — we register it + return an
// onboarding prompt (inviteAgent). The page's primary button triggers the
// invite mutation; once it resolves, `result` swaps the form for the prompt.
export function StepExternal({
  state,
  onChange,
  result,
}: StepProps & { result: InviteAgentResult | null }) {
  if (result) return <InviteResult result={result} />;

  const name = state.agentName;
  const nameError =
    name.length > 0 && !EXTERNAL_NAME_RE.test(name)
      ? "2–32 chars, letters/numbers/_/- only"
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Invite your existing agent"
        description="Nothing about your runtime, memory, or tools changes — your agent just connects OUT to PerkOS (perkos-a2a + perkos-chat) and gains your org's chat and job board."
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="ext-name" className="text-sm text-foreground">
          Agent name (handle)
        </Label>
        <span className="text-xs text-muted-foreground">
          How it&apos;s known on the relay + in chat. Must be unique.
        </span>
        <Input
          id="ext-name"
          value={name}
          onChange={(e) => onChange({ agentName: e.target.value })}
          placeholder="my-research-agent"
          aria-invalid={Boolean(nameError)}
        />
        {nameError ? <span className="text-xs text-destructive">{nameError}</span> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm text-foreground">Runtime</Label>
        <span className="text-xs text-muted-foreground">
          What your agent speaks — sets the bridge endpoint in the prompt.
        </span>
        <RadioGroup
          value={state.runtimeKind ?? ""}
          onValueChange={(v) => onChange({ runtimeKind: v as RuntimeKindChoice })}
          className="grid grid-cols-1 gap-2 md:grid-cols-3"
        >
          {RUNTIME_KINDS.map((r) => (
            <SelectableCard
              key={r.id}
              selected={state.runtimeKind === r.id}
              onClick={() => onChange({ runtimeKind: r.id })}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{r.label}</span>
                  <span className="text-[10px] text-muted-foreground">{r.hint}</span>
                </div>
                <RadioGroupItem value={r.id} id={`ext-rk-${r.id}`} />
              </div>
            </SelectableCard>
          ))}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ext-note" className="text-sm text-foreground">
          Note for the agent (optional)
        </Label>
        <span className="text-xs text-muted-foreground">
          Context the agent sees in its invitation prompt.
        </span>
        <Textarea
          id="ext-note"
          value={state.externalNote}
          onChange={(e) => onChange({ externalNote: e.target.value })}
          rows={3}
          placeholder="You'll help the team with market research and weekly reports."
        />
      </div>
    </div>
  );
}

function InviteResult({ result }: { result: InviteAgentResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        <Check className="h-4 w-4 text-emerald-300" />
        <span>
          <span className="font-medium">{result.agentName}</span> registered in your
          org. It shows as <span className="font-medium">invited</span> until it
          connects.
        </span>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Invitation prompt</h2>
          <CopyButton text={result.invitePrompt} label="Copy prompt" />
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Paste this to your agent. It contains its credential (relayApiKey) — treat
          it like a password and only give it to the agent you&apos;re inviting.
        </p>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/50 p-3 text-[11px] leading-relaxed text-foreground">
          {result.invitePrompt}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CopyButton text={result.relayApiKey} label="Copy relayApiKey" subtle />
      </div>
    </div>
  );
}

function CopyButton({
  text,
  label,
  subtle,
}: {
  text: string;
  label: string;
  subtle?: boolean;
}) {
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
      className={
        subtle
          ? "flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          : "flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-opacity hover:opacity-90"
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
