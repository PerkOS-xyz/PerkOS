"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
import { hasFreshAgentHeartbeat } from "../../../lib/agentHostingPolicy";

/** An invite that hasn't connected within this window reads as "never connected". */
const STALE_AFTER_MS = 30 * 60 * 1000;

type ConnState =
  | { kind: "connected" }
  | { kind: "revoked" }
  | { kind: "waiting" }
  | { kind: "stale" };

function connState(agent: AgentRow): ConnState {
  if (agent.revoked) return { kind: "revoked" };
  if (hasFreshAgentHeartbeat(agent)) return { kind: "connected" };
  const everSeen = Boolean(agent.lastBridgeSeenAt);
  if (everSeen) return { kind: "waiting" }; // connected before, currently away
  const created = agent.createdAt ? Date.parse(agent.createdAt) : NaN;
  const old = Number.isFinite(created) && Date.now() - created > STALE_AFTER_MS;
  return old ? { kind: "stale" } : { kind: "waiting" };
}

export function InvitedCredentialPanel({ agent }: { agent: AgentRow }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [promptOpen, setPromptOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [shownPrompt, setShownPrompt] = useState<string | null>(null);
  const [shownCommand, setShownCommand] = useState<string | null>(null);

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
      setShownCommand(data.inviteCommand);
      setPromptOpen(true);
      toast.success(t("agentDetail.invitedCredential.rotated"));
      queryClient.invalidateQueries({ queryKey: ["relay-key", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", agent.walletAddress] });
    },
    onError: (err: Error) => toast.error(t("agentDetail.invitedCredential.rotateError"), { description: err.message }),
    onSettled: () => setRotateOpen(false),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeRelayKey(agent.id),
    onSuccess: () => {
      setShownPrompt(null);
      setShownCommand(null);
      setPromptOpen(false);
      toast.success(t("agentDetail.invitedCredential.revokedToast", { name: agent.name }));
      queryClient.invalidateQueries({ queryKey: ["relay-key", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", agent.walletAddress] });
    },
    onError: (err: Error) => toast.error(t("agentDetail.invitedCredential.revokeError"), { description: err.message }),
    onSettled: () => setRevokeOpen(false),
  });

  const revoked = state.kind === "revoked";
  const promptText = shownPrompt ?? promptQuery.data?.invitePrompt ?? null;
  const commandText = shownCommand ?? promptQuery.data?.inviteCommand ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            {t("agentDetail.invitedCredential.title")}
          </CardTitle>
          <StatusBadge state={state} />
        </div>
        <CardDescription>
          {t("agentDetail.invitedCredential.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state.kind === "stale" ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
            {t("agentDetail.invitedCredential.staleHelp")}
          </p>
        ) : null}
        {revoked ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {t("agentDetail.invitedCredential.revokedHelp")}
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
            {promptOpen ? t("agentDetail.invitedCredential.hidePrompt") : t("agentDetail.invitedCredential.showPrompt")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setRotateOpen(true)}
          >
            <RotateCcw className="h-4 w-4" />
            {t("agentDetail.invitedCredential.rotate")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={revoked}
            onClick={() => setRevokeOpen(true)}
          >
            <ShieldOff className="h-4 w-4" />
            {t("agentDetail.invitedCredential.revoke")}
          </Button>
        </div>

        {promptOpen ? (
          <PromptBlock loading={promptQuery.isLoading} prompt={promptText} command={commandText} />
        ) : null}
      </CardContent>

      <ConfirmDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        title={t("agentDetail.invitedCredential.rotateTitle")}
        description={t("agentDetail.invitedCredential.rotateDescription")}
        confirmLabel={t("agentDetail.invitedCredential.rotate")}
        pending={rotateMutation.isPending}
        onConfirm={() => rotateMutation.mutate()}
      />
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title={t("agentDetail.invitedCredential.revokeTitle")}
        description={t("agentDetail.invitedCredential.revokeDescription")}
        confirmLabel={t("agentDetail.invitedCredential.revoke")}
        destructive
        pending={revokeMutation.isPending}
        onConfirm={() => revokeMutation.mutate()}
      />
    </Card>
  );
}

function StatusBadge({ state }: { state: ConnState }) {
  const { t } = useTranslation();
  switch (state.kind) {
    case "connected":
      return <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-300">{t("agentDetail.invitedCredential.connected")}</Badge>;
    case "revoked":
      return <Badge variant="destructive">{t("agentDetail.invitedCredential.revoked")}</Badge>;
    case "stale":
      return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-300">{t("agentDetail.invitedCredential.neverConnected")}</Badge>;
    default:
      return <Badge variant="secondary">{t("agentDetail.invitedCredential.waiting")}</Badge>;
  }
}

function PromptBlock({ loading, prompt, command }: { loading: boolean; prompt: string | null; command: string | null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<"prompt" | "command" | null>(null);
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("agentDetail.invitedCredential.loadingPrompt")}
      </div>
    );
  }
  if (!prompt) {
    return (
      <p className="text-sm text-muted-foreground">{t("agentDetail.invitedCredential.noPrompt")}</p>
    );
  }
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t("agentDetail.invitedCredential.secretHint")}
        </span>
        <div className="flex flex-wrap gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              setCopied("prompt");
              setTimeout(() => setCopied(null), 1500);
            } catch {
              /* clipboard blocked — ignore */
            }
          }}
        >
          {copied === "prompt" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "prompt" ? t("agentDetail.common.copied") : t("agentDetail.invitedCredential.copyInstructions")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5"
          disabled={!command}
          onClick={async () => {
            if (!command) return;
            try {
              await navigator.clipboard.writeText(command);
              setCopied("command");
              setTimeout(() => setCopied(null), 1500);
            } catch {
              /* clipboard blocked — ignore */
            }
          }}
        >
          {copied === "command" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "command" ? t("agentDetail.common.copied") : t("agentDetail.invitedCredential.copyCommand")}
        </Button>
        </div>
      </div>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
        {prompt}
      </pre>
    </div>
  );
}
