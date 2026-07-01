"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Loader2, Plus, RotateCcw, Webhook, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  getWebhookInfo,
  rotateWebhook,
  disableWebhook,
  type AgentRow,
} from "../../../lib/perkosApi";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

/**
 * Inbound webhook URL for an agent. An external service POSTs an event here;
 * PerkOS stores it, wakes the (hibernated) agent, and hands it the payload —
 * then the agent goes back to sleep. Reactive agents on a pay-when-working
 * substrate. Owner-only; mirrors the connection-credential panel.
 */
export function WebhookPanel({ agent }: { agent: AgentRow }) {
  const queryClient = useQueryClient();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [freshUrl, setFreshUrl] = useState<string | null>(null);

  const infoQuery = useQuery({
    queryKey: ["webhook", agent.id],
    queryFn: () => getWebhookInfo(agent.id),
  });

  const rotateMutation = useMutation({
    mutationFn: () => rotateWebhook(agent.id),
    onSuccess: (data) => {
      setFreshUrl(data.url);
      toast.success("Webhook URL ready — point your event source at it.");
      queryClient.invalidateQueries({ queryKey: ["webhook", agent.id] });
    },
    onError: (err: Error) => toast.error("Couldn't generate webhook URL", { description: err.message }),
    onSettled: () => setRotateOpen(false),
  });

  const disableMutation = useMutation({
    mutationFn: () => disableWebhook(agent.id),
    onSuccess: () => {
      setFreshUrl(null);
      toast.success(`${agent.name}'s webhook URL disabled.`);
      queryClient.invalidateQueries({ queryKey: ["webhook", agent.id] });
    },
    onError: (err: Error) => toast.error("Couldn't disable webhook", { description: err.message }),
    onSettled: () => setDisableOpen(false),
  });

  const hasToken = infoQuery.data?.hasToken ?? false;
  const url = freshUrl ?? infoQuery.data?.url ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4 text-muted-foreground" />
            Inbound webhook
          </CardTitle>
          <Badge variant={hasToken ? "secondary" : "outline"}>
            {hasToken ? "Active" : "Not set up"}
          </Badge>
        </div>
        <CardDescription>
          Give an external service a URL to reach this agent. When an event arrives, PerkOS
          wakes the agent (even if it&apos;s asleep), hands it the payload, then lets it rest
          again. Anyone with the URL can trigger the agent, so keep it private.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {infoQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : url ? (
          <UrlBlock url={url} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No webhook URL yet. Generate one to start sending events to this agent.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => (hasToken ? setRotateOpen(true) : rotateMutation.mutate())}
            disabled={rotateMutation.isPending}
          >
            {hasToken ? <RotateCcw className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {hasToken ? "Rotate URL" : "Generate URL"}
          </Button>
          {hasToken ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => setDisableOpen(true)}
            >
              <ShieldOff className="h-4 w-4" />
              Disable
            </Button>
          ) : null}
        </div>
      </CardContent>

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotate this webhook URL?"
        description="The current URL stops working immediately. You'll get a fresh one to re-point your event source at."
        confirmLabel="Rotate"
        pending={rotateMutation.isPending}
        onConfirm={() => rotateMutation.mutate()}
      />
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable this webhook URL?"
        description="The URL stops accepting events immediately. This is reversible — generate a new one later to re-enable inbound events."
        confirmLabel="Disable"
        destructive
        pending={disableMutation.isPending}
        onConfirm={() => disableMutation.mutate()}
      />
    </Card>
  );
}

function UrlBlock({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Treat this URL like a password — anyone who has it can wake your agent.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked — ignore */
            }
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-auto whitespace-pre-wrap break-all text-[11px] leading-relaxed text-muted-foreground">
        {url}
      </pre>
    </div>
  );
}
