"use client";

import { useTranslation } from "react-i18next";
import { Send, Hash, MessageSquare } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { GatewayCard } from "../ui/GatewayCard";

// ---------------------------------------------------------------------------
// Channels — native messaging gateways. Each runtime wires these into its OWN
// channel config (OpenClaw plugin entries in openclaw.json / Hermes platform
// adapters), not a PerkOS relay. Telegram + Slack work on both runtimes;
// Farcaster is Hermes-only (its entrypoint stages the farcaster platform
// plugin when a Neynar key is present — OpenClaw has no Farcaster channel).
//
// Secrets stay in component state ONLY until the launch mutation's onSuccess
// posts them to /api/agents/{agentId}/gateways. Nothing is persisted to
// localStorage and nothing rides on the launch payload itself.
// ---------------------------------------------------------------------------

export function StepChannels({ state, onChange }: StepProps) {
  const { t } = useTranslation();
  const isHermes = state.runtime === "Hermes";

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
        blurb={t("wizard.channels.telegram.blurb")}
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
            <Label htmlFor="telegram-webhook-url">{t("wizard.channels.telegram.webhookUrl")}</Label>
            <Input
              id="telegram-webhook-url"
              value={state.gatewayTelegramWebhookUrl}
              onChange={(e) => onChange({ gatewayTelegramWebhookUrl: e.target.value })}
              placeholder="https://relay.perkos.xyz/webhook/telegram/<agentId>"
            />
            <span className="text-xs text-muted-foreground">
              {t("wizard.channels.telegram.webhookHelp")}
            </span>
          </div>
        </div>
      </GatewayCard>

      <GatewayCard
        title="Slack"
        icon={MessageSquare}
        enabled={state.gatewaySlackEnabled}
        onToggle={(v) => onChange({ gatewaySlackEnabled: v })}
        blurb={t("wizard.channels.slack.blurb")}
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="slack-bot-token">{t("wizard.channels.slack.botToken")}</Label>
            <Input
              id="slack-bot-token"
              type="password"
              autoComplete="off"
              value={state.gatewaySlackBotToken}
              onChange={(e) => onChange({ gatewaySlackBotToken: e.target.value })}
              placeholder="xoxb-XXXXXXXX..."
            />
            <span className="text-xs text-muted-foreground">
              {t("wizard.channels.slack.botTokenHelp")}
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="slack-signing-secret">{t("wizard.channels.slack.signingSecret")}</Label>
            <Input
              id="slack-signing-secret"
              type="password"
              autoComplete="off"
              value={state.gatewaySlackSigningSecret}
              onChange={(e) => onChange({ gatewaySlackSigningSecret: e.target.value })}
              placeholder={t("wizard.channels.slack.signingSecretPlaceholder")}
            />
            <span className="text-xs text-muted-foreground">
              {t("wizard.channels.slack.signingSecretHelp")}
            </span>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="slack-channel-id">{t("wizard.channels.slack.channelId")}</Label>
            <Input
              id="slack-channel-id"
              value={state.gatewaySlackChannelId}
              onChange={(e) => onChange({ gatewaySlackChannelId: e.target.value })}
              placeholder="e.g. C0123ABC"
            />
            <span className="text-xs text-muted-foreground">
              {t("wizard.channels.slack.channelIdHelp")}
            </span>
          </div>
        </div>
      </GatewayCard>

      {isHermes ? (
        <GatewayCard
          title="Farcaster"
          icon={Hash}
          enabled={state.gatewayFarcasterEnabled}
          onToggle={(v) => onChange({ gatewayFarcasterEnabled: v })}
          blurb={t("wizard.channels.farcaster.blurb")}
        >
          <div className="grid gap-3">
            {/* Where to point the Neynar webhook. Your agent has no public IP
                and hibernates, so Neynar POSTs here and PerkOS relays the cast
                to the agent over its existing connection. */}
            <div className="grid gap-1.5 rounded-md border border-border bg-card/50 p-2.5">
              <Label className="text-xs text-muted-foreground">
                {t("wizard.channels.farcaster.webhookLabel")}
              </Label>
              <code className="select-all break-all rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
                {`https://chat.perkos.xyz/webhooks/farcaster/${state.agentName?.trim() || "<your-agent-name>"}`}
              </code>
              <span className="text-[11px] text-muted-foreground">
                {t("wizard.channels.farcaster.webhookHelp")}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="fc-fid">{t("wizard.channels.farcaster.fid")}</Label>
                <Input
                  id="fc-fid"
                  inputMode="numeric"
                  value={state.gatewayFarcasterFid}
                  onChange={(e) => onChange({ gatewayFarcasterFid: e.target.value })}
                  placeholder="e.g. 12345"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="fc-visibility">{t("wizard.channels.farcaster.replyVisibility")}</Label>
                <select
                  id="fc-visibility"
                  value={state.gatewayFarcasterReplyVisibility}
                  onChange={(e) => onChange({ gatewayFarcasterReplyVisibility: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="mentions">{t("wizard.channels.farcaster.visibilityMentions")}</option>
                  <option value="all">{t("wizard.channels.farcaster.visibilityAll")}</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fc-neynar-key">{t("wizard.channels.farcaster.neynarApiKey")}</Label>
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
              <Label htmlFor="fc-signer">{t("wizard.channels.farcaster.signerUuid")}</Label>
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
              <Label htmlFor="fc-webhook-secret">{t("wizard.channels.farcaster.webhookSecret")}</Label>
              <Input
                id="fc-webhook-secret"
                type="password"
                autoComplete="off"
                value={state.gatewayFarcasterWebhookSecret}
                onChange={(e) => onChange({ gatewayFarcasterWebhookSecret: e.target.value })}
                placeholder={t("wizard.channels.farcaster.webhookSecretPlaceholder")}
              />
            </div>
            {state.gatewayFarcasterReplyVisibility === "all" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="fc-channel">{t("wizard.channels.farcaster.parentChannel")}</Label>
                <Input
                  id="fc-channel"
                  value={state.gatewayFarcasterParentChannel}
                  onChange={(e) => onChange({ gatewayFarcasterParentChannel: e.target.value })}
                  placeholder="chain://eip155:..."
                />
                <span className="text-xs text-muted-foreground">
                  {t("wizard.channels.farcaster.parentChannelHelp")}
                </span>
              </div>
            ) : null}
          </div>
        </GatewayCard>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          {t("wizard.channels.farcasterUnavailableBefore")}{" "}
          <span className="text-foreground">{state.runtime ?? "OpenClaw"}</span>
          {t("wizard.channels.farcasterUnavailableAfter")}
        </p>
      )}
    </div>
  );
}
