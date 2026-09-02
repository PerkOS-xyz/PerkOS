"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, Loader2, PhoneCall, RotateCcw, ShieldCheck, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/app/components/ConfirmDialog";
import {
  getVoiceEnrollmentCapability,
  getAgentVoiceHealthApi,
  createA2AMaintenanceUpdate,
  getA2AMaintenanceUpdate,
  prepareA2AVoiceEnrollment,
  requestVoiceSupportProbe,
  rotateVoiceGatewayCredential,
  type AgentRuntime,
  type A2AMaintenanceCapability,
  type VoiceGatewayCredential,
} from "@/app/lib/perkosApi";

type Props = {
  agentId: string;
  agentName: string;
  runtime: AgentRuntime;
  runtimeVersion?: string | null;
  maintenanceCapability?: A2AMaintenanceCapability | null;
  owner: boolean;
  canSendToAgent?: () => boolean;
  onSendToAgent?: (message: string) => Promise<boolean>;
  onMessageSent?: () => void;
};

type SafeChatAction = "update" | "probe" | "enroll";

export const PERKOS_A2A_MANAGED_UPDATE_VERSION = "0.12.64";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function buildHermesA2ABootstrapCommand(agentId: string): string {
  return `npx --yes @perkos/perkos-a2a@${PERKOS_A2A_MANAGED_UPDATE_VERSION} update-hermes --agent-id ${shellQuote(agentId)} --json`;
}

export function supportsManagedA2AUpdate(
  runtimeVersion?: string | null,
  capability?: A2AMaintenanceCapability | null,
  now = new Date(),
): boolean {
  const actual = /^(\d+)\.(\d+)\.(\d+)/.exec(runtimeVersion?.trim() ?? "");
  const minimum = PERKOS_A2A_MANAGED_UPDATE_VERSION.split(".").map(Number);
  if (!actual) return false;
  const parts = actual.slice(1).map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if (parts[index]! > minimum[index]!) return true;
    if (parts[index]! < minimum[index]!) return false;
  }
  return capability?.protocolVersion === 1
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(capability.bridgeInstanceId)
    && Date.parse(capability.expiresAt) > now.getTime();
}

export function buildHermesA2ABootstrapInstructions(agentId: string): string {
  return [
    "Run this once on the private Hermes host to enable managed updates:",
    "",
    buildHermesA2ABootstrapCommand(agentId),
    "",
    "This reuses the existing managed identity. Do not paste credentials or command output into chat.",
  ].join("\n");
}

type EnrollmentBundle = {
  instructions: string;
  secretFile: string;
};

export function voiceApiBaseForHost(hostname: string): string {
  if (hostname === "dev.perkos.xyz" || hostname.endsWith(".dev.perkos.xyz")) return "https://dev.api.perkos.xyz";
  if (hostname === "qa.perkos.xyz" || hostname.endsWith(".qa.perkos.xyz")) return "https://qa.api.perkos.xyz";
  if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:8080";
  return "https://api.perkos.xyz";
}

function environmentForHost(hostname: string): "dev" | "qa" | "production" {
  if (hostname === "dev.perkos.xyz" || hostname.endsWith(".dev.perkos.xyz") || hostname === "localhost" || hostname === "127.0.0.1") return "dev";
  if (hostname === "qa.perkos.xyz" || hostname.endsWith(".qa.perkos.xyz")) return "qa";
  return "production";
}

export function buildVoiceEnrollmentBundle(input: {
  agentId: string;
  agentName: string;
  runtime: AgentRuntime;
  credential: string;
  hostname: string;
}): EnrollmentBundle {
  const base = voiceApiBaseForHost(input.hostname);
  const environment = environmentForHost(input.hostname);
  const encodedId = encodeURIComponent(input.agentId);
  const runtime = input.runtime.toLowerCase();
  const secretFile = JSON.stringify({
    grantCredential: input.credential,
    capabilityPublishCredential: input.credential,
  }, null, 2);
  const configuration = {
    agentId: input.agentId,
    agentName: input.agentName,
    environment,
    runtime,
    secretFile: `~/.perkos/voice/${input.agentId}-${environment}.secrets.json`,
    sessionControlEndpoint: `${base}/agents/${encodedId}/voice-control`,
    grantEndpoint: `${base}/agents/${encodedId}/voice-gateway-grant`,
    capabilityPublishEndpoint: `${base}/agents/${encodedId}/voice-control/capability`,
  };
  const installer = input.runtime === "OpenClaw"
    ? "Install @perkos/perkos-voice with the OpenClaw native plugin manager."
    : input.runtime === "ZeroClaw"
      ? "Install @perkos/perkos-voice, then use perkos-voice-install-zeroclaw in review-first --emit mode."
      : "Install @perkos/perkos-voice, then use perkos-voice-install-hermes in review-first --emit mode.";
  return {
    secretFile,
    instructions: [
      `Enable PerkOS Voice for ${input.agentName}.`,
      installer,
      "Use this non-secret plugin configuration:",
      "```json",
      JSON.stringify(configuration, null, 2),
      "```",
      "Save the separately supplied secret JSON at the configured secretFile path with mode 0600. Do not echo it, put it in command arguments, logs, chat history, or source control.",
      "Configure a local speech provider/sidecar, start the managed Voice service, then run `perkos-voice-doctor --report` until it reports ready.",
    ].join("\n"),
  };
}

export function VoiceEnrollmentPanel({
  agentId,
  agentName,
  runtime,
  runtimeVersion,
  maintenanceCapability,
  owner,
  canSendToAgent,
  onSendToAgent,
  onMessageSent,
}: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [credential, setCredential] = useState<VoiceGatewayCredential | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptSent, setPromptSent] = useState(false);
  const [copied, setCopied] = useState<"prompt" | "instructions" | "secret" | null>(null);
  const [chatAction, setChatAction] = useState<SafeChatAction | null>(null);
  const [sendingToChat, setSendingToChat] = useState(false);
  const [maintenanceRequestId, setMaintenanceRequestId] = useState<string | null>(null);
  const managedUpdateSupported = runtime === "Hermes"
    && supportsManagedA2AUpdate(runtimeVersion, maintenanceCapability);
  const capabilityQuery = useQuery({
    queryKey: ["agent-voice-enrollment-capability", agentId],
    queryFn: () => getVoiceEnrollmentCapability(agentId),
    enabled: owner && Boolean(agentId),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
  const healthQuery = useQuery({
    queryKey: ["agent-voice-health", agentId],
    queryFn: () => getAgentVoiceHealthApi(agentId),
    enabled: owner && Boolean(agentId),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
  const maintenanceQuery = useQuery({
    queryKey: ["agent-a2a-maintenance", agentId, maintenanceRequestId],
    queryFn: () => getA2AMaintenanceUpdate(agentId, maintenanceRequestId!),
    enabled: owner && Boolean(maintenanceRequestId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === "completed" || state === "failed" || state === "expired" ? false : 3_000;
    },
    staleTime: 1_000,
  });
  const ready = healthQuery.data?.health?.ready === true && healthQuery.data.health.capabilityAvailable === true;
  const capabilityState = ready ? "ready" : capabilityQuery.data?.capability.state ?? "unknown";
  const bundle = useMemo(() => credential && typeof window !== "undefined"
    ? buildVoiceEnrollmentBundle({ agentId, agentName, runtime, credential: credential.credential, hostname: window.location.hostname })
    : null, [agentId, agentName, credential, runtime]);
  const rotate = useMutation({
    mutationFn: () => rotateVoiceGatewayCredential(agentId),
    onSuccess: (result) => {
      setCredential(result);
      toast.success(t("agentDetail.voiceEnrollment.created"));
      void queryClient.invalidateQueries({ queryKey: ["agent-voice-health", agentId] });
    },
    onError: (error: Error) => toast.error(t("agentDetail.voiceEnrollment.error"), { description: error.message }),
  });
  const probe = useMutation({
    mutationFn: () => requestVoiceSupportProbe(agentId),
    onSuccess: (result) => {
      queryClient.setQueryData(["agent-voice-enrollment-capability", agentId], result);
    },
  });
  const prepare = useMutation({
    mutationFn: () => prepareA2AVoiceEnrollment(agentId),
    onSuccess: (result) => {
      queryClient.setQueryData(["agent-voice-enrollment-capability", agentId], result);
    },
  });

  if (!owner) return null;

  const copy = async (kind: "prompt" | "instructions" | "secret", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  const sendConfirmedAction = async () => {
    if (!chatAction || !onSendToAgent || !canSendToAgent?.()) {
      toast.error(t("agentDetail.voiceEnrollment.chatUnavailable"));
      return;
    }
    setSendingToChat(true);
    try {
      let message: string;
      if (chatAction === "update") {
        const result = await createA2AMaintenanceUpdate(agentId);
        message = result.marker;
        setMaintenanceRequestId(result.request.requestId);
        queryClient.setQueryData(["agent-a2a-maintenance", agentId, result.request.requestId], result.request);
      } else if (chatAction === "probe") {
        const result = await probe.mutateAsync();
        message = result.prompt ?? "PERKOS_VOICE_PROBE";
      } else {
        const result = await prepare.mutateAsync();
        message = result.prompt ?? "PERKOS_VOICE_ENROLL";
      }
      if (!await onSendToAgent(message)) {
        throw new Error(t("agentDetail.voiceEnrollment.chatUnavailable"));
      }
      setPrompt(message);
      setPromptSent(true);
      setChatAction(null);
      toast.success(t("agentDetail.voiceEnrollment.sentToChat", { name: agentName }));
      onMessageSent?.();
    } catch (error) {
      toast.error(t("agentDetail.voiceEnrollment.sendFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSendingToChat(false);
    }
  };

  return (
    <Card data-testid="voice-enrollment-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
            {t("agentDetail.voiceEnrollment.title")}
          </CardTitle>
          {ready ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("agentDetail.voiceEnrollment.ready")}
            </span>
          ) : null}
        </div>
        <CardDescription>{t("agentDetail.voiceEnrollment.description", { name: agentName, runtime })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="grid gap-2 text-sm sm:grid-cols-3">
          {["credential", "plugin", "doctor"].map((step, index) => (
            <li key={step} className="rounded-md border border-border/80 bg-muted/30 px-3 py-2">
              <span className="mr-2 font-mono text-xs text-primary">{index + 1}</span>
              {t(`agentDetail.voiceEnrollment.steps.${step}`)}
            </li>
          ))}
        </ol>

        {runtime === "Hermes" && capabilityState !== "ready" ? (
          <div className="rounded-md border border-border/80 bg-muted/20 p-3">
            <p className="mb-2 text-sm text-muted-foreground">
              {t(managedUpdateSupported
                ? "agentDetail.voiceEnrollment.updateHelp"
                : "agentDetail.voiceEnrollment.bootstrapHelp", { version: runtimeVersion ?? t("agentDetail.voiceEnrollment.unknownVersion") })}
            </p>
            {managedUpdateSupported ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={sendingToChat}
                onClick={() => setChatAction("update")}
              >
                <Wrench className="h-4 w-4" />
                {t("agentDetail.voiceEnrollment.updateIntegration")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void copy("prompt", buildHermesA2ABootstrapInstructions(agentId))}
              >
                {copied === "prompt" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "prompt" ? t("agentDetail.common.copied") : t("agentDetail.voiceEnrollment.copyBootstrap")}
              </Button>
            )}
            {maintenanceRequestId ? (
              <p className="mt-2 text-xs text-muted-foreground" role="status">
                {t(`agentDetail.voiceEnrollment.maintenance.${maintenanceQuery.data?.state ?? "pending"}`, {
                  version: maintenanceQuery.data?.installedVersion ?? maintenanceQuery.data?.targetVersion ?? PERKOS_A2A_MANAGED_UPDATE_VERSION,
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {capabilityState === "ready" ? (
          <p className="text-sm text-muted-foreground">{t("agentDetail.voiceEnrollment.readyHelp")}</p>
        ) : capabilityState === "unsupported" ? (
          <p className="text-sm text-muted-foreground">
            {t("agentDetail.voiceEnrollment.unsupported")}
            {capabilityQuery.data?.capability.reasonCode ? ` (${capabilityQuery.data.capability.reasonCode})` : ""}
          </p>
        ) : capabilityState === "available" ? (
          <Button type="button" className="w-fit gap-2" disabled={sendingToChat} onClick={() => setChatAction("enroll")}>
            {prepare.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
            {t("agentDetail.voiceEnrollment.enable")}
          </Button>
        ) : capabilityState === "enrolling" ? (
          <p className="text-sm text-muted-foreground">{t("agentDetail.voiceEnrollment.enrolling")}</p>
        ) : (
          <Button type="button" variant="outline" className="w-fit gap-2" disabled={sendingToChat} onClick={() => setChatAction("probe")}>
            {probe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {t("agentDetail.voiceEnrollment.checkSupport")}
          </Button>
        )}

        {(prompt || capabilityState === "enrolling") ? (
          <div className="space-y-3 rounded-md border border-primary/25 bg-primary/5 p-3">
            <p className="text-sm text-muted-foreground">
              {t(promptSent ? "agentDetail.voiceEnrollment.sentPromptHelp" : "agentDetail.voiceEnrollment.promptHelp")}
            </p>
            <code className="block rounded bg-background px-3 py-2 text-sm">{prompt ?? "PERKOS_VOICE_ENROLL"}</code>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void copy("prompt", prompt ?? "PERKOS_VOICE_ENROLL")}>
              {copied === "prompt" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === "prompt" ? t("agentDetail.common.copied") : t("agentDetail.voiceEnrollment.copyPrompt")}
            </Button>
          </div>
        ) : null}

        <details className="rounded-md border border-border/80 p-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">{t("agentDetail.voiceEnrollment.advanced")}</summary>
          <div className="mt-3 space-y-3">
            {!bundle ? (
              <Button type="button" variant="outline" size="sm" className="gap-2" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
                {rotate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {t("agentDetail.voiceEnrollment.directHost")}
              </Button>
            ) : null}
          {bundle && credential ? (
            <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <ShieldCheck className="h-4 w-4 shrink-0" /> {t("agentDetail.voiceEnrollment.secretWarning")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void copy("instructions", bundle.instructions)}>
                {copied === "instructions" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "instructions" ? t("agentDetail.common.copied") : t("agentDetail.voiceEnrollment.copyInstructions")}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => void copy("secret", bundle.secretFile)}>
                {copied === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "secret" ? t("agentDetail.common.copied") : t("agentDetail.voiceEnrollment.copySecret")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("agentDetail.voiceEnrollment.expires", { date: new Date(credential.expiresAt).toLocaleString(i18n.language) })}
            </p>
            </div>
          ) : null}
          </div>
        </details>
      </CardContent>
      <ConfirmDialog
        open={chatAction !== null}
        onOpenChange={(open) => { if (!open && !sendingToChat) setChatAction(null); }}
        title={t(`agentDetail.voiceEnrollment.confirm.${chatAction ?? "probe"}.title`)}
        description={t(`agentDetail.voiceEnrollment.confirm.${chatAction ?? "probe"}.description`, { name: agentName })}
        confirmLabel={t("agentDetail.voiceEnrollment.sendToChat")}
        pending={sendingToChat}
        onConfirm={() => void sendConfirmedAction()}
      />
    </Card>
  );
}
