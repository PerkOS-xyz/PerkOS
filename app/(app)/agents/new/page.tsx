"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  ChevronDown,
  ChevronUp,
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
import {
  ipv4Schema,
  sshPublicKeySchema,
  validateApiKey,
} from "../../../lib/validators";
import {
  AGENT_PRESETS,
  findPreset,
  presetSystemPrompt,
  type SoulFields,
} from "../../../lib/agentPresets";
import {
  buildConfigPreview,
  byokProviderOptions,
  type LLMSource,
} from "../../../lib/agentConfigPreview";
import { fetchActiveRuntimes, type RuntimeImage } from "../../../lib/runtimeImages";
import { fetchEcsAccess } from "../../../lib/ecsAccess";
import { useQuery } from "@tanstack/react-query";

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

// Per-user access to "PerkOS infra (AWS ECS)" is decided by
// /api/access/ecs-check, which reads /ecs_allowlist + super-admins. The
// wizard hydrates the flag via fetchEcsAccess() below and propagates it
// to Step 3. The card shows "Coming soon" for wallets that aren't on the
// list, which today is everyone except super-admins + manually allowed
// design partners. Public access opens with billing (x402 monthly).

type State = {
  step: number;
  // Step 1 — persona
  personaId: string | null;
  agentName: string;
  systemPromptOverride: string;
  // Step 2 — runtime
  runtime: AgentRuntime | null;
  /** Specific image tag the admin has activated for this runtime. Set
   *  alongside `runtime` when the user picks a card. Used by
   *  /api/agents/launch when provisioning on PerkOS infra. */
  imageTag: string | null;
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

  // Resolve ECS access for the signed-in user. While loading, treat as
  // disallowed so the wizard never optimistically shows ECS as available
  // and then snaps it away. Refetch on window focus so an admin granting
  // access in another tab unblocks the wizard without a hard refresh.
  const ecsAccessQuery = useQuery({
    queryKey: ["access", "ecs"],
    queryFn: fetchEcsAccess,
    staleTime: 60_000,
  });
  const ecsAllowed = ecsAccessQuery.data?.allowed === true;

  // Wizard state is intentionally NOT persisted to localStorage. Earlier
  // we used useFormDraft here, but it created a confusing UX after the
  // two-state Step-1 refactor: returning to /agents/new would drop the
  // user into the detail view of their last-picked persona without the
  // picker grid visible, instead of letting them start fresh. Each visit
  // begins with a clean wizard at Step 1.
  const [state, setState] = useState<State>({
    step: 1,
    personaId: null,
    agentName: "",
    systemPromptOverride: "",
    runtime: null,
    imageTag: null,
    deployMode: null,
    vpsIp: "",
    vpsSshKey: "",
    llmSource: null,
    byokProvider: "",
    byokModel: "",
    byokApiKey: "",
    channels: [],
    plugins: [],
  });

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
        // Only meaningful for PerkOS-ECS deploys; the launch endpoint
        // ignores it for VPS / Local.
        imageTag: state.deployMode === "perkos-ecs" ? state.imageTag : null,
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
      if (fromOnboarding) markAgentRegistered();
      toast.success("Agent launched", {
        description: `${state.agentName.trim() || preset?.name || "Your agent"} is ready.`,
      });
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
        if (state.deployMode === "perkos-ecs") return ecsAllowed;
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
  }, [state, mutation.isPending, mutation.isSuccess, ipError, sshError, apiKeyError, ecsAllowed]);

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
            ecsAllowed={ecsAllowed}
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  // Default prompt = full SOUL.md rendered from preset, with the user's
  // chosen agent name baked into the header. The override (textarea
  // content the user has typed) wins if non-empty.
  const defaultPrompt = preset ? presetSystemPrompt(preset, state.agentName) : "";

  // Two-state flow per the UX research: picker (grid) OR detail (focused
  // hero + form), never both. Picking a persona is the most emotionally
  // weighty action in the wizard, so the chosen avatar gets the screen.
  if (preset) {
    return (
      <div className="flex flex-col gap-5">
        {/* "Change persona" affordance — 44px tap target, only escape
         *  back to the grid. Clears soul-prompt override so re-picking
         *  starts fresh; keeps any agent-name the user typed. */}
        <button
          type="button"
          onClick={() => {
            setShowAdvanced(false);
            onChange({ personaId: null, systemPromptOverride: "" });
          }}
          className="inline-flex min-h-11 -ml-2 items-center gap-1.5 self-start px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Change persona
        </button>

        {/* Hero — large 240px avatar centered, name as bold label. */}
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "relative h-60 w-60 overflow-hidden rounded-2xl bg-muted/30 ring-4 ring-primary shadow-[0_0_28px_rgba(236,27,105,0.28)]",
              preset.avatarFit === "contain" && "p-8"
            )}
          >
            {preset.avatar ? (
              <Image
                src={preset.avatar}
                alt={`${preset.name} portrait`}
                fill
                sizes="240px"
                className={
                  preset.avatarFit === "contain"
                    ? "object-contain p-4"
                    : "object-cover"
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-7xl">
                {preset.emoji}
              </div>
            )}
          </div>
          <p className="text-xl font-semibold text-foreground">{preset.name}</p>
          <p className="-mt-1 text-center text-xs text-muted-foreground">
            {preset.blurb}
          </p>
          {preset.soul.identity ? (
            <p className="max-w-md text-center text-sm italic leading-relaxed text-foreground/80">
              {preset.soul.identity}
            </p>
          ) : null}
        </div>

        {/* Form */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="agent-name" className="text-xs text-muted-foreground">
            Agent name
          </Label>
          <Input
            id="agent-name"
            value={state.agentName}
            onChange={(e) => onChange({ agentName: e.target.value })}
            placeholder={preset.name}
            className="h-10"
          />
        </div>

        {/* System prompt — collapsed by default so the Continue button
         *  stays in view and users don't get lost in the markdown. Edit
         *  indicator surfaces when the user has typed an override so they
         *  can find their work without having to expand to check. */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
          >
            {showPrompt ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {showPrompt ? "Hide" : "Show"} system prompt
            {state.systemPromptOverride &&
            state.systemPromptOverride !== defaultPrompt ? (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                edited
              </span>
            ) : null}
          </button>
          {showPrompt ? (
            <>
              <Label
                htmlFor="system-prompt"
                className="sr-only"
              >
                System prompt
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Becomes SOUL.md / IDENTITY.md inside the runtime container.
              </p>
              <Textarea
                id="system-prompt"
                value={state.systemPromptOverride || defaultPrompt}
                onChange={(e) =>
                  onChange({ systemPromptOverride: e.target.value })
                }
                rows={5}
                className="font-mono text-xs"
                placeholder="You are a …"
              />
              {state.systemPromptOverride &&
              state.systemPromptOverride !== defaultPrompt ? (
                <button
                  type="button"
                  className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  onClick={() => onChange({ systemPromptOverride: "" })}
                >
                  Reset to the {preset.name} default
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        {preset.id !== "custom" ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
            >
              {showAdvanced ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Advanced — {showAdvanced ? "hide" : "view"} full soul
            </button>
            {showAdvanced ? <SoulDetailCard soul={preset.soul} /> : null}
          </div>
        ) : null}
      </div>
    );
  }

  // Picker state — 2 cols mobile / 3 md / 4 lg so the cinematic portrait
  // detail reads (3 cols at 412px was too small to see persona character).
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Pick your Agent"
        description="Choose the agent you want to work with. Each one ships with a name, a soul, and a recommended skill set — all editable later."
      />

      <div
        role="radiogroup"
        aria-label="Choose an agent persona"
        className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4"
      >
        {AGENT_PRESETS.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={false}
            type="button"
            onClick={() =>
              onChange({
                personaId: p.id,
                agentName: state.agentName || p.name,
                systemPromptOverride: "",
              })
            }
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors",
              "hover:border-primary/40",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            )}
          >
            <div className="relative aspect-square w-full bg-muted/20">
              {p.avatar ? (
                <Image
                  src={p.avatar}
                  alt={`${p.name} — ${p.blurb}`}
                  fill
                  sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 48vw"
                  className={
                    p.avatarFit === "contain"
                      ? "object-contain p-6"
                      : "object-cover"
                  }
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl">
                  {p.emoji}
                </div>
              )}
            </div>
            <span className="w-full truncate px-2 py-1.5 text-center text-xs font-medium text-foreground">
              {p.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SoulDetailCard — expanded view of a preset's SoulFields, shown when the
// user clicks "Advanced" in Step 1. Read-only; the underlying SOUL.md is
// edited via the system-prompt textarea above.
// ---------------------------------------------------------------------------

function SoulDetailCard({ soul }: { soul: SoulFields }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
      {soul.identity ? (
        <SoulSection title="Identity">
          <p className="text-sm italic text-foreground">{soul.identity}</p>
        </SoulSection>
      ) : null}

      {soul.coreTruths.length > 0 ? (
        <SoulSection title="Core Truths">
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {soul.coreTruths.map((t) => (
              <li key={t.principle}>
                <span className="font-medium text-foreground">{t.principle}.</span>{" "}
                {t.explanation}
              </li>
            ))}
          </ul>
        </SoulSection>
      ) : null}

      {soul.worldview.length > 0 ? (
        <SoulSection title="Worldview">
          <div className="flex flex-col gap-2">
            {soul.worldview.map((w) => (
              <div key={w.domain}>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground">
                  {w.domain}
                </p>
                <ul className="ml-4 list-disc text-sm text-muted-foreground">
                  {w.opinions.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SoulSection>
      ) : null}

      {soul.voice.length > 0 ? (
        <SoulSection title="Communication Style">
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            {soul.voice.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </SoulSection>
      ) : null}

      {soul.expertise.primary ||
      soul.expertise.fluentIn.length > 0 ||
      soul.expertise.defersOn.length > 0 ? (
        <SoulSection title="Expertise">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {soul.expertise.primary ? (
              <p>
                <span className="font-medium text-foreground">Primary:</span>{" "}
                {soul.expertise.primary}
              </p>
            ) : null}
            {soul.expertise.fluentIn.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">Fluent in:</span>{" "}
                {soul.expertise.fluentIn.join(", ")}
              </p>
            ) : null}
            {soul.expertise.defersOn.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">Defers on:</span>{" "}
                {soul.expertise.defersOn.join(", ")}
              </p>
            ) : null}
          </div>
        </SoulSection>
      ) : null}

      {soul.boundaries.length > 0 ? (
        <SoulSection title="Boundaries">
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            {soul.boundaries.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </SoulSection>
      ) : null}

      {soul.memoryPolicy.remember.length > 0 ||
      soul.memoryPolicy.dontRemember.length > 0 ? (
        <SoulSection title="Memory Policy">
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            {soul.memoryPolicy.remember.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">Remember:</span>{" "}
                {soul.memoryPolicy.remember.join("; ")}.
              </p>
            ) : null}
            {soul.memoryPolicy.dontRemember.length > 0 ? (
              <p>
                <span className="font-medium text-foreground">
                  Don&apos;t remember:
                </span>{" "}
                {soul.memoryPolicy.dontRemember.join("; ")}.
              </p>
            ) : null}
          </div>
        </SoulSection>
      ) : null}

      {soul.petPeeves.length > 0 ? (
        <SoulSection title="Pet Peeves">
          <ul className="ml-4 list-disc text-sm text-muted-foreground">
            {soul.petPeeves.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </SoulSection>
      ) : null}
    </div>
  );
}

function SoulSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">
        {title}
      </h4>
      {children}
    </div>
  );
}

// Static marketing copy per runtime kind. Merged with the dynamic image
// list pulled from the admin's curation.
const RUNTIME_COPY: Record<AgentRuntime, {
  title: string;
  summary: string;
  bullets: string[];
}> = {
  OpenClaw: {
    title: "OpenClaw",
    summary: "Autonomous executor focused on long-running, tool-driven workflows.",
    bullets: [
      "Strong at multi-step task execution",
      "Built-in browser and code-runner tooling",
      "Best for research, automation, and ops",
    ],
  },
  Hermes: {
    title: "Hermes",
    summary: "Conversational + tooling agent optimized for fast interactive replies.",
    bullets: [
      "Optimized for chat-driven workflows",
      "Strong message-routing across channels",
      "Best for customer ops and creative work",
    ],
  },
};

function Step2Runtime({ state, onChange }: StepProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wizard", "runtimes"],
    queryFn: fetchActiveRuntimes,
  });

  // Build the option list dynamically: a runtime kind only appears if the
  // admin has activated ≥1 image for it. The first (newest) active image
  // becomes the default imageTag when the user selects the card.
  const options: { runtime: AgentRuntime; latest: RuntimeImage }[] = [];
  if (data) {
    if (data.openclaw.length > 0) options.push({ runtime: "OpenClaw", latest: data.openclaw[0] });
    if (data.hermes.length > 0) options.push({ runtime: "Hermes", latest: data.hermes[0] });
  }

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Choose a runtime"
        description="Both work with PerkOS-Transport, swarm coordination, and the Council. The version shown for each is the one the PerkOS team has approved for this release."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading available runtimes…</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load runtimes. {error instanceof Error ? error.message : ""}
        </p>
      ) : options.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No runtimes available</CardTitle>
            <CardDescription>
              The admin hasn&apos;t activated any runtime images yet. Check back
              shortly, or reach out to the team.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <RadioGroup
          value={state.runtime ?? ""}
          onValueChange={(v) => {
            const opt = options.find((o) => o.runtime === v);
            onChange({
              runtime: v as AgentRuntime,
              imageTag: opt?.latest.primaryTag ?? null,
            });
          }}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {options.map(({ runtime, latest }) => {
            const copy = RUNTIME_COPY[runtime];
            return (
              <SelectableCard
                key={runtime}
                selected={state.runtime === runtime}
                onClick={() =>
                  onChange({ runtime, imageTag: latest.primaryTag })
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-medium text-foreground">{copy.title}</span>
                    <p className="text-sm text-muted-foreground">{copy.summary}</p>
                  </div>
                  <RadioGroupItem value={runtime} id={`runtime-${runtime}`} />
                </div>
                <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {copy.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">
                    {latest.displayName ?? latest.primaryTag}
                  </Badge>
                  <span className="truncate font-mono">{latest.primaryTag}</span>
                </div>
              </SelectableCard>
            );
          })}
        </RadioGroup>
      )}
    </div>
  );
}

function Step3Deploy({
  state,
  onChange,
  ipError,
  sshError,
  ecsAllowed,
}: StepProps & { ipError?: string; sshError?: string; ecsAllowed: boolean }) {
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
            ecsAllowed && onChange({ deployMode: "perkos-ecs" })
          }
          disabled={!ecsAllowed}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  PerkOS infra (AWS ECS)
                </span>
                {!ecsAllowed ? (
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
              {!ecsAllowed ? (
                <p className="text-xs text-muted-foreground">
                  Currently invite-only while we test. Pick VPS or Local for
                  now, or contact an admin to be added to the early access
                  list.
                </p>
              ) : null}
            </div>
            <RadioGroupItem value="perkos-ecs" id="deploy-ecs" disabled={!ecsAllowed} />
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
          <SummaryRow
            label="Runtime"
            value={
              state.runtime
                ? state.imageTag
                  ? `${state.runtime} · ${state.imageTag}`
                  : state.runtime
                : "—"
            }
            icon={Bot}
          />
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
