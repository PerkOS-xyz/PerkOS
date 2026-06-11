"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useChainId, useConnection } from "wagmi";
import { base, celo } from "wagmi/chains";
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
  Rocket,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Loader2,
  FileCode,
  ChevronDown,
  ChevronUp,
  PackageOpen,
  ExternalLink,
  GitFork,
  ShieldAlert,
  ShieldCheck,
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

import { AgentOrb } from "../../../components/AgentOrb";
import { agentVisual } from "../../../lib/agentVisuals";
import {
  launchAgent,
  saveAgentGateway,
  type AgentRuntime,
  type DeployBundle,
  type LaunchAgentCredentials,
} from "../../../lib/perkosApi";
import { AgentKeyRevealDialog } from "../../../components/AgentKeyRevealDialog";
import { DeployBundleScreen } from "../../../components/DeployBundleScreen";
import { useOnboarding } from "../../../lib/onboardingState";
import {
  // ipv4Schema + sshPublicKeySchema removed in 0.2 — the BYO flow no
  // longer collects an SSH endpoint, the bridge dials OUT instead.
  validateApiKey,
} from "../../../lib/validators";
import {
  AGENT_PRESETS,
  findPreset,
  presetSystemPrompt,
  type AgentPreset,
  type SoulFields,
} from "../../../lib/agentPresets";
import { fetchVisiblePresets } from "../../../lib/agentPresetAccess";
import {
  SKILLS_CATALOG,
  findSkillPack,
  parseUserRepo,
  runtimeCompatLabel,
  type SkillPack,
} from "../../../lib/skillsCatalog";
import {
  buildConfigPreview,
  byokBaseUrl,
  byokProviderOptions,
  type LLMSource,
} from "../../../lib/agentConfigPreview";
import { fetchActiveRuntimes, type RuntimeImage } from "../../../lib/runtimeImages";
import { fetchEcsAccess } from "../../../lib/ecsAccess";
import { fetchLlmAccess } from "../../../lib/llmAccess";
import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

// 0.2.0 deploy modes. "perkos-ecs" stays as the wizard-side label for
// the platform-managed Fargate path (the wire value sent to the API is
// "perkos-managed"). The old "vps" / "local" options are dead — both
// are folded into "self-hosted" because the bridge dials out either
// way, and "imported" is the new mode for users who already have a
// runtime process running and only need the bridge sidecar.
type DeployMode = "perkos-ecs" | "self-hosted" | "imported";

// Only set for imported flows — tells the API which A2A_RUNTIME shape
// the bridge should speak (`hermes-api` / `openclaw` / `custom`).
type RuntimeKindChoice = "hermes" | "openclaw" | "custom";

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
  // For "imported" deploy mode: which runtime API the bridge talks to.
  runtimeKind: RuntimeKindChoice | null;
  // For "imported" deploy mode: HERMES_API_URL override (when the
  // user's runtime is not on the default port).
  importedHermesApiUrl: string;
  // Step 4 — LLM
  llmSource: LLMSource | null;
  byokProvider: string;
  byokModel: string;
  byokApiKey: string;
  // Step 5 — plugins + channels
  channels: string[];
  plugins: string[];
  // Step 5 — open-source skill packs. `skills` holds selected pack ids
  // (catalog + community). `communitySkills` keeps the user-pasted packs
  // so their cards keep rendering after selection.
  skills: string[];
  communitySkills: SkillPack[];
  // Step 5 — messaging gateways. Each enabled entry is POSTed to
  // /api/agents/{agentId}/gateways right after launchAgent returns,
  // using the agentId from the launch response. Keeping the secrets
  // in client memory ONLY until that POST completes; never persisted
  // to localStorage and never sent in the launch payload itself.
  gatewayTelegramEnabled: boolean;
  gatewayTelegramBotToken: string;
  gatewayTelegramWebhookUrl: string;
  gatewayFarcasterEnabled: boolean;
  gatewayFarcasterNeynarApiKey: string;
  gatewayFarcasterSignerUuid: string;
  gatewayFarcasterWebhookSecret: string;
  gatewayFarcasterFid: string;
  gatewayFarcasterReplyVisibility: string;
  gatewayFarcasterParentChannel: string;
  gatewaySlackEnabled: boolean;
  gatewaySlackBotToken: string;
  gatewaySlackSigningSecret: string;
  gatewaySlackChannelId: string;
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

  // 0.2.0 — for self-hosted + imported deploys the API returns a
  // deployBundle next to the credentials. We capture both so the
  // post-launch screen can render either the legacy key-reveal dialog
  // (perkos-managed) or the new bundle + polling screen (BYO).
  const [issuedBundle, setIssuedBundle] = useState<{
    bundle: DeployBundle;
    agentId: string;
    agentName: string;
    deployMode: "self-hosted" | "imported";
    relayApiKey: string;
  } | null>(null);

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

  // Same pattern for the "PerkOS LLM service" gate in Step 4. Until
  // billing lands, only allowlisted wallets see it as a selectable option;
  // everyone else gets the "Coming soon" badge + a disabled card.
  const llmAccessQuery = useQuery({
    queryKey: ["access", "llm"],
    queryFn: fetchLlmAccess,
    staleTime: 60_000,
  });
  const llmAllowed = llmAccessQuery.data?.allowed === true;

  // Templates visible to this viewer, with admin property overrides merged.
  // Falls back to the full static catalogue while loading / on error so the
  // picker never goes blank. Drives both the Step-1 grid and the `preset`
  // lookup below (so name / recommended-plugins overrides flow into launch).
  const presetsQuery = useQuery({
    queryKey: ["wizard", "presets"],
    queryFn: fetchVisiblePresets,
    staleTime: 60_000,
  });
  const visiblePresets = presetsQuery.data ?? AGENT_PRESETS;

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
    runtimeKind: null,
    importedHermesApiUrl: "",
    llmSource: null,
    byokProvider: "",
    byokModel: "",
    byokApiKey: "",
    channels: [],
    plugins: [],
    skills: [],
    communitySkills: [],
    gatewayTelegramEnabled: false,
    gatewayTelegramBotToken: "",
    gatewayTelegramWebhookUrl: "",
    gatewayFarcasterEnabled: false,
    gatewayFarcasterNeynarApiKey: "",
    gatewayFarcasterSignerUuid: "",
    gatewayFarcasterWebhookSecret: "",
    gatewayFarcasterFid: "",
    gatewayFarcasterReplyVisibility: "mentions",
    gatewayFarcasterParentChannel: "",
    gatewaySlackEnabled: false,
    gatewaySlackBotToken: "",
    gatewaySlackSigningSecret: "",
    gatewaySlackChannelId: "",
  });

  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  const preset = useMemo(
    () =>
      visiblePresets.find((p) => p.id === state.personaId) ??
      findPreset(state.personaId),
    [visiblePresets, state.personaId],
  );

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

  // Pre-fill recommended skill packs from the preset when picked. Same
  // guard as plugins so a returning user's manual choice isn't clobbered.
  useEffect(() => {
    if (preset && state.skills.length === 0 && preset.recommendedSkills?.length) {
      update({ skills: preset.recommendedSkills });
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
      // Translate wizard-side mode labels to the API wire shape.
      const wireMode: "perkos-managed" | "self-hosted" | "imported" =
        state.deployMode === "perkos-ecs"
          ? "perkos-managed"
          : state.deployMode === "self-hosted"
            ? "self-hosted"
            : "imported";
      // SOUL.md to ship: the user's edited override wins, else the
      // rendered preset soul (with the chosen name baked into the header).
      const soul = state.systemPromptOverride?.trim()
        ? state.systemPromptOverride
        : preset
          ? presetSystemPrompt(preset, finalName)
          : "";
      return launchAgent({
        walletAddress: address,
        runtime: state.runtime,
        name: finalName,
        plugins: finalPlugins,
        soul: soul || undefined,
        skills: state.skills.length ? state.skills : undefined,
        modelKey: state.llmSource === "byok" ? state.byokApiKey : undefined,
        // BYOK: point the runtime at the chosen provider's OpenAI-compatible
        // endpoint + model. Without these the launch route would ship the BYOK
        // key to the PerkOS gateway with the ollama protocol (→ 401/wrong API).
        llmBaseUrl:
          state.llmSource === "byok"
            ? byokBaseUrl(state.byokProvider)
            : undefined,
        llmModel:
          state.llmSource === "byok"
            ? state.byokModel.trim() || undefined
            : undefined,
        // Only meaningful for the perkos-managed (ECS) path; the launch
        // endpoint ignores it for self-hosted / imported.
        imageTag: state.deployMode === "perkos-ecs" ? state.imageTag : null,
        deployMode: wireMode,
        runtimeKind:
          wireMode === "imported" && state.runtimeKind
            ? state.runtimeKind
            : undefined,
        hermesApiUrl:
          wireMode === "imported" && state.importedHermesApiUrl.trim().length > 0
            ? state.importedHermesApiUrl.trim()
            : undefined,
      });
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
      if (fromOnboarding) markAgentRegistered();
      // The launch route may auto-uniquify the name — a wallet can own several
      // agents of the same persona ("Researcher", "Researcher-2", …) — so show
      // the name the server actually assigned, and flag it when it was changed.
      const requestedName =
        state.agentName.trim() || preset?.name || "Your agent";
      const launchedName = response?.result?.agent?.name || requestedName;
      toast.success("Agent launched", {
        description:
          launchedName !== requestedName
            ? `Saved as "${launchedName}" — you already have an agent named "${requestedName}".`
            : `${launchedName} is ready.`,
      });

      // Wire any messaging gateways the user enabled. We do this AFTER
      // launchAgent returns because the gateways endpoint needs the
      // agentId (which the launch response carries). Failures are
      // surfaced as per-gateway toasts but don't block the rest of
      // the launch flow — the agent is up; the operator can re-save
      // a misconfigured gateway from the admin panel later.
      const agentId = response?.result?.agent?.id;
      if (agentId) {
        if (state.gatewayTelegramEnabled) {
          try {
            await saveAgentGateway(agentId, {
              type: "telegram",
              enabled: true,
              secrets: { botToken: state.gatewayTelegramBotToken },
              nonSecretConfig: state.gatewayTelegramWebhookUrl
                ? { webhookUrl: state.gatewayTelegramWebhookUrl }
                : undefined,
            });
            toast.success("Telegram gateway saved", {
              description: "Will activate on next agent restart.",
            });
          } catch (err) {
            toast.error("Telegram gateway not saved", {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (state.gatewayFarcasterEnabled) {
          try {
            await saveAgentGateway(agentId, {
              type: "farcaster",
              enabled: true,
              secrets: {
                neynarApiKey: state.gatewayFarcasterNeynarApiKey,
                signerUuid: state.gatewayFarcasterSignerUuid,
                webhookSecret: state.gatewayFarcasterWebhookSecret,
              },
              nonSecretConfig: {
                fid: state.gatewayFarcasterFid,
                replyVisibility: state.gatewayFarcasterReplyVisibility,
                ...(state.gatewayFarcasterParentChannel
                  ? { parentChannel: state.gatewayFarcasterParentChannel }
                  : {}),
              },
            });
            toast.success("Farcaster gateway saved", {
              description: "Will activate on next agent restart.",
            });
          } catch (err) {
            toast.error("Farcaster gateway not saved", {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (state.gatewaySlackEnabled) {
          try {
            await saveAgentGateway(agentId, {
              type: "slack",
              enabled: true,
              secrets: {
                botToken: state.gatewaySlackBotToken,
                signingSecret: state.gatewaySlackSigningSecret,
              },
              nonSecretConfig: state.gatewaySlackChannelId
                ? { channelId: state.gatewaySlackChannelId }
                : undefined,
            });
            toast.success("Slack gateway saved", {
              description: "Will activate on next agent restart.",
            });
          } catch (err) {
            toast.error("Slack gateway not saved", {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      // BYO flows (self-hosted / imported) get a bundle screen that
      // shows the compose.yml + .env + INSTRUCTIONS.md side-by-side and
      // polls /agents/<id> for bridgeConnected to flip "Waiting…" →
      // "Online ✓". The legacy AgentKeyRevealDialog only surfaces the
      // relayApiKey, which is now baked into .env, so we skip it here.
      const launchedAgentId = response?.result?.agent?.id ?? response?.launchId;
      if (
        response?.deployBundle &&
        launchedAgentId &&
        response?.credentials &&
        (state.deployMode === "self-hosted" || state.deployMode === "imported")
      ) {
        setIssuedBundle({
          bundle: response.deployBundle,
          agentId: launchedAgentId,
          agentName: response.credentials.agentName,
          deployMode: state.deployMode,
          relayApiKey: response.credentials.relayApiKey,
        });
        return;
      }
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

  // ipError / sshError dropped in 0.2 — BYO flows no longer collect a
  // VPS IP or SSH key. The bridge dials out, so the platform never
  // needs SSH access to the user's host.

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
        if (state.deployMode === "perkos-ecs") return ecsAllowed;
        if (state.deployMode === "self-hosted") return true;
        if (state.deployMode === "imported") return state.runtimeKind !== null;
        return false;
      case 4:
        if (state.llmSource === "perkos") return llmAllowed;
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
  }, [state, mutation.isPending, mutation.isSuccess, apiKeyError, ecsAllowed, llmAllowed]);

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
        {state.step === 1 && (
          <Step1Persona state={state} onChange={update} presets={visiblePresets} />
        )}
        {state.step === 2 && <Step2Runtime state={state} onChange={update} />}
        {state.step === 3 && (
          <Step3Deploy
            state={state}
            onChange={update}
            ecsAllowed={ecsAllowed}
          />
        )}
        {state.step === 4 && (
          <Step4LLM
            state={state}
            onChange={update}
            apiKeyError={apiKeyError}
            llmAllowed={llmAllowed}
          />
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

      {issuedBundle ? (
        <DeployBundleScreen
          bundle={issuedBundle.bundle}
          agentId={issuedBundle.agentId}
          agentName={issuedBundle.agentName}
          deployMode={issuedBundle.deployMode}
          relayApiKey={issuedBundle.relayApiKey}
          onDone={() => {
            setIssuedBundle(null);
            router.replace(fromOnboarding ? "/dashboard" : "/agents");
          }}
        />
      ) : null}
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

function Step1Persona({
  state,
  onChange,
  presets,
}: StepProps & { presets: AgentPreset[] }) {
  const preset =
    presets.find((p) => p.id === state.personaId) ??
    findPreset(state.personaId);
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

        {/* Hero — "teammate ID card": role-tinted orb + credential layout.
            Replaces the 240px robot portrait (user testing: robot imagery
            scared non-technical users — a colleague badge, not a machine). */}
        <div className="flex flex-col items-center gap-3">
          <TeammateIdCard
            name={preset.name}
            presetId={preset.id}
            tagline={`Your ${preset.name.toLowerCase()} teammate`}
          />
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
        {presets.map((p) => (
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
            {/* Role badge — orb instead of robot art (colleague, not machine). */}
            <div
              className="grid aspect-square w-full place-items-center"
              style={{
                background: `linear-gradient(160deg, hsla(${agentVisual({ presetId: p.id }).hue}, 55%, 18%, 0.35) 0%, hsla(${agentVisual({ presetId: p.id }).hue}, 40%, 10%, 0.12) 100%)`,
              }}
            >
              <AgentOrb name={p.name} presetId={p.id} size={64} />
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
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {latest.upstreamVersion ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {copy.title} {latest.upstreamVersion}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      {latest.displayName ?? latest.primaryTag}
                    </Badge>
                  )}
                  {latest.channel === "beta" ? (
                    <Badge className="bg-amber-500 text-[10px] text-white">
                      BETA
                    </Badge>
                  ) : null}
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
  ecsAllowed,
}: StepProps & { ecsAllowed: boolean }) {
  // Auto-detect the chain so the ECS card shows the right network name
  // (Base / Celo today, more later). Falls back to "your connected chain"
  // when wagmi reports an unsupported id so the copy never lies.
  const chainId = useChainId();
  const networkName =
    chainId === base.id
      ? "Base"
      : chainId === celo.id
        ? "Celo"
        : null;

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Where should this agent run?"
        description="Pick a deploy mode. The bridge dials OUT to PerkOS — no inbound ports needed for either self-hosted option."
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
                  PerkOS infra
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
                PerkOS provisions a managed container for your agent. From{" "}
                <span className="font-medium text-foreground">$29/mo</span>{" "}
                billed via x402{networkName ? ` on ${networkName}` : ""}.
                Status flips to &ldquo;ready&rdquo; once the container is
                healthy (~30s).
              </p>
              {!ecsAllowed ? (
                <p className="text-xs text-muted-foreground">
                  Currently invite-only while we test. Pick self-hosted or
                  imported for now, or contact an admin to be added to the
                  early access list.
                </p>
              ) : null}
            </div>
            <RadioGroupItem value="perkos-ecs" id="deploy-ecs" disabled={!ecsAllowed} />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.deployMode === "self-hosted"}
          onClick={() => onChange({ deployMode: "self-hosted" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Self-hosted (your infra)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                We generate a docker-compose bundle (runtime + bridge sidecar).
                Run <code className="rounded bg-muted px-1 font-mono text-[11px]">docker compose up -d</code>
                {" "}on any host with Docker — bridge dials OUT, no inbound
                ports / SSH access needed.
              </p>
            </div>
            <RadioGroupItem value="self-hosted" id="deploy-self-hosted" />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.deployMode === "imported"}
          onClick={() => onChange({ deployMode: "imported" })}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <PackageOpen className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Import an existing agent
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                You already have a Hermes / OpenClaw / custom runtime running.
                We hand you just the perkos-a2a bridge sidecar to plug it into
                chat.perkos.xyz + transport.perkos.xyz.
              </p>
            </div>
            <RadioGroupItem value="imported" id="deploy-imported" />
          </div>
        </SelectableCard>
      </RadioGroup>

      {state.deployMode === "imported" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's already running?</CardTitle>
            <CardDescription>
              Tells the bridge which API shape to speak when it forwards
              inbound chat frames into your runtime.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <RadioGroup
              value={state.runtimeKind ?? ""}
              onValueChange={(v) =>
                onChange({ runtimeKind: v as RuntimeKindChoice })
              }
              className="grid grid-cols-1 gap-2 md:grid-cols-3"
            >
              <SelectableCard
                selected={state.runtimeKind === "hermes"}
                onClick={() => onChange({ runtimeKind: "hermes" })}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Hermes</span>
                  <RadioGroupItem value="hermes" id="rk-hermes" />
                </div>
              </SelectableCard>
              <SelectableCard
                selected={state.runtimeKind === "openclaw"}
                onClick={() => onChange({ runtimeKind: "openclaw" })}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">OpenClaw</span>
                  <RadioGroupItem value="openclaw" id="rk-openclaw" />
                </div>
              </SelectableCard>
              <SelectableCard
                selected={state.runtimeKind === "custom"}
                onClick={() => onChange({ runtimeKind: "custom" })}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Custom</span>
                  <RadioGroupItem value="custom" id="rk-custom" />
                </div>
              </SelectableCard>
            </RadioGroup>
            <div className="flex flex-col gap-2">
              <Label htmlFor="imported-api-url">
                Runtime URL (HERMES_API_URL){" "}
                <span className="text-xs text-muted-foreground">
                  optional
                </span>
              </Label>
              <Input
                id="imported-api-url"
                value={state.importedHermesApiUrl}
                onChange={(e) =>
                  onChange({ importedHermesApiUrl: e.target.value })
                }
                placeholder="http://host.docker.internal:8642"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Defaults to <code className="rounded bg-muted px-1 font-mono text-[10px]">host.docker.internal:8642</code>{" "}
                for Hermes / <code className="rounded bg-muted px-1 font-mono text-[10px]">:8740</code>{" "}
                for OpenClaw. Override if your runtime listens on a
                non-default port.
              </p>
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
  llmAllowed,
}: StepProps & { apiKeyError?: string; llmAllowed: boolean }) {
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
          onClick={() => llmAllowed && onChange({ llmSource: "perkos" })}
          disabled={!llmAllowed}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  PerkOS LLM service
                </span>
                {!llmAllowed ? (
                  <Badge
                    variant="secondary"
                    className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    Coming soon
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Managed Ollama-compatible gateway at{" "}
                <code className="rounded bg-muted px-1 font-mono text-[11px]">
                  api.llm.perkos.xyz
                </code>{" "}
                — kimi-k2.6:cloud + qwen 7B/14B. No key needed; we issue one
                scoped to your agent.
              </p>
              {!llmAllowed ? (
                <p className="text-xs text-muted-foreground">
                  Currently invite-only while we test. Pick BYOK or
                  &ldquo;Configure later&rdquo; for now, or contact an admin to
                  be added to the early access list.
                </p>
              ) : null}
            </div>
            <RadioGroupItem
              value="perkos"
              id="llm-perkos"
              disabled={!llmAllowed}
            />
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

// ---------------------------------------------------------------------------
// OpenSourceSkills — markdown SKILL.md packs from public GitHub repos. Each
// card links to its source so the user can inspect what gets injected into
// the agent's instructions. Recommended packs (from the preset) surface
// first; community packs the user pastes get an "Unverified" warning.
// ---------------------------------------------------------------------------

function OpenSourceSkills({
  state,
  onChange,
  recommendedSkillIds,
  toggleSkill,
}: StepProps & {
  recommendedSkillIds: string[];
  toggleSkill: (id: string) => void;
}) {
  const [repoInput, setRepoInput] = useState("");
  const [repoError, setRepoError] = useState<string | null>(null);

  // Merge curated catalog + the community packs the user has pasted,
  // deduped by id (a pasted pack that matches a catalog id keeps one card).
  const packs = useMemo(() => {
    const byId = new Map<string, SkillPack>();
    for (const p of SKILLS_CATALOG) byId.set(p.id, p);
    for (const p of state.communitySkills) byId.set(p.id, p);
    const all = Array.from(byId.values());
    const rec = new Set(recommendedSkillIds);
    // Recommended packs first, otherwise keep catalog/community order.
    return all.sort((a, b) => {
      const ra = rec.has(a.id) ? 0 : 1;
      const rb = rec.has(b.id) ? 0 : 1;
      return ra - rb;
    });
  }, [state.communitySkills, recommendedSkillIds]);

  const recommended = useMemo(
    () => new Set(recommendedSkillIds),
    [recommendedSkillIds],
  );

  const addRepo = () => {
    const pack = parseUserRepo(repoInput);
    if (!pack) {
      setRepoError(
        "Only github.com / raw.githubusercontent.com / ethskills.com SKILL.md URLs are allowed.",
      );
      return;
    }
    setRepoError(null);
    setRepoInput("");
    // Dedupe by id; append if new. Always auto-select into the chosen set.
    if (!state.communitySkills.some((p) => p.id === pack.id) && !findSkillPack(pack.id)) {
      onChange({ communitySkills: [...state.communitySkills, pack] });
    }
    if (!state.skills.includes(pack.id)) {
      onChange({ skills: [...state.skills, pack.id] });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-foreground">Open-source skills</h3>
        <p className="text-xs text-muted-foreground">
          Markdown skill packs from public GitHub repos. They&rsquo;re injected
          into your agent&rsquo;s instructions. You can inspect each on GitHub.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {packs.map((pack) => {
          const active = state.skills.includes(pack.id);
          const isRecommended = recommended.has(pack.id);
          return (
            <div
              key={pack.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <button
                type="button"
                onClick={() => toggleSkill(pack.id)}
                className="flex items-start justify-between gap-3 text-left"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {pack.name}
                    </span>
                    {isRecommended ? (
                      <Badge
                        variant="secondary"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        Recommended
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pack.description}
                  </span>
                </div>
                {active ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Plus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {runtimeCompatLabel(pack.runtimeCompat)}
                </Badge>
                {pack.trust === "community" ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Unverified — review
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    Open source
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">
                  by {pack.author}
                </span>
                <a
                  href={pack.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  Inspect
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-3">
        <Label htmlFor="skill-repo" className="text-xs text-muted-foreground">
          Add a GitHub skill
        </Label>
        <div className="flex gap-2">
          <Input
            id="skill-repo"
            value={repoInput}
            onChange={(e) => {
              setRepoInput(e.target.value);
              if (repoError) setRepoError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRepo();
              }
            }}
            placeholder="https://github.com/owner/repo/blob/main/path/SKILL.md"
            className="font-mono text-xs"
            aria-invalid={Boolean(repoError)}
            aria-describedby={repoError ? "skill-repo-error" : undefined}
          />
          <Button type="button" variant="outline" onClick={addRepo}>
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
        </div>
        {repoError ? (
          <p id="skill-repo-error" className="text-xs text-destructive">
            {repoError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Step5Plugins({
  state,
  onChange,
  channels,
}: StepProps & { channels: Channel[] }) {
  const preset = findPreset(state.personaId);
  const togglePlugin = (id: string) => {
    const next = state.plugins.includes(id)
      ? state.plugins.filter((p) => p !== id)
      : [...state.plugins, id];
    onChange({ plugins: next });
  };
  const toggleSkill = (id: string) => {
    const next = state.skills.includes(id)
      ? state.skills.filter((s) => s !== id)
      : [...state.skills, id];
    onChange({ skills: next });
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

      <OpenSourceSkills
        state={state}
        onChange={onChange}
        recommendedSkillIds={preset?.recommendedSkills ?? []}
        toggleSkill={toggleSkill}
      />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">External channels (preview)</h3>
        <p className="text-xs text-muted-foreground">
          Visual selection only — wiring lives below under &ldquo;Messaging gateways&rdquo;.
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

      <StepGateways state={state} onChange={onChange} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messaging gateways (MVP: Telegram + Farcaster)
// ---------------------------------------------------------------------------
//
// Renders inside Step 5 so the user enables and configures gateways in
// the same place they pick capabilities. Each gateway is a toggle
// card; when enabled, the form for that gateway expands. Secrets are
// held in component state ONLY until the launch mutation's onSuccess
// posts them to /api/agents/{agentId}/gateways. Nothing is persisted
// to localStorage and nothing rides on the launch payload itself.
//
// Validation is intentionally lightweight: we let the server-side
// validateGatewayUpsert be the source of truth and surface its field
// errors via the toast. Local validation just hides the launch button
// when an enabled gateway is missing a required secret, to save a
// round-trip on the obvious cases.
function StepGateways({ state, onChange }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">Messaging gateways</h3>
      <p className="text-xs text-muted-foreground">
        Lets your agent receive messages from outside PerkOS. Secrets stay in
        a managed secrets vault under your wallet&rsquo;s namespace — never in the
        agent doc, never in this browser tab beyond the launch request.
      </p>

      <GatewayCard
        title="Telegram"
        icon={Send}
        enabled={state.gatewayTelegramEnabled}
        onToggle={(v) => onChange({ gatewayTelegramEnabled: v })}
        blurb="Your agent answers from a Telegram bot you create at @BotFather. Webhook mode is friendly to hibernation — no idle connection while the agent sleeps."
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="telegram-bot-token">Bot token</Label>
            <Input
              id="telegram-bot-token"
              type="password"
              autoComplete="off"
              value={state.gatewayTelegramBotToken}
              onChange={(e) => onChange({ gatewayTelegramBotToken: e.target.value })}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
            <span className="text-xs text-muted-foreground">
              From @BotFather. Stored in a managed secrets vault; never returned by the API.
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="telegram-webhook-url">Webhook URL (optional)</Label>
            <Input
              id="telegram-webhook-url"
              value={state.gatewayTelegramWebhookUrl}
              onChange={(e) => onChange({ gatewayTelegramWebhookUrl: e.target.value })}
              placeholder="https://relay.perkos.xyz/webhook/telegram/<agentId>"
            />
            <span className="text-xs text-muted-foreground">
              Leave blank to use long-polling. Setting a webhook URL is recommended for hibernation friendliness.
            </span>
          </div>
        </div>
      </GatewayCard>

      <GatewayCard
        title="Slack"
        icon={MessageSquare}
        enabled={state.gatewaySlackEnabled}
        onToggle={(v) => onChange({ gatewaySlackEnabled: v })}
        blurb="Your agent answers in Slack channels it's invited to. Webhook-mode (Events API), hibernation-friendly. You create a Slack app, install it to your workspace, copy the bot token + signing secret."
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="slack-bot-token">Bot token (xoxb-...)</Label>
            <Input
              id="slack-bot-token"
              type="password"
              autoComplete="off"
              value={state.gatewaySlackBotToken}
              onChange={(e) => onChange({ gatewaySlackBotToken: e.target.value })}
              placeholder="xoxb-XXXXXXXX..."
            />
            <span className="text-xs text-muted-foreground">
              Slack app → OAuth &amp; Permissions → Bot User OAuth Token.
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="slack-signing-secret">Signing secret</Label>
            <Input
              id="slack-signing-secret"
              type="password"
              autoComplete="off"
              value={state.gatewaySlackSigningSecret}
              onChange={(e) => onChange({ gatewaySlackSigningSecret: e.target.value })}
              placeholder="32-char hex from Slack app settings"
            />
            <span className="text-xs text-muted-foreground">
              Slack app → Basic Information → Signing Secret. Used to verify inbound webhook payloads.
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="slack-channel-id">Channel id (optional)</Label>
            <Input
              id="slack-channel-id"
              value={state.gatewaySlackChannelId}
              onChange={(e) => onChange({ gatewaySlackChannelId: e.target.value })}
              placeholder="e.g. C0123ABC"
            />
            <span className="text-xs text-muted-foreground">
              Restrict the agent to a single channel. Leave blank for mentions + DMs in every channel the bot is in.
            </span>
          </div>
        </div>
      </GatewayCard>

      <GatewayCard
        title="Farcaster"
        icon={Hash}
        enabled={state.gatewayFarcasterEnabled}
        onToggle={(v) => onChange({ gatewayFarcasterEnabled: v })}
        blurb="Your agent replies to mentions on Farcaster via Neynar. You need a Neynar-managed signer for the agent's identity."
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="fc-fid">FID</Label>
              <Input
                id="fc-fid"
                inputMode="numeric"
                value={state.gatewayFarcasterFid}
                onChange={(e) => onChange({ gatewayFarcasterFid: e.target.value })}
                placeholder="e.g. 12345"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fc-visibility">Reply visibility</Label>
              <select
                id="fc-visibility"
                value={state.gatewayFarcasterReplyVisibility}
                onChange={(e) => onChange({ gatewayFarcasterReplyVisibility: e.target.value })}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="mentions">mentions only (recommended)</option>
                <option value="all">all (requires parent channel)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fc-neynar-key">Neynar API key</Label>
            <Input
              id="fc-neynar-key"
              type="password"
              autoComplete="off"
              value={state.gatewayFarcasterNeynarApiKey}
              onChange={(e) => onChange({ gatewayFarcasterNeynarApiKey: e.target.value })}
              placeholder="NEYNAR_XXXXXXXX..."
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fc-signer">Signer UUID</Label>
            <Input
              id="fc-signer"
              type="password"
              autoComplete="off"
              value={state.gatewayFarcasterSignerUuid}
              onChange={(e) => onChange({ gatewayFarcasterSignerUuid: e.target.value })}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fc-webhook-secret">Webhook secret</Label>
            <Input
              id="fc-webhook-secret"
              type="password"
              autoComplete="off"
              value={state.gatewayFarcasterWebhookSecret}
              onChange={(e) => onChange({ gatewayFarcasterWebhookSecret: e.target.value })}
              placeholder="HMAC secret you set on the Neynar webhook"
            />
          </div>
          {state.gatewayFarcasterReplyVisibility === "all" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="fc-channel">Parent channel</Label>
              <Input
                id="fc-channel"
                value={state.gatewayFarcasterParentChannel}
                onChange={(e) => onChange({ gatewayFarcasterParentChannel: e.target.value })}
                placeholder="chain://eip155:..."
              />
              <span className="text-xs text-muted-foreground">
                Required when visibility is &ldquo;all&rdquo; — scopes the agent to one channel.
              </span>
            </div>
          ) : null}
        </div>
      </GatewayCard>
    </div>
  );
}

function GatewayCard({
  title,
  icon: Icon,
  enabled,
  onToggle,
  blurb,
  children,
}: {
  title: string;
  icon: typeof Send;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 transition-colors",
        enabled
          ? "border-primary bg-primary/5"
          : "border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-md",
              enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs text-muted-foreground">{blurb}</span>
          </div>
        </div>
        {enabled ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {enabled ? <div className="border-t border-border pt-3">{children}</div> : null}
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
        description="What we'll write to disk (or to your managed container) when you click Launch."
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
                ? "PerkOS infra"
                : state.deployMode === "self-hosted"
                  ? "Self-hosted (your infra)"
                  : state.deployMode === "imported"
                    ? `Imported · ${state.runtimeKind ?? "?"}`
                    : "—"
            }
            icon={
              state.deployMode === "perkos-ecs"
                ? Cloud
                : state.deployMode === "self-hosted"
                  ? Server
                  : PackageOpen
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

/** "Teammate ID card" — the wizard hero: a credential, not a robot portrait. */
function TeammateIdCard({
  name,
  presetId,
  tagline,
}: {
  name: string;
  presetId: string;
  tagline: string;
}) {
  const { hue } = agentVisual({ presetId, name });
  return (
    <div
      className="flex h-60 w-60 flex-col items-center justify-center gap-3 rounded-2xl border"
      style={{
        background: `linear-gradient(160deg, hsla(${hue}, 60%, 20%, 0.35) 0%, hsla(${hue}, 40%, 10%, 0.15) 100%)`,
        borderColor: `hsla(${hue}, 60%, 50%, 0.25)`,
      }}
    >
      <AgentOrb name={name} presetId={presetId} size={96} />
      <span
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: `hsla(${hue}, 80%, 75%, 0.95)` }}
      >
        {name}
      </span>
      <span className="px-6 text-center text-[11px] text-muted-foreground">
        {tagline}
      </span>
    </div>
  );
}
