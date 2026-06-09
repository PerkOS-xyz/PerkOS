"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, RotateCcw, ShieldOff } from "lucide-react";

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
  getRelayKeyInfo,
  rotateRelayKey,
  revokeRelayKey,
  type AgentRow,
} from "../../../lib/perkosApi";
import { ConfirmDialog } from "../../../components/ConfirmDialog";

/** An invite that hasn't connected within this window reads as "never connected". */
const STALE_AFTER_MS = 30 * 60 * 1000;

type ConnState =
  | { kind: "connected" }
  | { kind: "revoked" }
  | { kind: "waiting" }
  | { kind: "stale" };

function connState(agent: AgentRow): ConnState {
  if (agent.revoked) return { kind: "revoked" };
  if (agent.bridgeConnected === true) return { kind: "connected" };
  const everSeen = Boolean(agent.lastBridgeSeenAt);
  if (everSeen) return { kind: "waiting" }; // connected before, currently away
  const created = agent.createdAt ? Date.parse(agent.createdAt) : NaN;
  const old = Number.isFinite(created) && Date.now() - created > STALE_AFTER_MS;
  return old ? { kind: "stale" } : { kind: "waiting" };
}

export function InvitedCredentialPanel({ agent }: { agent: AgentRow }) {
  const queryClient = useQueryClient();
  const [promptOpen, setPromptOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [shownPrompt, setShownPrompt] = useState<string | null>(null);

  const state = useMemo(() => connState(agent), [agent]);

  // Lazily fetch the prompt only when the user asks to see it (it embeds the
  // secret relayApiKey, so we don't want it sitting in the page by default).
  const promptQuery = useQuery({
    queryKey: ["relay-key", agent.id],
    queryFn: () => getRelayKeyInfo(agent.id),
    enabled: promptOpen,
  });

  const rotateMutation = useMutation({
    mutationFn: () => rotateRelayKey(agent.id),
    onSuccess: (data) => {
      setShownPrompt(data.invitePrompt);
      setPromptOpen(true);
      toast.success("Credential rotated — re-hand the new prompt to your agent.");
      queryClient.invalidateQueries({ queryKey: ["relay-key", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", agent.walletAddress] });
    },
    onError: (err: Error) => toast.error("Couldn't rotate credential", { description: err.message }),
    onSettled: () => setRotateOpen(false),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeRelayKey(agent.id),
    onSuccess: () => {
      setShownPrompt(null);
      setPromptOpen(false);
      toast.success(`${agent.name}'s credential revoked. Rotate to re-issue one.`);
      queryClient.invalidateQueries({ queryKey: ["relay-key", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", agent.walletAddress] });
    },
    onError: (err: Error) => toast.error("Couldn't revoke credential", { description: err.message }),
    onSettled: () => setRevokeOpen(false),
  });

  const revoked = state.kind === "revoked";
  const promptText = shownPrompt ?? promptQuery.data?.invitePrompt ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Connection credential
          </CardTitle>
          <StatusBadge state={state} />
        </div>
        <CardDescription>
          This external agent connects with a secret <code>relayApiKey</code>. Re-show the
          onboarding prompt, rotate the key if it leaks, or revoke it to cut the agent off.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.kind === "stale" ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
            This agent was invited but has never connected. Make sure your runtime is
            running the bridge with this credential — re-show the prompt below to double-check
            the <code>docker run</code> command.
          </p>
        ) : null}
        {revoked ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            The credential is revoked — the agent can no longer reach the relay or the job
            board. Rotate to issue a fresh one and reconnect it.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={revoked}
            onClick={() => setPromptOpen((v) => !v)}
          >
            <KeyRound className="h-4 w-4" />
            {promptOpen ? "Hide prompt" : "Show invitation prompt"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setRotateOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Rotate credential
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={revoked}
            onClick={() => setRevokeOpen(true)}
          >
            <ShieldOff className="h-4 w-4" />
            Revoke
          </Button>
        </div>

        {promptOpen ? (
          <PromptBlock loading={promptQuery.isLoading} prompt={promptText} />
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title="Rotate this agent's credential?"
        description="The current relayApiKey stops working immediately. You'll get a fresh onboarding prompt to re-hand to your agent so it can reconnect."
        confirmLabel="Rotate"
        pending={rotateMutation.isPending}
        onConfirm={() => rotateMutation.mutate()}
      />
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke this agent's credential?"
        description="The agent will immediately lose access to chat and the job board. This is reversible — rotating later issues a new key."
        confirmLabel="Revoke"
        destructive
        pending={revokeMutation.isPending}
        onConfirm={() => revokeMutation.mutate()}
      />
    </Card>
  );
}

function StatusBadge({ state }: { state: ConnState }) {
  switch (state.kind) {
    case "connected":
      return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">Connected</Badge>;
    case "revoked":
      return <Badge variant="destructive">Revoked</Badge>;
    case "stale":
      return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-300">Never connected</Badge>;
    default:
      return <Badge variant="secondary">Waiting to connect</Badge>;
  }
}

function PromptBlock({ loading, prompt }: { loading: boolean; prompt: string | null }) {
  const [copied, setCopied] = useState(false);
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading prompt…
      </div>
    );
  }
  if (!prompt) {
    return (
      <p className="text-sm text-muted-foreground">No prompt available — the credential may be revoked.</p>
    );
  }
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Contains the secret relayApiKey — treat it like a password.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
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
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
        {prompt}
      </pre>
    </div>
  );
}
