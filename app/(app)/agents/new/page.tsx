"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  Cloud,
  Server,
  KeyRound,
  Sparkles,
  MessageSquare,
  Send,
  Hash,
  Bot,
  Layers,
  Megaphone,
  FlaskConical,
  PaintBucket,
  HeartPulse,
  Rocket,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Loader2,
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

type Hosting = "perkos" | "self";
type LLMMode = "perkos" | "byok";
type ApiProvider = "openai" | "anthropic" | "openrouter";

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

type Template = {
  id: string;
  name: string;
  description: string;
  icon: typeof Megaphone;
  plugins: string[];
};

const TEMPLATES: Template[] = [
  {
    id: "marketing",
    name: "Marketing Agent",
    description:
      "Drafts campaigns, schedules posts, monitors engagement, and reports on KPIs.",
    icon: Megaphone,
    plugins: ["copywriter", "scheduler", "analytics"],
  },
  {
    id: "research",
    name: "Research Agent",
    description:
      "Pulls academic papers, summarizes findings, and produces literature reviews.",
    icon: FlaskConical,
    plugins: ["arxiv", "summarizer", "citations"],
  },
  {
    id: "designer",
    name: "Designer Agent",
    description:
      "Generates moodboards, drafts visual concepts, and proposes design systems.",
    icon: PaintBucket,
    plugins: ["figma-bridge", "image-gen", "palette"],
  },
  {
    id: "health",
    name: "Health Adviser Agent",
    description:
      "Tracks habits, surfaces wellbeing tips, and integrates with health data sources.",
    icon: HeartPulse,
    plugins: ["fitbit", "nutrition-db", "wellness-coach"],
  },
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

const PROVIDERS: { id: ApiProvider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
];

type State = {
  step: number;
  agentType: AgentRuntime | null;
  hosting: Hosting | null;
  selfHostedIp: string;
  selfHostedSshKey: string;
  llmMode: LLMMode | null;
  apiProvider: ApiProvider;
  apiKey: string;
  channels: string[];
  templateId: string | null;
  plugins: string[];
  agentName: string;
};

const TOTAL_STEPS = 7;

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
    "agent.new.v1",
    {
      step: 1,
      agentType: null,
      hosting: null,
      selfHostedIp: "",
      selfHostedSshKey: "",
      llmMode: null,
      apiProvider: "openai",
      apiKey: "",
      channels: [],
      templateId: null,
      plugins: [],
      agentName: "",
    }
  );

  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet before launching an agent.");
      }
      if (!state.agentType) throw new Error("Pick an agent type.");
      const finalName = state.agentName.trim() || pickedTemplate?.name || "Untitled agent";
      const finalPlugins = Array.from(
        new Set([
          ...(pickedTemplate?.plugins ?? []),
          ...state.plugins,
          ...state.channels.map((c) => `channel:${c}`),
        ])
      );
      return launchAgent({
        walletAddress: address,
        runtime: state.agentType,
        name: finalName,
        plugins: finalPlugins,
        modelKey: state.llmMode === "byok" ? state.apiKey : undefined,
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
      if (fromOnboarding) markAgentRegistered();
      toast.success("Agent launched", {
        description: `${state.agentName.trim() || pickedTemplate?.name || "Your agent"} is ready.`,
      });
      clearDraft();
      // If the server returned credentials (new agents always do; legacy
      // path doesn't), defer the redirect — surface the one-shot reveal
      // modal first. The modal's "Done" handler does the redirect.
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

  const pickedTemplate = useMemo(
    () => TEMPLATES.find((t) => t.id === state.templateId) ?? null,
    [state.templateId]
  );

  const ipError = useMemo(() => {
    if (state.hosting !== "self") return undefined;
    if (state.selfHostedIp.trim().length === 0) return undefined;
    const parsed = ipv4Schema.safeParse(state.selfHostedIp);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  }, [state.hosting, state.selfHostedIp]);

  const sshError = useMemo(() => {
    if (state.hosting !== "self") return undefined;
    if (state.selfHostedSshKey.trim().length === 0) return undefined;
    const parsed = sshPublicKeySchema.safeParse(state.selfHostedSshKey);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  }, [state.hosting, state.selfHostedSshKey]);

  const apiKeyError = useMemo(() => {
    if (state.llmMode !== "byok") return undefined;
    if (state.apiKey.trim().length === 0) return undefined;
    return validateApiKey(state.apiProvider, state.apiKey) ?? undefined;
  }, [state.llmMode, state.apiProvider, state.apiKey]);

  const canAdvance = useMemo(() => {
    switch (state.step) {
      case 1:
        return state.agentType !== null;
      case 2:
        if (state.hosting === "perkos") return true;
        if (state.hosting === "self")
          return (
            state.selfHostedIp.trim().length > 0 &&
            state.selfHostedSshKey.trim().length > 0 &&
            !ipError &&
            !sshError
          );
        return false;
      case 3:
        if (state.llmMode === "perkos") return true;
        if (state.llmMode === "byok")
          return state.apiKey.trim().length > 0 && !apiKeyError;
        return false;
      case 4:
        return true;
      case 5:
        return state.templateId !== null;
      case 6:
        return true;
      case 7:
        return !mutation.isPending && !mutation.isSuccess;
      default:
        return false;
    }
  }, [state, mutation.isPending, mutation.isSuccess, ipError, sshError, apiKeyError]);

  const nextStep = () => update({ step: Math.min(state.step + 1, TOTAL_STEPS) });
  const prevStep = () => update({ step: Math.max(state.step - 1, 1) });

  const filteredChannels = state.agentType
    ? CHANNELS.filter((c) => c.runtimes.includes(state.agentType!))
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
        {state.step === 1 && (
          <Step1AgentType state={state} onChange={update} />
        )}
        {state.step === 2 && (
          <Step2Hosting
            state={state}
            onChange={update}
            ipError={ipError}
            sshError={sshError}
          />
        )}
        {state.step === 3 && (
          <Step3LLM
            state={state}
            onChange={update}
            apiKeyError={apiKeyError}
          />
        )}
        {state.step === 4 && (
          <Step4Channels state={state} onChange={update} channels={filteredChannels} />
        )}
        {state.step === 5 && (
          <Step5Template state={state} onChange={update} />
        )}
        {state.step === 6 && (
          <Step6Plugins state={state} onChange={update} />
        )}
        {state.step === 7 && (
          <Step7Summary
            state={state}
            template={pickedTemplate}
            onChange={update}
          />
        )}
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

function Step1AgentType({ state, onChange }: StepProps) {
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
        title="Choose an agent type"
        description="Pick the runtime that will execute your agent's workloads."
      />
      <RadioGroup
        value={state.agentType ?? ""}
        onValueChange={(v) => onChange({ agentType: v as AgentRuntime })}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {options.map((opt) => (
          <SelectableCard
            key={opt.value}
            selected={state.agentType === opt.value}
            onClick={() => onChange({ agentType: opt.value })}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium text-foreground">{opt.title}</span>
                <p className="text-sm text-muted-foreground">{opt.summary}</p>
              </div>
              <RadioGroupItem value={opt.value} id={`agent-${opt.value}`} />
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

function Step2Hosting({
  state,
  onChange,
  ipError,
  sshError,
}: StepProps & { ipError?: string; sshError?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Where should this agent run?"
        description="PerkOS manages the infra, or you bring your own VPS for full control."
      />
      <RadioGroup
        value={state.hosting ?? ""}
        onValueChange={(v) => onChange({ hosting: v as Hosting })}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <SelectableCard
          selected={state.hosting === "perkos"}
          onClick={() => onChange({ hosting: "perkos" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">PerkOS hosted</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Spin up the agent on PerkOS's managed runtime. Zero infra setup.
              </p>
            </div>
            <RadioGroupItem value="perkos" id="hosting-perkos" />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.hosting === "self"}
          onClick={() => onChange({ hosting: "self" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">Self-hosted</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Deploy on your own VPS. You provide the IP and SSH public key.
              </p>
            </div>
            <RadioGroupItem value="self" id="hosting-self" />
          </div>
        </SelectableCard>
      </RadioGroup>

      {state.hosting === "self" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">VPS access</CardTitle>
            <CardDescription>
              We use this to provision the runtime container on your machine.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vps-ip">Public IP address</Label>
              <Input
                id="vps-ip"
                value={state.selfHostedIp}
                onChange={(e) => onChange({ selfHostedIp: e.target.value })}
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
                value={state.selfHostedSshKey}
                onChange={(e) => onChange({ selfHostedSshKey: e.target.value })}
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
              <p className="text-xs text-muted-foreground">
                We never read or store private keys. Paste the public half only.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Step3LLM({
  state,
  onChange,
  apiKeyError,
}: StepProps & { apiKeyError?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Which LLM provider?"
        description="Use PerkOS-managed inference or bring your own API key."
      />
      <RadioGroup
        value={state.llmMode ?? ""}
        onValueChange={(v) => onChange({ llmMode: v as LLMMode })}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        <SelectableCard
          selected={state.llmMode === "perkos"}
          onClick={() => onChange({ llmMode: "perkos" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  PerkOS LLM Services
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Managed inference. Routed across providers, billed in your workspace.
              </p>
            </div>
            <RadioGroupItem value="perkos" id="llm-perkos" />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.llmMode === "byok"}
          onClick={() => onChange({ llmMode: "byok" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Bring your own key
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Use your OpenAI, Anthropic or OpenRouter API key directly.
              </p>
            </div>
            <RadioGroupItem value="byok" id="llm-byok" />
          </div>
        </SelectableCard>
      </RadioGroup>

      {state.llmMode === "byok" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API credentials</CardTitle>
            <CardDescription>
              We forward this key to your agent runtime. Keep it secret.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="api-provider">Provider</Label>
              <Select
                value={state.apiProvider}
                onValueChange={(v) => onChange({ apiProvider: v as ApiProvider })}
              >
                <SelectTrigger id="api-provider">
                  <SelectValue placeholder="Pick a provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="api-key">API key</Label>
              <Input
                id="api-key"
                value={state.apiKey}
                onChange={(e) => onChange({ apiKey: e.target.value })}
                placeholder="sk-…"
                type="password"
                aria-invalid={Boolean(apiKeyError)}
                aria-describedby={apiKeyError ? "api-key-error" : undefined}
              />
              {apiKeyError ? (
                <p id="api-key-error" className="text-xs text-destructive">
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

function Step4Channels({
  state,
  onChange,
  channels,
}: StepProps & { channels: Channel[] }) {
  const toggle = (id: string) => {
    const next = state.channels.includes(id)
      ? state.channels.filter((c) => c !== id)
      : [...state.channels, id];
    onChange({ channels: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="How should users reach this agent?"
        description="In addition to inside PerkOS, the agent can speak through external channels. Optional — pick any."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {channels.map((c) => {
          const Icon = c.icon;
          const active = state.channels.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div className="flex w-full items-start justify-between">
                <Icon className="h-5 w-5 text-primary" />
                {active ? <Check className="h-4 w-4 text-primary" /> : null}
              </div>
              <span className="text-sm font-medium text-foreground">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step5Template({ state, onChange }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Start from a template"
        description="Templates ship with a curated set of skills and prompts. You can change everything later."
      />
      <RadioGroup
        value={state.templateId ?? ""}
        onValueChange={(v) => onChange({ templateId: v })}
        className="grid grid-cols-1 gap-3 md:grid-cols-2"
      >
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          const selected = state.templateId === t.id;
          return (
            <SelectableCard
              key={t.id}
              selected={selected}
              onClick={() => onChange({ templateId: t.id })}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-foreground">{t.name}</span>
                    <RadioGroupItem value={t.id} id={`tpl-${t.id}`} />
                  </div>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.plugins.map((p) => (
                      <Badge key={p} variant="secondary" className="text-xs">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </SelectableCard>
          );
        })}
      </RadioGroup>
    </div>
  );
}

function Step6Plugins({ state, onChange }: StepProps) {
  const toggle = (id: string) => {
    const next = state.plugins.includes(id)
      ? state.plugins.filter((p) => p !== id)
      : [...state.plugins, id];
    onChange({ plugins: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Add plugins"
        description="Extra capabilities from the PerkOS marketplace. Skip if the template covers what you need."
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {PLUGINS.map((p) => {
          const active = state.plugins.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border p-4 text-left transition-colors",
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
              {active ? <Check className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step7Summary({
  state,
  template,
  onChange,
}: StepProps & { template: Template | null }) {
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Review and launch"
        description="One last check before sending the agent to the runtime."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name your agent</CardTitle>
          <CardDescription>
            Defaults to the template name. You can rename it later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              value={state.agentName}
              onChange={(e) => onChange({ agentName: e.target.value })}
              placeholder={template?.name ?? "Untitled agent"}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <SummaryRow label="Runtime" value={state.agentType ?? "—"} icon={Bot} />
          <SummaryRow
            label="Hosting"
            value={
              state.hosting === "self"
                ? `Self-hosted (${state.selfHostedIp || "no IP yet"})`
                : "PerkOS hosted"
            }
            icon={state.hosting === "self" ? Server : Cloud}
          />
          <SummaryRow
            label="LLM"
            value={
              state.llmMode === "byok"
                ? `BYOK · ${PROVIDERS.find((p) => p.id === state.apiProvider)?.label}`
                : "PerkOS LLM Services"
            }
            icon={state.llmMode === "byok" ? KeyRound : Sparkles}
          />
          <SummaryRow
            label="Channels"
            value={
              state.channels.length === 0
                ? "PerkOS only"
                : state.channels
                    .map((id) => CHANNELS.find((c) => c.id === id)?.label ?? id)
                    .join(", ")
            }
            icon={MessageSquare}
          />
          <SummaryRow
            label="Template"
            value={template?.name ?? "—"}
            icon={template?.icon ?? Sparkles}
          />
          <SummaryRow
            label="Plugins"
            value={
              state.plugins.length === 0
                ? "Template defaults only"
                : `${state.plugins.length} extra plugin${state.plugins.length === 1 ? "" : "s"}`
            }
            icon={Layers}
          />
        </CardContent>
      </Card>
    </div>
  );
}

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
        <span className="uppercase tracking-wide text-xs">{label}</span>
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
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(236,27,105,0.18)]"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}
