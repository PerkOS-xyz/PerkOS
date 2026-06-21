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

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { SummaryRow } from "../ui/SummaryRow";

export function StepReview({ state, onChange }: StepProps) {
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
              state.method === "perkos"
                ? "PerkOS infra"
                : state.method === "vps"
                  ? "Self-hosted (your infra)"
                  : "—"
            }
            icon={state.method === "perkos" ? Cloud : Server}
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
            label="Skills"
            value={
              state.skills.length === 0
                ? "Built-in tools only"
                : `${state.skills.length} skill pack${state.skills.length === 1 ? "" : "s"}`
            }
            icon={Layers}
          />
          <SummaryRow
            label="Channels"
            value={
              [
                state.gatewayTelegramEnabled ? "Telegram" : null,
                state.gatewaySlackEnabled ? "Slack" : null,
                state.gatewayFarcasterEnabled && state.runtime === "Hermes" ? "Farcaster" : null,
              ]
                .filter(Boolean)
                .join(", ") || "PerkOS only"
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
