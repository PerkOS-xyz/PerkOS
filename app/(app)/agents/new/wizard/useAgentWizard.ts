"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";

import {
  inviteAgent,
  launchAgent,
  saveAgentGateway,
  type DeployBundle,
  type InviteAgentResult,
  type LaunchAgentCredentials,
} from "@/app/lib/perkosApi";
import { useOnboarding } from "@/app/lib/onboardingState";
import { validateApiKey } from "@/app/lib/validators";
import {
  ALL_PRESETS,
  findPreset,
  presetSystemPrompt,
} from "@/app/lib/agentPresets";
import { fetchVisiblePresets } from "@/app/lib/agentPresetAccess";
import { byokBaseUrl, byokProviderOptions } from "@/app/lib/agentConfigPreview";
import { fetchEcsAccess } from "@/app/lib/ecsAccess";
import { fetchLlmAccess } from "@/app/lib/llmAccess";
import { fetchVpsAccess } from "@/app/lib/vpsAccess";

import {
  EXTERNAL_NAME_RE,
  INITIAL_WIZARD_STATE,
  stepsForMethod,
  type WizardState,
} from "./types";

/**
 * Owns the wizard's state, the two submit paths (launch for managed agents /
 * invite for external ones), and the branch-aware step machine. The page
 * stays a thin renderer over this hook.
 */
export function useAgentWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { address, isConnected } = useConnection();
  const { markAgentRegistered } = useOnboarding();
  const fromOnboarding = searchParams.get("from") === "onboarding";

  // ---- access gates --------------------------------------------------------
  const ecsAccessQuery = useQuery({
    queryKey: ["access", "ecs"],
    queryFn: fetchEcsAccess,
    staleTime: 60_000,
  });
  const ecsAllowed = ecsAccessQuery.data?.allowed === true;

  const llmAccessQuery = useQuery({
    queryKey: ["access", "llm"],
    queryFn: fetchLlmAccess,
    staleTime: 60_000,
  });
  const llmAllowed = llmAccessQuery.data?.allowed === true;

  // "Your VPS" (self-hosted) is gated like ECS — shown-but-blocked until the
  // wallet is in /vps_allowlist (or super-admin), while the flow is tested.
  const vpsAccessQuery = useQuery({
    queryKey: ["access", "vps"],
    queryFn: fetchVpsAccess,
    staleTime: 60_000,
  });
  const vpsAllowed = vpsAccessQuery.data?.allowed === true;

  const presetsQuery = useQuery({
    queryKey: ["wizard", "presets"],
    queryFn: fetchVisiblePresets,
    staleTime: 60_000,
  });
  const visiblePresets = presetsQuery.data ?? ALL_PRESETS;

  // ---- wizard state --------------------------------------------------------
  // Intentionally NOT persisted to localStorage — each visit starts clean.
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);
  // Apply the patch, then derive defaults at event time (rather than via
  // effects, which trigger cascading renders). Derivation is gated on the
  // field that changed so it fires once — picking a runtime seeds a BYOK
  // provider; picking a persona prefills its recommended plugins/skills —
  // and never clobbers later manual edits.
  const update = (patch: Partial<WizardState>) =>
    setState((s) => {
      const next: WizardState = { ...s, ...patch };
      if ("runtime" in patch && next.runtime && !s.byokProvider) {
        const opts = byokProviderOptions(next.runtime);
        if (opts.length > 0) {
          next.byokProvider = opts[0].id;
          next.byokModel = opts[0].defaultModel;
        }
      }
      if ("personaId" in patch && next.personaId) {
        const picked =
          visiblePresets.find((p) => p.id === next.personaId) ??
          findPreset(next.personaId);
        if (picked) {
          if (next.plugins.length === 0 && picked.recommendedPlugins.length > 0) {
            next.plugins = picked.recommendedPlugins;
          }
          if (next.skills.length === 0 && picked.recommendedSkills?.length) {
            next.skills = picked.recommendedSkills;
          }
        }
      }
      return next;
    });

  const [stepIndex, setStepIndex] = useState(0);
  const steps = useMemo(() => stepsForMethod(state.method), [state.method]);
  const clampedIndex = Math.min(stepIndex, steps.length - 1);
  const currentStepKey = steps[clampedIndex];
  const isFirstStep = clampedIndex === 0;

  const preset = useMemo(
    () =>
      visiblePresets.find((p) => p.id === state.personaId) ??
      findPreset(state.personaId),
    [visiblePresets, state.personaId],
  );

  const apiKeyError = useMemo(() => {
    if (state.llmSource !== "byok") return undefined;
    if (state.byokApiKey.trim().length === 0) return undefined;
    const provider = state.byokProvider;
    if (provider === "openai" || provider === "anthropic" || provider === "openrouter") {
      return validateApiKey(provider, state.byokApiKey) ?? undefined;
    }
    return undefined;
  }, [state.llmSource, state.byokProvider, state.byokApiKey]);

  // ---- post-launch overlays ------------------------------------------------
  const [issuedCredentials, setIssuedCredentials] =
    useState<LaunchAgentCredentials | null>(null);
  const [issuedBundle, setIssuedBundle] = useState<{
    bundle: DeployBundle;
    agentId: string;
    agentName: string;
    deployMode: "self-hosted" | "imported";
    relayApiKey: string;
  } | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteAgentResult | null>(null);

  // ---- launch (managed: perkos / vps) -------------------------------------
  const launchMutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet before launching an agent.");
      }
      if (!state.runtime) throw new Error("Pick a runtime.");
      const finalName = state.agentName.trim() || preset?.name || "Untitled agent";
      // Channels are now their own step (native messaging gateways, posted
      // after launch). plugins[] carries the preset's recommended capability
      // tags for record-keeping only — see the capability-wiring follow-up.
      const finalPlugins = Array.from(new Set(state.plugins));
      const wireMode: "perkos-managed" | "self-hosted" | "imported" =
        state.deployMode === "perkos-ecs"
          ? "perkos-managed"
          : state.deployMode === "self-hosted"
            ? "self-hosted"
            : "imported";
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
        disabledTools: state.disabledTools.length ? state.disabledTools : undefined,
        modelKey: state.llmSource === "byok" ? state.byokApiKey : undefined,
        llmBaseUrl: state.llmSource === "byok" ? byokBaseUrl(state.byokProvider) : undefined,
        llmModel:
          state.llmSource === "byok" ? state.byokModel.trim() || undefined : undefined,
        imageTag: state.deployMode === "perkos-ecs" ? state.imageTag : null,
        deployMode: wireMode,
        runtimeKind:
          wireMode === "imported" && state.runtimeKind ? state.runtimeKind : undefined,
        hermesApiUrl:
          wireMode === "imported" && state.importedHermesApiUrl.trim().length > 0
            ? state.importedHermesApiUrl.trim()
            : undefined,
      });
    },
    onSuccess: async (response) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
      if (fromOnboarding) markAgentRegistered();
      const requestedName = state.agentName.trim() || preset?.name || "Your agent";
      const launchedName = response?.result?.agent?.name || requestedName;
      toast.success("Agent launched", {
        description:
          launchedName !== requestedName
            ? `Saved as "${launchedName}" — you already have an agent named "${requestedName}".`
            : `${launchedName} is ready.`,
      });

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
        if (state.gatewayFarcasterEnabled && state.runtime === "Hermes") {
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

      const launchedAgentId = response?.result?.agent?.id ?? response?.launchId;
      if (
        response?.deployBundle &&
        launchedAgentId &&
        response?.credentials &&
        state.deployMode === "self-hosted"
      ) {
        setIssuedBundle({
          bundle: response.deployBundle,
          agentId: launchedAgentId,
          agentName: response.credentials.agentName,
          deployMode: "self-hosted",
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

  // ---- invite (external: I already have an agent) -------------------------
  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteAgent({
        name: state.agentName.trim(),
        runtimeKind: state.runtimeKind ?? undefined,
        note: state.externalNote.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
      if (fromOnboarding) markAgentRegistered();
      setInviteResult(data);
    },
    onError: (err: Error) => {
      toast.error("Invite failed", { description: err.message });
    },
  });

  // ---- step gating ---------------------------------------------------------
  const canAdvance = useMemo(() => {
    switch (currentStepKey) {
      case "method":
        return state.method !== null;
      case "runtime":
        return state.runtime !== null;
      case "template":
        // Template picked AND its engine resolved (locked by origin, or chosen
        // for portable PerkOS/Custom templates — see StepTemplate).
        return state.personaId !== null && state.runtime !== null;
      case "llm":
        if (state.llmSource === "perkos") return llmAllowed;
        if (state.llmSource === "skip") return true;
        if (state.llmSource === "byok")
          return state.byokApiKey.trim().length > 0 && !apiKeyError;
        return false;
      case "capabilities":
        return true;
      case "channels":
        return true;
      case "review":
        return !launchMutation.isPending && !launchMutation.isSuccess;
      case "external":
        return (
          state.runtimeKind !== null &&
          EXTERNAL_NAME_RE.test(state.agentName.trim()) &&
          !inviteMutation.isPending &&
          inviteResult === null
        );
      default:
        return false;
    }
  }, [
    currentStepKey,
    state,
    apiKeyError,
    llmAllowed,
    launchMutation.isPending,
    launchMutation.isSuccess,
    inviteMutation.isPending,
    inviteResult,
  ]);

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const closeOverlay = () => {
    setIssuedCredentials(null);
    setIssuedBundle(null);
    router.replace(fromOnboarding ? "/dashboard" : "/agents");
  };

  return {
    // state
    state,
    update,
    preset,
    visiblePresets,
    // access
    ecsAllowed,
    llmAllowed,
    vpsAllowed,
    apiKeyError,
    // step machine
    steps,
    stepIndex: clampedIndex,
    currentStepKey,
    isFirstStep,
    canAdvance,
    goNext,
    goBack,
    // submit
    launchMutation,
    inviteMutation,
    inviteResult,
    // overlays
    issuedCredentials,
    issuedBundle,
    closeOverlay,
    // misc
    fromOnboarding,
  };
}
