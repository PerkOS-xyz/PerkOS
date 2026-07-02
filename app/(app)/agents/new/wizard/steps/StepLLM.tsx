import { useTranslation } from "react-i18next";
import { Sparkles, KeyRound, FileCode } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

import { byokProviderOptions, type LLMSource } from "@/app/lib/agentConfigPreview";

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { SelectableCard } from "../ui/SelectableCard";

export function StepLLM({
  state,
  onChange,
  apiKeyError,
  llmAllowed,
}: StepProps & { apiKeyError?: string; llmAllowed: boolean }) {
  const { t } = useTranslation();
  const providerOpts = state.runtime ? byokProviderOptions(state.runtime) : [];
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title={t("wizard.llm.title")}
        description={t("wizard.llm.description")}
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
                  {t("wizard.llm.perkos.title")}
                </span>
                {!llmAllowed ? (
                  <Badge
                    variant="secondary"
                    className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    {t("wizard.llm.comingSoon")}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("wizard.llm.perkos.descBefore")}{" "}
                <code className="rounded bg-muted px-1 font-mono text-[11px]">
                  api.llm.perkos.xyz
                </code>{" "}
                {t("wizard.llm.perkos.descAfter")}
              </p>
              {!llmAllowed ? (
                <p className="text-xs text-muted-foreground">
                  {t("wizard.llm.perkos.inviteOnly")}
                </p>
              ) : null}
            </div>
            <RadioGroupItem value="perkos" id="llm-perkos" disabled={!llmAllowed} />
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
                  {t("wizard.llm.byok.title")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("wizard.llm.byok.description")}
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
                  {t("wizard.llm.skip.title")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("wizard.llm.skip.description")}
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
                ? t("wizard.llm.providerSettings.openclawTitle")
                : t("wizard.llm.providerSettings.hermesTitle")}
            </CardTitle>
            <CardDescription>
              {state.runtime === "OpenClaw"
                ? t("wizard.llm.providerSettings.openclawDesc")
                : t("wizard.llm.providerSettings.hermesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="byok-provider">{t("wizard.llm.providerSettings.provider")}</Label>
              <Select
                value={state.byokProvider}
                onValueChange={(v) => {
                  const id = v ?? "";
                  const opt = providerOpts.find((p) => p.id === id);
                  onChange({ byokProvider: id, byokModel: opt?.defaultModel ?? "" });
                }}
              >
                <SelectTrigger id="byok-provider">
                  <SelectValue placeholder={t("wizard.llm.providerSettings.providerPlaceholder")} />
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
              <Label htmlFor="byok-model">{t("wizard.llm.providerSettings.defaultModel")}</Label>
              <Input
                id="byok-model"
                value={state.byokModel}
                onChange={(e) => onChange({ byokModel: e.target.value })}
                placeholder="claude-sonnet-4-5"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="byok-key">{t("wizard.llm.providerSettings.apiKey")}</Label>
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
