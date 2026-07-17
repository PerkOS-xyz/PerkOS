import { useTranslation } from "react-i18next";
import {
  Sparkles,
  Bot,
  Cloud,
  Server,
  KeyRound,
  FileCode,
  Layers,
  MessageSquare,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { findPreset } from "@/app/lib/agentPresets";
import { buildConfigPreview } from "@/app/lib/agentConfigPreview";

import { isValidAgentName, resolveAgentName, type StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { SummaryRow } from "../ui/SummaryRow";

export function StepReview({ state, onChange }: StepProps) {
  const { t } = useTranslation();
  const preset = findPreset(state.personaId);
  const finalName = resolveAgentName(state.agentName, preset?.name ?? "Untitled agent");
  const nameError = !isValidAgentName(finalName)
    ? t("wizard.external.nameError")
    : undefined;
  const preview = state.runtime
    ? buildConfigPreview({
        runtime: state.runtime,
        agentName: finalName,
        llmSource: state.llmSource ?? "skip",
        byokProvider: state.byokProvider,
        modelId: state.byokModel,
      })
    : null;

  const skillsSummary =
    (state.skills.length === 0
      ? t("wizard.review.builtInTools")
      : t("wizard.review.skillPacks", { count: state.skills.length })) +
    (state.disabledTools.length > 0
      ? t("wizard.review.toolsOff", { count: state.disabledTools.length })
      : "");

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title={t("wizard.review.title")}
        description={t("wizard.review.description")}
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <SummaryRow label={t("wizard.review.persona")} value={preset?.name ?? "—"} icon={Sparkles} />
          <SummaryRow label={t("wizard.review.agentName")} value={finalName} icon={Bot} />
          <SummaryRow
            label={t("wizard.review.runtime")}
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
            label={t("wizard.review.deploy")}
            value={
              state.method === "perkos"
                ? t("wizard.review.deployPerkos")
                : state.method === "vps"
                  ? t("wizard.review.deployVps")
                  : "—"
            }
            icon={state.method === "perkos" ? Cloud : Server}
          />
          <SummaryRow
            label={t("wizard.review.llm")}
            value={
              state.llmSource === "perkos"
                ? t("wizard.review.llmPerkos")
                : state.llmSource === "byok"
                  ? `BYOK · ${state.byokProvider} · ${state.byokModel}`
                  : t("wizard.review.llmConfigureLater")
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
            label={t("wizard.review.skills")}
            value={skillsSummary}
            icon={Layers}
          />
          <SummaryRow
            label={t("wizard.review.channels")}
            value={
              [
                state.gatewayTelegramEnabled ? "Telegram" : null,
                state.gatewaySlackEnabled ? "Slack" : null,
                state.gatewayFarcasterEnabled && state.runtime === "Hermes" ? "Farcaster" : null,
              ]
                .filter(Boolean)
                .join(", ") || t("wizard.review.channelsPerkosOnly")
            }
            icon={MessageSquare}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode className="h-4 w-4 text-primary" />
            {t("wizard.review.configPreview")}
            <Badge variant="secondary" className="font-mono text-[10px]">
              {preview?.language ?? "—"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t("wizard.review.configPreviewDescBefore")}{" "}
            <code className="rounded bg-muted px-1 font-mono text-[11px]">
              {preview?.configPath ?? "—"}
            </code>{" "}
            {t("wizard.review.configPreviewDescAfter")}
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
          <CardTitle className="text-base">{t("wizard.review.renameOrSkip")}</CardTitle>
          <CardDescription>
            {t("wizard.review.renameOrSkipDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-name-review">{t("wizard.review.agentNameLabel")}</Label>
            <Input
              id="agent-name-review"
              value={state.agentName}
              onChange={(e) => onChange({ agentName: e.target.value })}
              placeholder={preset?.name ?? "Untitled agent"}
              maxLength={32}
              pattern="[A-Za-z0-9_-]{2,32}"
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? <span className="text-xs text-destructive">{nameError}</span> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
