"use client";

import { AlertTriangle, Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { LaunchAgentCredentials } from "../lib/perkosApi";

type Props = {
  open: boolean;
  credentials: LaunchAgentCredentials | null;
  /** Called when the user explicitly closes — guard against accidental dismiss. */
  onClose: () => void;
};

/**
 * One-shot reveal of an agent's freshly-issued `relayApiKey`.
 *
 * This is the **only** time the UI sees the key — after dismiss it is
 * server-only (stored only in `/agents/{name}.relayApiKey`, never returned
 * to the browser again). The dialog refuses to close until the user has
 * explicitly clicked "I saved it" so accidental dismiss won't lose the key.
 */
export function AgentKeyRevealDialog({ open, credentials, onClose }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState<null | "key" | "envblock">(null);

  if (!credentials) return null;

  async function copyText(text: string, kind: "key" | "envblock") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard blocked (Safari without focus, iframe, etc.) — fall back
      // to selecting the text manually so the user can Cmd+C.
    }
  }

  const envBlock = [
    `A2A_AGENT_NAME=${credentials.agentName}`,
    `A2A_RELAY_API_KEY=${credentials.relayApiKey}`,
    `A2A_RELAY_URL=${credentials.transportUrl}`,
    `A2A_CHAT_ENABLED=true`,
    `A2A_CHAT_URL=${credentials.chatUrl}`,
  ].join("\n");

  return (
    <Dialog
      open={open}
      // Force explicit close — the X button is removed below.
      onOpenChange={(next) => {
        if (!next && !acknowledged) return; // ignore
        if (!next) onClose();
      }}
    >
      {/* grid-cols-[minmax(0,1fr)]: the base DialogContent is a `grid`, whose
          implicit `auto` column sizes to the widest child's max-content — the
          long unbroken relay key / env line blew the column (and its content)
          past the panel's right edge. Pinning the column to minmax(0,1fr) makes
          it fill the panel and lets the key wrap / env block scroll inside it.
          sm:max-w-lg overrides the base sm:max-w-sm so the panel is actually
          wide enough for the env block. */}
      <DialogContent className="sm:max-w-lg grid-cols-[minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Agent credentials — save these now
          </DialogTitle>
          <DialogDescription>
            This is the only time PerkOS shows the relay key. After you close
            this dialog the key is stored server-side only and can&apos;t be
            re-fetched. If you lose it, you&apos;ll have to revoke the agent
            and provision a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Treat <b>relayApiKey</b> like a password. Anyone with this key
              can impersonate <span className="font-mono">{credentials.agentName}</span>
              {" "}across PerkOS.
            </span>
          </div>

          {/* Single key */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              relayApiKey
            </label>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground">
                {credentials.relayApiKey}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText(credentials.relayApiKey, "key")}
                aria-label="Copy relayApiKey"
                className="h-auto"
              >
                {copied === "key" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Env block */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Ready-to-paste env block (perkos-a2a-agent)
            </label>
            <pre className="overflow-x-auto rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px] text-foreground">
              {envBlock}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyText(envBlock, "envblock")}
              className="self-start"
            >
              {copied === "envblock" ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied env
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy env
                </>
              )}
            </Button>
          </div>

          {/* Acknowledgement */}
          <label
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors",
              acknowledged
                ? "border-primary/40"
                : "border-border hover:border-primary/30",
            )}
          >
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-foreground">
              I have copied the key somewhere safe. I understand it
              won&apos;t be shown again.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={onClose}
            disabled={!acknowledged}
          >
            Continue to agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
