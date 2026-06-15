"use client";

import { useMemo, useState } from "react";
import {
  Layers,
  Check,
  Plus,
  Send,
  Hash,
  MessageSquare,
  GitFork,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { AgentRuntime } from "@/app/lib/perkosApi";
import { findPreset } from "@/app/lib/agentPresets";
import {
  SKILLS_CATALOG,
  findSkillPack,
  parseUserRepo,
  runtimeCompatLabel,
  type SkillPack,
} from "@/app/lib/skillsCatalog";

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { GatewayCard } from "../ui/GatewayCard";

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

export function StepCapabilities({ state, onChange }: StepProps) {
  const preset = findPreset(state.personaId);
  const channels = state.runtime
    ? CHANNELS.filter((c) => c.runtimes.includes(state.runtime!))
    : CHANNELS;

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
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-md",
                      active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
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
                    : "border-border bg-card hover:border-primary/40",
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

  const packs = useMemo(() => {
    const byId = new Map<string, SkillPack>();
    for (const p of SKILLS_CATALOG) byId.set(p.id, p);
    for (const p of state.communitySkills) byId.set(p.id, p);
    const all = Array.from(byId.values());
    const rec = new Set(recommendedSkillIds);
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
          Markdown skill packs from public GitHub repos. They&rsquo;re injected into
          your agent&rsquo;s instructions. You can inspect each on GitHub.
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
                    <span className="text-sm font-medium text-foreground">{pack.name}</span>
                    {isRecommended ? (
                      <Badge
                        variant="secondary"
                        className="border-primary/30 bg-primary/10 text-primary"
                      >
                        Recommended
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{pack.description}</span>
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
                <span className="text-[11px] text-muted-foreground">by {pack.author}</span>
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

// ---------------------------------------------------------------------------
// Messaging gateways (MVP: Telegram + Slack + Farcaster). Secrets are held in
// component state ONLY until the launch mutation's onSuccess posts them to
// /api/agents/{agentId}/gateways. Nothing is persisted to localStorage and
// nothing rides on the launch payload itself.
// ---------------------------------------------------------------------------

function StepGateways({ state, onChange }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-foreground">Messaging gateways</h3>
      <p className="text-xs text-muted-foreground">
        Lets your agent receive messages from outside PerkOS. Secrets stay in a
        managed secrets vault under your wallet&rsquo;s namespace — never in the
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
