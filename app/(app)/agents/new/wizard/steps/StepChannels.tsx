"use client";

import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { GatewayCard } from "../ui/GatewayCard";

// ---------------------------------------------------------------------------
// Channels — native messaging gateways. Each runtime wires these into its OWN
// channel config (OpenClaw plugin entries in openclaw.json / Hermes platform
// adapters), not a PerkOS relay. The first production capability is Telegram
// polling. Hermes and OpenClaw receive different adapter ids even though the
// user-facing fields happen to be the same.
//
// Secrets stay in component state ONLY until the launch mutation's onSuccess
// posts them to /api/agents/{agentId}/gateways. Nothing is persisted to
// localStorage and nothing rides on the launch payload itself.
// ---------------------------------------------------------------------------

export function StepChannels({ state, onChange }: StepProps) {
  const { t } = useTranslation();
  const adapterLabel =
    state.runtime === "Hermes" ? "Hermes Telegram" : "OpenClaw Telegram";

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title={t("wizard.channels.title")}
        description={t("wizard.channels.description")}
      />
      <p className="text-xs text-muted-foreground">
        {t("wizard.channels.secretsNote")}
      </p>

      <GatewayCard
        title="Telegram"
        icon={Send}
        enabled={state.gatewayTelegramEnabled}
        onToggle={(v) => onChange({ gatewayTelegramEnabled: v })}
        blurb={t("wizard.channels.telegram.blurb", { runtime: adapterLabel })}
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="telegram-bot-token">{t("wizard.channels.telegram.botToken")}</Label>
            <Input
              id="telegram-bot-token"
              type="password"
              autoComplete="off"
              value={state.gatewayTelegramBotToken}
              onChange={(e) => onChange({ gatewayTelegramBotToken: e.target.value })}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
            <span className="text-xs text-muted-foreground">
              {t("wizard.channels.telegram.botTokenHelp")}
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="telegram-allowed-users">{t("wizard.channels.telegram.allowedUsers")}</Label>
            <Input
              id="telegram-allowed-users"
              value={state.gatewayTelegramAllowedUsers}
              onChange={(e) => onChange({ gatewayTelegramAllowedUsers: e.target.value })}
              placeholder="123456789, 987654321"
            />
            <span className="text-xs text-muted-foreground">
              {t("wizard.channels.telegram.allowedUsersHelp")}
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="telegram-home-channel">{t("wizard.channels.telegram.homeChannel")}</Label>
            <Input
              id="telegram-home-channel"
              value={state.gatewayTelegramHomeChannel}
              onChange={(e) => onChange({ gatewayTelegramHomeChannel: e.target.value })}
              placeholder="-1001234567890"
            />
            <span className="text-xs text-muted-foreground">
              {t("wizard.channels.telegram.homeChannelHelp")}
            </span>
          </div>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {t("wizard.channels.telegram.alwaysOn")}
          </p>
        </div>
      </GatewayCard>
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        {t("wizard.channels.moreComing")}
      </p>
    </div>
  );
}
