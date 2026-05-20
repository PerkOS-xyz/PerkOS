"use client";

import { Check, Copy, Download, FileSignature, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useSignMessage } from "wagmi";

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

import { useChatClient } from "../lib/useChatClient";
import type { Conversation } from "../lib/conversationsApi";
import {
  createReceipt,
  stableStringify,
  type Receipt,
  type ReceiptManifest,
  RECEIPT_VERSION,
} from "../lib/receiptsApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  walletAddress: string;
};

type Stage = "idle" | "hashing" | "signing" | "writing" | "done" | "error";

/**
 * Generates a signed receipt for the conversation.
 *
 *   1. Ask the host agent (via chat.perkos.xyz WS) for the sha256
 *      of its local jsonl + metadata.
 *   2. Build a canonical ReceiptManifest from the response.
 *   3. Ask the wallet to personal_sign(stableStringify(manifest)).
 *   4. Write the signed Receipt to Firestore under
 *      /wallets/{addr}/receipts/{id}.
 *
 * The manifest is reproducible: anyone with the host agent's jsonl can
 * recompute the hash, then verify the signature via ecrecover.
 */
export function ReceiptDialog({
  open,
  onOpenChange,
  conversation,
  walletAddress,
}: Props) {
  const client = useChatClient();
  const { signMessageAsync } = useSignMessage();

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStage("idle");
    setError(null);
    setReceipt(null);
    setCopied(false);
  }, [open]);

  async function generate() {
    if (!client) {
      setError("Chat client not connected.");
      return;
    }
    setError(null);
    try {
      setStage("hashing");
      const summary = await client.requestReceipt({ convId: conversation.id });
      if (!summary.transcriptHash) {
        setError("This conversation has no messages yet.");
        setStage("error");
        return;
      }

      const manifest: ReceiptManifest = {
        version: RECEIPT_VERSION,
        convId: conversation.id,
        walletAddress: walletAddress.toLowerCase(),
        participants: conversation.participants,
        historyHost: conversation.historyHost,
        hostAgent: summary.hostAgent as ReceiptManifest["hostAgent"],
        transcriptHash: summary.transcriptHash,
        hashAlgo: "sha256",
        messageCount: summary.messageCount,
        firstMessageAt: summary.firstMessageAt,
        lastMessageAt: summary.lastMessageAt,
        generatedAt: summary.generatedAt,
      };

      setStage("signing");
      const canonical = stableStringify(manifest);
      const signedMessage = await signMessageAsync({ message: canonical });

      setStage("writing");
      const receiptId = `${conversation.id}-${Date.now().toString(36)}`;
      const finalReceipt: Receipt = {
        id: receiptId,
        manifest,
        signature: {
          signedMessage,
          signer: walletAddress.toLowerCase(),
          signedAt: new Date().toISOString(),
        },
      };
      await createReceipt(walletAddress, receiptId, manifest, finalReceipt.signature);
      setReceipt(finalReceipt);
      setStage("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setStage("error");
    }
  }

  async function copyJson() {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  function downloadJson() {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receipt.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const isBusy = stage === "hashing" || stage === "signing" || stage === "writing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            Generate signed receipt
          </DialogTitle>
          <DialogDescription>
            A tamper-evident attestation of this conversation. The host
            agent produces a sha256 hash of its local transcript; your
            wallet signs the manifest. The receipt is verifiable
            off-chain by anyone with the transcript — and on-chain in
            the future when anchored to Base.
          </DialogDescription>
        </DialogHeader>

        {stage === "idle" || stage === "error" ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-1.5">
                <Shield className="mt-0.5 h-3 w-3 text-primary" />
                Only a hash + counts + timestamps cross the wire. Bodies
                stay on the host agent.
              </li>
              <li className="flex items-start gap-1.5">
                <Shield className="mt-0.5 h-3 w-3 text-primary" />
                Your wallet signs the manifest; the signature can be
                recovered to your address.
              </li>
              <li className="flex items-start gap-1.5">
                <Shield className="mt-0.5 h-3 w-3 text-primary" />
                Stored in your wallet&apos;s receipts collection — immutable
                after creation.
              </li>
            </ul>
            {error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {isBusy ? (
          <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>
              {stage === "hashing" && "Asking host agent for transcript hash…"}
              {stage === "signing" && "Confirm in your wallet to sign the manifest…"}
              {stage === "writing" && "Writing receipt to Firestore…"}
            </span>
          </div>
        ) : null}

        {stage === "done" && receipt ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <p className="font-medium">Receipt signed</p>
                <p className="text-emerald-300/70">
                  {receipt.manifest.messageCount} message
                  {receipt.manifest.messageCount === 1 ? "" : "s"} · sha256
                  hash + wallet signature stored. Anyone with the
                  transcript can verify.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                transcriptHash
              </span>
              <code className="select-all break-all rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px]">
                {receipt.manifest.transcriptHash}
              </code>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                signature
              </span>
              <code
                className={cn(
                  "select-all break-all rounded-md border border-border bg-card px-3 py-2 font-mono text-[10px]",
                )}
              >
                {receipt.signature.signedMessage}
              </code>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {stage === "done" ? (
            <>
              <Button type="button" variant="outline" onClick={copyJson}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy JSON
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={downloadJson}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              <Button type="button" onClick={generate} disabled={isBusy || !client}>
                {stage === "error" ? "Try again" : "Generate receipt"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
