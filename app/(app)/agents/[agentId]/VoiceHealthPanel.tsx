"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Loader2, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgentVoiceHealthApi } from "@/app/lib/perkosApi";
import { summarizeVoiceHealthCodes } from "@/app/lib/agentVoiceHealth";

type Props = {
  agentId: string;
  agentName: string;
  owner: boolean;
};

export function VoiceHealthPanel({ agentId, agentName, owner }: Props) {
  const query = useQuery({
    queryKey: ["agent-voice-health", agentId],
    queryFn: () => getAgentVoiceHealthApi(agentId),
    enabled: owner && Boolean(agentId),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  if (!owner) return null;

  const health = query.data?.health;
  const recent = query.data?.recent ?? [];
  const ready = health?.ready === true;
  const codes = health?.codes ?? [];

  return (
    <Card data-testid="voice-health-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
          Voice health
        </CardTitle>
        <CardDescription>
          Owner-only diagnostics for {agentName}. Fixed stage codes from the gateway doctor —
          no chat content, audio, or secrets. External agents self-heal on their host; PerkOS
          only shows what failed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
            Refresh health
          </Button>
          {health ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                ready
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
              }`}
              data-testid="voice-health-status"
            >
              {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {ready ? "Doctor ready" : health.status === "stale" ? "Stale report" : health.status === "unknown" ? "No report yet" : "Needs attention"}
            </span>
          ) : null}
        </div>

        {query.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {query.error instanceof Error ? query.error.message : "Failed to load voice health"}
          </p>
        ) : null}

        {health ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Codes: <span className="font-mono text-foreground">{summarizeVoiceHealthCodes(codes)}</span>
              {health.checkedAt ? (
                <>
                  {" "}
                  · checked {new Date(health.checkedAt).toLocaleString()}
                  {health.source ? ` · ${health.source}` : ""}
                </>
              ) : null}
            </p>
            {health.capabilityAvailable === false ? (
              <p className="text-xs text-muted-foreground">
                Public capability: unavailable
                {health.capabilityReason ? ` (${health.capabilityReason})` : ""}. Call stays hidden until the gateway publishes ready.
              </p>
            ) : null}
          </div>
        ) : query.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading health…
          </p>
        ) : null}

        {health?.playbooks && health.playbooks.length > 0 ? (
          <ul className="flex flex-col gap-3" data-testid="voice-health-playbooks">
            {health.playbooks.map((book) => (
              <li key={book.code} className="rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                <p className="text-sm font-medium">{book.title}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{book.code}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                  {book.ownerActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        ) : ready ? (
          <p className="text-sm text-muted-foreground">
            Last report is green. Owners can still run <code className="text-xs">perkos-voice-doctor</code> on the gateway host anytime.
          </p>
        ) : null}

        {recent.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent signals</p>
            <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground" data-testid="voice-health-recent">
              {recent.slice(0, 8).map((event, index) => (
                <li key={`${event.recordedAt ?? event.checkedAt ?? index}-${event.codes.join(",")}`} className="font-mono">
                  {(event.recordedAt ?? event.checkedAt ?? "—").slice(0, 19)} · {event.ready ? "ok" : event.codes.join(",") || "unknown"}
                  {event.source ? ` · ${event.source}` : ""}
                  {event.stage ? ` · ${event.stage}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
