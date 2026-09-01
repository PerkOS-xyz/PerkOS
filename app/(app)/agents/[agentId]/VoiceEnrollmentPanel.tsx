"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, Loader2, PhoneCall, RotateCcw, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAgentVoiceHealthApi,
  rotateVoiceGatewayCredential,
  type AgentRuntime,
  type VoiceGatewayCredential,
} from "@/app/lib/perkosApi";

type Props = {
  agentId: string;
  agentName: string;
  runtime: AgentRuntime;
  owner: boolean;
};

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

export function VoiceEnrollmentPanel({ agentId, agentName, runtime, owner }: Props) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [credential, setCredential] = useState<VoiceGatewayCredential | null>(null);
  const [copied, setCopied] = useState<"instructions" | "secret" | null>(null);
  const healthQuery = useQuery({
    queryKey: ["agent-voice-health", agentId],
    queryFn: () => getAgentVoiceHealthApi(agentId),
    enabled: owner && Boolean(agentId),
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
  const ready = healthQuery.data?.health?.ready === true && healthQuery.data.health.capabilityAvailable === true;
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

  if (!owner) return null;

  const copy = async (kind: "instructions" | "secret", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
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

        {ready ? (
          <p className="text-sm text-muted-foreground">{t("agentDetail.voiceEnrollment.readyHelp")}</p>
        ) : (
          <Button type="button" className="w-fit gap-2" disabled={rotate.isPending} onClick={() => rotate.mutate()}>
            {rotate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : credential ? <RotateCcw className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
            {credential ? t("agentDetail.voiceEnrollment.rotate") : t("agentDetail.voiceEnrollment.enable")}
          </Button>
        )}

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
      </CardContent>
    </Card>
  );
}
