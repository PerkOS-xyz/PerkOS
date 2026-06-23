"use client";

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
  const isHermes = state.runtime === "Hermes";

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Channels"
        description="Optional. Let your agent receive and reply to messages from outside PerkOS, using each runtime's native messaging integration."
      />
      <p className="text-xs text-muted-foreground">
        Secrets are stored in a managed vault under your wallet&rsquo;s namespace — never in
        the agent doc, never in this browser tab beyond the launch request. You can also add
        a channel later from the agent&rsquo;s settings.
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

      {isHermes ? (
        <GatewayCard
          title="Farcaster"
          icon={Hash}
          enabled={state.gatewayFarcasterEnabled}
          onToggle={(v) => onChange({ gatewayFarcasterEnabled: v })}
          blurb="Hermes only. Your agent replies to mentions on Farcaster via Neynar. You need a Neynar-managed signer for the agent's identity."
        >
          <div className="grid gap-3">
            {/* Where to point the Neynar webhook. Your agent has no public IP
                and hibernates, so Neynar POSTs here and PerkOS relays the cast
                to the agent over its existing connection. */}
            <div className="grid gap-1.5 rounded-md border border-border bg-card/50 p-2.5">
              <Label className="text-xs text-muted-foreground">
                Neynar webhook URL — set this as your Neynar webhook&rsquo;s target URL
              </Label>
              <code className="select-all break-all rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
                {`https://chat.perkos.xyz/webhooks/farcaster/${state.agentName?.trim() || "<your-agent-name>"}`}
              </code>
              <span className="text-[11px] text-muted-foreground">
                Use the webhook secret below as the webhook&rsquo;s signature secret. If the agent
                name is taken it gets a suffix on launch — use the final name (shown after launch)
                in the URL.
              </span>
            </div>
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
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Farcaster is available on Hermes agents. Your agent runs on{" "}
          <span className="text-foreground">{state.runtime ?? "OpenClaw"}</span>, which doesn&rsquo;t
          have a native Farcaster channel.
        </p>
      )}
    </div>
  );
}
