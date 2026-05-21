"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  Cloud,
  Server,
  Laptop,
  KeyRound,
  Sparkles,
  MessageSquare,
  Send,
  Hash,
  Bot,
  Layers,
  Rocket,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Loader2,
  FileCode,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  launchAgent,
  type AgentRuntime,
  type LaunchAgentCredentials,
} from "../../../lib/perkosApi";
import { AgentKeyRevealDialog } from "../../../components/AgentKeyRevealDialog";
import { useOnboarding } from "../../../lib/onboardingState";
import { useFormDraft } from "../../../lib/useFormDraft";
import {
  ipv4Schema,
  sshPublicKeySchema,
  validateApiKey,
} from "../../../lib/validators";
import { AGENT_PRESETS, findPreset } from "../../../lib/agentPresets";
import {
  buildConfigPreview,
  byokProviderOptions,
  type LLMSource,
} from "../../../lib/agentConfigPreview";

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

type DeployMode = "perkos-ecs" | "vps" | "local";

type Channel = {
  id: string;
  label: string;
  icon: typeof MessageSquare;
  runtimes: AgentRuntime[];
};

const CHANNELS: Channel[] = [
  { id: "telegram", label: "Telegram", icon: Send, runtimes: ["Hermes", "OpenClaw"] },
  { id: "discord", label: "Discord", icon: Hash, runtimes: ["Hermes", "OpenClaw"] },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare, runtimes: ["Hermes", "OpenClaw"] },
  { id: "slack", label: "Slack", icon: MessageSquare, runtimes: ["Hermes", "OpenClaw"] },
  { id: "x", label: "X / Twitter", icon: MessageSquare, runtimes: ["Hermes"] },
  { id: "email", label: "Email", icon: MessageSquare, runtimes: ["Hermes", "OpenClaw"] },
];

type Plugin = { id: string; label: string; description: string };

const PLUGINS: Plugin[] = [
  { id: "web-search", label: "Web search", description: "Lets the agent search the public web." },
  { id: "code-runner", label: "Code runner", description: "Sandboxed Python / Node execution." },
  { id: "vector-memory", label: "Vector memory", description: "Long-term recall via pgvector." },
  { id: "github", label: "GitHub integration", description: "Issues, PRs, code review." },
  { id: "notion", label: "Notion sync", description: "Read and write to Notion workspaces." },
  { id: "calendar", label: "Calendar", description: "Schedule and inspect calendar events." },
  { id: "drive", label: "Google Drive", description: "Search, read, and update Drive files." },
  { id: "browser", label: "Headless browser", description: "Navigate sites and capture content." },
];

// PerkOS ECS infra is being provisioned. Flip to true once the AWS cluster +
// task definitions + entry-point Docker images are live.
const ECS_AVAILABLE = false;

type State = {
  step: number;
  // Step 1 — persona
  personaId: string | null;
  agentName: string;
  systemPromptOverride: string;
  // Step 2 — runtime
  runtime: AgentRuntime | null;
  // Step 3 — deploy mode
  deployMode: DeployMode | null;
  vpsIp: string;
  vpsSshKey: string;
  // Step 4 — LLM
  llmSource: LLMSource | null;
  byokProvider: string;
  byokModel: string;
  byokApiKey: string;
  // Step 5 — plugins + channels
  channels: string[];
  plugins: string[];
};

const TOTAL_STEPS = 6;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentLauncherPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { address, isConnected } = useConnection();
  const { markAgentRegistered } = useOnboarding();
  const fromOnboarding = searchParams.get("from") === "onboarding";

  const [issuedCredentials, setIssuedCredentials] =
    useState<LaunchAgentCredentials | null>(null);

  const [state, setState, clearDraft] = useFormDraft<State>(
    "agent.new.v2",
    {
      step: 1,
      personaId: null,
      agentName: "",
      systemPromptOverride: "",
      runtime: null,
      deployMode: null,
      vpsIp: "",
      vpsSshKey: "",
      llmSource: null,
      byokProvider: "",
      byokModel: "",
      byokApiKey: "",
      channels: [],
      plugins: [],
    }
  );

  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  const preset = useMemo(() => findPreset(state.personaId), [state.personaId]);

  // When the user picks a runtime, seed a sensible default BYOK provider.
  useEffect(() => {
    if (state.runtime && !state.byokProvider) {
      const opts = byokProviderOptions(state.runtime);
      if (opts.length > 0) update({ byokProvider: opts[0].id, byokModel: opts[0].defaultModel });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.runtime]);

  // Pre-fill recommended plugins from the preset when picked.
  useEffect(() => {
    if (preset && state.plugins.length === 0 && preset.recommendedPlugins.length > 0) {
      update({ plugins: preset.recommendedPlugins });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet before launching an agent.");
      }
      if (!state.runtime) throw new Error("Pick a runtime.");
      const finalName = state.agentName.trim() || preset?.name || "Untitled agent";
      const finalPlugins = Array.from(
        new Set([
          ...state.plugins,
          ...state.channels.map((c) => `channel:${c}`),
        ])
      );
      return launchAgent({
        walletAddress: address,
        runtime: state.runtime,
        name: finalName,
        plugins: finalPlugins,
        modelKey: state.llmSource === "byok" ? state.byokApiKey : undefined,
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
      if (fromOnboarding) markAgentRegistered();
      toast.success("Agent launched", {
        description: `${state.agentName.trim() || preset?.name || "Your agent"} is ready.`,
      });
      clearDraft();
      if (response?.credentials) {
        setIssuedCredentials(response.credentials);
        return;
      }
      router.replace(fromOnboarding ? "/dashboard" : "/agents");
    },
    onError: (err: Error) => {
      toast.error("Launch failed", { description: err.message });
    },
  });

  const ipError = useMemo(() => {
    if (state.deployMode !== "vps") return undefined;
    if (state.vpsIp.trim().length === 0) return undefined;
    const parsed = ipv4Schema.safeParse(state.vpsIp);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  }, [state.deployMode, state.vpsIp]);

  const sshError = useMemo(() => {
    if (state.deployMode !== "vps") return undefined;
    if (state.vpsSshKey.trim().length === 0) return undefined;
    const parsed = sshPublicKeySchema.safeParse(state.vpsSshKey);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  }, [state.deployMode, state.vpsSshKey]);

  const apiKeyError = useMemo(() => {
    if (state.llmSource !== "byok") return undefined;
    if (state.byokApiKey.trim().length === 0) return undefined;
    // Reuse provider-specific validator; falls back to a generic check for
    // ollama / openrouter / etc.
    const provider = state.byokProvider;
    if (provider === "openai" || provider === "anthropic" || provider === "openrouter") {
      return validateApiKey(provider, state.byokApiKey) ?? undefined;
    }
    return undefined;
  }, [state.llmSource, state.byokProvider, state.byokApiKey]);

  const canAdvance = useMemo(() => {
    switch (state.step) {
      case 1:
        return state.personaId !== null;
      case 2:
        return state.runtime !== null;
      case 3:
        if (state.deployMode === "local") return true;
        if (state.deployMode === "perkos-ecs") return ECS_AVAILABLE;
        if (state.deployMode === "vps")
          return (
            state.vpsIp.trim().length > 0 &&
            state.vpsSshKey.trim().length > 0 &&
            !ipError &&
            !sshError
          );
        return false;
      case 4:
        if (state.llmSource === "perkos") return true;
        if (state.llmSource === "skip") return true;
        if (state.llmSource === "byok")
          return state.byokApiKey.trim().length > 0 && !apiKeyError;
        return false;
      case 5:
        return true; // plugins + channels are optional
      case 6:
        return !mutation.isPending && !mutation.isSuccess;
      default:
        return false;
    }
  }, [state, mutation.isPending, mutation.isSuccess, ipError, sshError, apiKeyError]);

  const nextStep = () => update({ step: Math.min(state.step + 1, TOTAL_STEPS) });
  const prevStep = () => update({ step: Math.max(state.step - 1, 1) });

  const filteredChannels = state.runtime
    ? CHANNELS.filter((c) => c.runtimes.includes(state.runtime!))
    : CHANNELS;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/agents"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Go back to Agent team
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">Launch agent</h1>
        <p className="text-sm text-muted-foreground">
          Step {state.step} of {TOTAL_STEPS}
        </p>
      </div>

      <Stepper current={state.step} total={TOTAL_STEPS} />

      <div className="mt-2">
        {state.step === 1 && <Step1Persona state={state} onChange={update} />}
        {state.step === 2 && <Step2Runtime state={state} onChange={update} />}
        {state.step === 3 && (
          <Step3Deploy
            state={state}
            onChange={update}
            ipError={ipError}
            sshError={sshError}
          />
        )}
        {state.step === 4 && (
          <Step4LLM state={state} onChange={update} apiKeyError={apiKeyError} />
        )}
        {state.step === 5 && (
          <Step5Plugins
            state={state}
            onChange={update}
            channels={filteredChannels}
          />
        )}
        {state.step === 6 && <Step6Review state={state} onChange={update} />}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={state.step === 1 || mutation.isPending}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        {state.step < TOTAL_STEPS ? (
          <Button onClick={nextStep} disabled={!canAdvance}>
            Continue
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canAdvance}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {mutation.isPending ? "Launching…" : "Launch agent"}
          </Button>
        )}
      </div>

      <AgentKeyRevealDialog
        open={!!issuedCredentials}
        credentials={issuedCredentials}
        onClose={() => {
          setIssuedCredentials(null);
          router.replace(fromOnboarding ? "/dashboard" : "/agents");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex w-full items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={i} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-medium transition-colors",
                active &&
                  "border-primary bg-primary text-primary-foreground shadow-[0_0_8px_rgba(236,27,105,0.5)]",
                done && "border-primary bg-primary/20 text-primary",
                !active && !done && "border-border text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : idx}
            </span>
            {i < total - 1 ? (
              <span
                className={cn(
                  "h-px flex-1 transition-colors",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

type StepProps = {
  state: State;
  onChange: (patch: Partial<State>) => void;
};

function Step1Persona({ state, onChange }: StepProps) {
  const preset = findPreset(state.personaId);
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Pick a persona"
        description="Seeds a name, system prompt, and recommended skill set. Everything is editable later."
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {AGENT_PRESETS.map((p) => {
          const selected = state.personaId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onChange({
                  personaId: p.id,
                  agentName: state.agentName || p.name,
                  systemPromptOverride: "",
                })
              }
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(236,27,105,0.18)]"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-2xl leading-none">{p.emoji}</span>
                {selected ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
              </div>
              <span className="text-sm font-medium text-foreground">{p.name}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {p.blurb}
              </span>
            </button>
          );
        })}
      </div>

      {preset ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent name + prompt</CardTitle>
            <CardDescription>
              Tweak the preset's defaults if you want.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="agent-name">Agent name</Label>
              <Input
                id="agent-name"
                value={state.agentName}
                onChange={(e) => onChange({ agentName: e.target.value })}
                placeholder={preset.name}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="system-prompt">System prompt</Label>
              <Textarea
                id="system-prompt"
                value={state.systemPromptOverride || preset.systemPrompt}
                onChange={(e) =>
                  onChange({ systemPromptOverride: e.target.value })
                }
                rows={5}
                className="font-mono text-xs"
                placeholder="You are a …"
              />
              {state.systemPromptOverride &&
              state.systemPromptOverride !== preset.systemPrompt ? (
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => onChange({ systemPromptOverride: "" })}
                >
                  Reset to the {preset.name} default
                </button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Step2Runtime({ state, onChange }: StepProps) {
  const options: {
    value: AgentRuntime;
    title: string;
    summary: string;
    bullets: string[];
  }[] = [
    {
      value: "OpenClaw",
      title: "OpenClaw",
      summary: "Autonomous executor focused on long-running, tool-driven workflows.",
      bullets: [
        "Strong at multi-step task execution",
        "Built-in browser and code-runner tooling",
        "Best for research, automation, and ops",
      ],
    },
    {
      value: "Hermes",
      title: "Hermes",
      summary: "Conversational + tooling agent optimized for fast interactive replies.",
      bullets: [
        "Optimized for chat-driven workflows",
        "Strong message-routing across channels",
        "Best for customer ops and creative work",
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Choose a runtime"
        description="Both work with PerkOS-Transport, swarm coordination, and the Council. Pick the one your agent will be most native to."
      />
      <RadioGroup
        value={state.runtime ?? ""}
        onValueChange={(v) => onChange({ runtime: v as AgentRuntime })}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {options.map((opt) => (
          <SelectableCard
            key={opt.value}
            selected={state.runtime === opt.value}
            onClick={() => onChange({ runtime: opt.value })}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-foreground">{opt.title}</span>
                <p className="text-sm text-muted-foreground">{opt.summary}</p>
              </div>
              <RadioGroupItem value={opt.value} id={`runtime-${opt.value}`} />
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
              {opt.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </SelectableCard>
        ))}
      </RadioGroup>
    </div>
  );
}

function Step3Deploy({
  state,
  onChange,
  ipError,
  sshError,
}: StepProps & { ipError?: string; sshError?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Where should this agent run?"
        description="Pick a deploy mode. You can move the agent later — only the credential changes."
      />
      <RadioGroup
        value={state.deployMode ?? ""}
        onValueChange={(v) => onChange({ deployMode: v as DeployMode })}
        className="flex flex-col gap-3"
      >
        <SelectableCard
          selected={state.deployMode === "perkos-ecs"}
          onClick={() =>
            ECS_AVAILABLE && onChange({ deployMode: "perkos-ecs" })
          }
          disabled={!ECS_AVAILABLE}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  PerkOS infra (AWS ECS)
                </span>
                {!ECS_AVAILABLE ? (
                  <Badge
                    variant="secondary"
                    className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    Coming soon
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                  Recommended
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                PerkOS provisions a Fargate task for your agent. From{" "}
                <span className="font-medium text-foreground">$29/mo</span>{" "}
                billed via x402 on Base. Status flips to "ready" once the
                container is healthy (~30s).
              </p>
            </div>
            <RadioGroupItem value="perkos-ecs" id="deploy-ecs" disabled={!ECS_AVAILABLE} />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.deployMode === "vps"}
          onClick={() => onChange({ deployMode: "vps" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Run on a VPS I own
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Paste an SSH endpoint + key. PerkOS pushes the install script
                and watches the bridge come online.
              </p>
            </div>
            <RadioGroupItem value="vps" id="deploy-vps" />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.deployMode === "local"}
          onClick={() => onChange({ deployMode: "local" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Run on my machine
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                PerkOS issues a relay credential. Paste it into your local
                OpenClaw or Hermes config and restart. No infra required.
              </p>
            </div>
            <RadioGroupItem value="local" id="deploy-local" />
          </div>
        </SelectableCard>
      </RadioGroup>

      {state.deployMode === "vps" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">VPS access</CardTitle>
            <CardDescription>
              We use this to push the install script. Public key only — we
              never read or store your private key.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vps-ip">Public IP address</Label>
              <Input
                id="vps-ip"
                value={state.vpsIp}
                onChange={(e) => onChange({ vpsIp: e.target.value })}
                placeholder="203.0.113.42"
                inputMode="numeric"
                aria-invalid={Boolean(ipError)}
                aria-describedby={ipError ? "vps-ip-error" : undefined}
              />
              {ipError ? (
                <p id="vps-ip-error" className="text-xs text-destructive">
                  {ipError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vps-ssh">SSH public key</Label>
              <Textarea
                id="vps-ssh"
                value={state.vpsSshKey}
                onChange={(e) => onChange({ vpsSshKey: e.target.value })}
                placeholder="ssh-ed25519 AAAA…"
                rows={4}
                className="font-mono text-xs"
                aria-invalid={Boolean(sshError)}
                aria-describedby={sshError ? "vps-ssh-error" : undefined}
              />
              {sshError ? (
                <p id="vps-ssh-error" className="text-xs text-destructive">
                  {sshError}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Step4LLM({
  state,
  onChange,
  apiKeyError,
}: StepProps & { apiKeyError?: string }) {
  const providerOpts = state.runtime ? byokProviderOptions(state.runtime) : [];
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="LLM source"
        description="Pick how the agent reaches its model. Each runtime gets a config block in its native shape — preview on the review step."
      />
      <RadioGroup
        value={state.llmSource ?? ""}
        onValueChange={(v) => onChange({ llmSource: v as LLMSource })}
        className="flex flex-col gap-3"
      >
        <SelectableCard
          selected={state.llmSource === "perkos"}
          onClick={() => onChange({ llmSource: "perkos" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  PerkOS LLM service
                </span>
                <Badge variant="secondary" className="border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                  Included in your plan
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Managed Ollama-compatible gateway at{" "}
                <code className="rounded bg-muted px-1 font-mono text-[11px]">
                  api.llm.perkos.xyz
                </code>{" "}
                — kimi-k2.6:cloud + qwen 7B/14B. No key needed; we issue one
                scoped to your agent.
              </p>
            </div>
            <RadioGroupItem value="perkos" id="llm-perkos" />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.llmSource === "byok"}
          onClick={() => onChange({ llmSource: "byok" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Bring your own key (BYOK)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Use your own provider key. We forward it to the agent runtime
                — never log or proxy your traffic.
              </p>
            </div>
            <RadioGroupItem value="byok" id="llm-byok" />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.llmSource === "skip"}
          onClick={() => onChange({ llmSource: "skip" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Configure later
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Agent boots without an LLM source. Useful for testing
                transport + tool calls only.
              </p>
            </div>
            <RadioGroupItem value="skip" id="llm-skip" />
          </div>
        </SelectableCard>
      </RadioGroup>

      {state.llmSource === "byok" && state.runtime ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {state.runtime === "OpenClaw"
                ? "OpenClaw provider settings"
                : "Hermes provider settings"}
            </CardTitle>
            <CardDescription>
              {state.runtime === "OpenClaw"
                ? "Fields map 1:1 to a block under models.providers.* in openclaw.json."
                : "Fields map to provider.* + secrets.* in your Hermes profile's config.yaml."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="byok-provider">Provider</Label>
              <Select
                value={state.byokProvider}
                onValueChange={(v) => {
                  const id = v ?? "";
                  const opt = providerOpts.find((p) => p.id === id);
                  onChange({
                    byokProvider: id,
                    byokModel: opt?.defaultModel ?? "",
                  });
                }}
              >
                <SelectTrigger id="byok-provider">
                  <SelectValue placeholder="Pick a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providerOpts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="byok-model">Default model</Label>
              <Input
                id="byok-model"
                value={state.byokModel}
                onChange={(e) => onChange({ byokModel: e.target.value })}
                placeholder="claude-sonnet-4-5"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="byok-key">API key</Label>
              <Input
                id="byok-key"
                value={state.byokApiKey}
                onChange={(e) => onChange({ byokApiKey: e.target.value })}
                placeholder="sk-…"
                type="password"
                aria-invalid={Boolean(apiKeyError)}
                aria-describedby={apiKeyError ? "byok-key-error" : undefined}
              />
              {apiKeyError ? (
                <p id="byok-key-error" className="text-xs text-destructive">
                  {apiKeyError}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Step5Plugins({
  state,
  onChange,
  channels,
}: StepProps & { channels: Channel[] }) {
  const togglePlugin = (id: string) => {
    const next = state.plugins.includes(id)
      ? state.plugins.filter((p) => p !== id)
      : [...state.plugins, id];
    onChange({ plugins: next });
  };
  const toggleChannel = (id: string) => {
    const next = state.channels.includes(id)
      ? state.channels.filter((c) => c !== id)
      : [...state.channels, id];
    onChange({ channels: next });
  };

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Plugins + channels"
        description="Optional. The preset already recommends a few — add more or fewer as you see fit."
      />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">Capabilities</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {PLUGINS.map((p) => {
            const active = state.plugins.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlugin(p.id)}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                      active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.description}</span>
                  </div>
                </div>
                {active ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Plus className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">External channels</h3>
        <p className="text-xs text-muted-foreground">
          Where users can also reach this agent, in addition to inside PerkOS.
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {channels.map((c) => {
            const Icon = c.icon;
            const active = state.channels.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleChannel(c.id)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="flex w-full items-start justify-between">
                  <Icon className="h-4 w-4 text-primary" />
                  {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </div>
                <span className="text-sm font-medium text-foreground">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Step6Review({ state, onChange }: StepProps) {
  const preset = findPreset(state.personaId);
  const finalName = state.agentName.trim() || preset?.name || "Untitled agent";
  const preview = state.runtime
    ? buildConfigPreview({
        runtime: state.runtime,
        agentName: finalName,
        llmSource: state.llmSource ?? "skip",
        byokProvider: state.byokProvider,
        modelId: state.byokModel,
      })
    : null;

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Review + launch"
        description="What we'll write to disk (or to your ECS task) when you click Launch."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <SummaryRow label="Persona" value={preset?.name ?? "—"} icon={Sparkles} />
          <SummaryRow label="Agent name" value={finalName} icon={Bot} />
          <SummaryRow label="Runtime" value={state.runtime ?? "—"} icon={Bot} />
          <SummaryRow
            label="Deploy"
            value={
              state.deployMode === "perkos-ecs"
                ? "PerkOS infra (AWS ECS)"
                : state.deployMode === "vps"
                  ? `VPS · ${state.vpsIp || "no IP yet"}`
                  : state.deployMode === "local"
                    ? "Local machine"
                    : "—"
            }
            icon={
              state.deployMode === "perkos-ecs"
                ? Cloud
                : state.deployMode === "vps"
                  ? Server
                  : Laptop
            }
          />
          <SummaryRow
            label="LLM"
            value={
              state.llmSource === "perkos"
                ? "PerkOS LLM service"
                : state.llmSource === "byok"
                  ? `BYOK · ${state.byokProvider} · ${state.byokModel}`
                  : "Configure later"
            }
            icon={
              state.llmSource === "byok"
                ? KeyRound
                : state.llmSource === "perkos"
                  ? Sparkles
                  : FileCode
            }
          />
          <SummaryRow
            label="Plugins"
            value={
              state.plugins.length === 0
                ? "None"
                : `${state.plugins.length} plugin${state.plugins.length === 1 ? "" : "s"}`
            }
            icon={Layers}
          />
          <SummaryRow
            label="Channels"
            value={
              state.channels.length === 0
                ? "PerkOS only"
                : state.channels.join(", ")
            }
            icon={MessageSquare}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode className="h-4 w-4 text-primary" />
            Config preview
            <Badge variant="secondary" className="font-mono text-[10px]">
              {preview?.language ?? "—"}
            </Badge>
          </CardTitle>
          <CardDescription>
            This is the literal block that will be written to{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">
              {preview?.configPath ?? "—"}
            </code>{" "}
            on the agent host.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-72 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-foreground">
            {preview?.content ?? ""}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rename or skip</CardTitle>
          <CardDescription>
            Pre-filled from the persona; tweak here for one-off launches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-name-review">Agent name</Label>
            <Input
              id="agent-name-review"
              value={state.agentName}
              onChange={(e) => onChange({ agentName: e.target.value })}
              placeholder={preset?.name ?? "Untitled agent"}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Bot;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <span className="max-w-[60%] text-right text-foreground">{value}</span>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-medium text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SelectableCard({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(236,27,105,0.18)]"
          : "border-border bg-card hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-60 hover:border-border"
      )}
    >
      {children}
    </button>
  );
}
