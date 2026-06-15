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
  const providerOpts = state.runtime ? byokProviderOptions(state.runtime) : [];
  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="LLM source"
        description="Pick how the agent reaches its model. Each runtime gets a config block in its native shape — preview on the review step."
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
                  PerkOS LLM service
                </span>
                {!llmAllowed ? (
                  <Badge
                    variant="secondary"
                    className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    Coming soon
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Managed Ollama-compatible gateway at{" "}
                <code className="rounded bg-muted px-1 font-mono text-[11px]">
                  api.llm.perkos.xyz
                </code>{" "}
                — kimi-k2.6:cloud + qwen 7B/14B. No key needed; we issue one
                scoped to your agent.
              </p>
              {!llmAllowed ? (
                <p className="text-xs text-muted-foreground">
                  Currently invite-only while we test. Pick BYOK or
                  &ldquo;Configure later&rdquo; for now, or contact an admin to be
                  added to the early access list.
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
                  Bring your own key (BYOK)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Use your own provider key. We forward it to the agent runtime —
                never log or proxy your traffic.
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
                  Configure later
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Agent boots without an LLM source. Useful for testing transport +
                tool calls only.
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
                ? "OpenClaw provider settings"
                : "Hermes provider settings"}
            </CardTitle>
            <CardDescription>
              {state.runtime === "OpenClaw"
                ? "Fields map 1:1 to a block under models.providers.* in openclaw.json."
                : "Fields map to provider.* + secrets.* in your Hermes profile's config.yaml."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="byok-provider">Provider</Label>
              <Select
                value={state.byokProvider}
                onValueChange={(v) => {
                  const id = v ?? "";
                  const opt = providerOpts.find((p) => p.id === id);
                  onChange({ byokProvider: id, byokModel: opt?.defaultModel ?? "" });
                }}
              >
                <SelectTrigger id="byok-provider">
                  <SelectValue placeholder="Pick a provider" />
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
              <Label htmlFor="byok-model">Default model</Label>
              <Input
                id="byok-model"
                value={state.byokModel}
                onChange={(e) => onChange({ byokModel: e.target.value })}
                placeholder="claude-sonnet-4-5"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="byok-key">API key</Label>
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
