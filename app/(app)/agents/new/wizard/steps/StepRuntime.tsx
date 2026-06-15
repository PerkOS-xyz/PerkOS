import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

import type { AgentRuntime } from "@/app/lib/perkosApi";
import { fetchActiveRuntimes, type RuntimeImage } from "@/app/lib/runtimeImages";

import type { StepProps } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { SelectableCard } from "../ui/SelectableCard";

// Static marketing copy per runtime kind. Merged with the dynamic image
// list pulled from the admin's curation.
const RUNTIME_COPY: Record<AgentRuntime, {
  title: string;
  summary: string;
  bullets: string[];
}> = {
  OpenClaw: {
    title: "OpenClaw",
    summary: "Autonomous executor focused on long-running, tool-driven workflows.",
    bullets: [
      "Strong at multi-step task execution",
      "Built-in browser and code-runner tooling",
      "Best for research, automation, and ops",
    ],
  },
  Hermes: {
    title: "Hermes",
    summary: "Conversational + tooling agent optimized for fast interactive replies.",
    bullets: [
      "Optimized for chat-driven workflows",
      "Strong message-routing across channels",
      "Best for customer ops and creative work",
    ],
  },
};

export function StepRuntime({ state, onChange }: StepProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wizard", "runtimes"],
    queryFn: fetchActiveRuntimes,
  });

  // Build the option list dynamically: a runtime kind only appears if the
  // admin has activated ≥1 image for it. The first (newest) active image
  // becomes the default imageTag when the user selects the card.
  const options: { runtime: AgentRuntime; latest: RuntimeImage }[] = [];
  if (data) {
    if (data.openclaw.length > 0) options.push({ runtime: "OpenClaw", latest: data.openclaw[0] });
    if (data.hermes.length > 0) options.push({ runtime: "Hermes", latest: data.hermes[0] });
  }

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="Choose a runtime"
        description="Both work with PerkOS-Transport, swarm coordination, and the Council. The version shown for each is the one the PerkOS team has approved for this release."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading available runtimes…</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load runtimes. {error instanceof Error ? error.message : ""}
        </p>
      ) : options.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No runtimes available</CardTitle>
            <CardDescription>
              The admin hasn&apos;t activated any runtime images yet. Check back
              shortly, or reach out to the team.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <RadioGroup
          value={state.runtime ?? ""}
          onValueChange={(v) => {
            const opt = options.find((o) => o.runtime === v);
            onChange({
              runtime: v as AgentRuntime,
              imageTag: opt?.latest.primaryTag ?? null,
            });
          }}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {options.map(({ runtime, latest }) => {
            const copy = RUNTIME_COPY[runtime];
            return (
              <SelectableCard
                key={runtime}
                selected={state.runtime === runtime}
                onClick={() => onChange({ runtime, imageTag: latest.primaryTag })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-medium text-foreground">{copy.title}</span>
                    <p className="text-sm text-muted-foreground">{copy.summary}</p>
                  </div>
                  <RadioGroupItem value={runtime} id={`runtime-${runtime}`} />
                </div>
                <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
                  {copy.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {latest.upstreamVersion ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {copy.title} {latest.upstreamVersion}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">
                      {latest.displayName ?? latest.primaryTag}
                    </Badge>
                  )}
                  {latest.channel === "beta" ? (
                    <Badge className="bg-amber-500 text-[10px] text-white">BETA</Badge>
                  ) : null}
                  <span className="truncate font-mono">{latest.primaryTag}</span>
                </div>
              </SelectableCard>
            );
          })}
        </RadioGroup>
      )}
    </div>
  );
}
