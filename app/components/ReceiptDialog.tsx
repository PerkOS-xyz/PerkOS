"use client";

import { Anchor, Check, Copy, Download, FileSignature, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useAccount,
  useSignMessage,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import type { Address, Hex } from "viem";

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
import {
  PERKOS_RECEIPT_ANCHOR_ABI,
  findAnchoredEvent,
  receiptIdFromManifest,
  reconcileAnchorEvent,
  toBytes32Hex,
} from "../lib/receiptAnchor";

const ANCHOR_ADDRESS = process.env.NEXT_PUBLIC_RECEIPT_ANCHOR_ADDRESS as
  | Address
  | undefined;
// Narrow to the chain ids wagmi.ts actually registers so the wagmi hooks
// type-check. Add new chains both here and in wagmi.ts.
type SupportedAnchorChainId = 8453 | 84532;
const SUPPORTED_ANCHOR_CHAINS: readonly SupportedAnchorChainId[] = [8453, 84532];
function resolveAnchorChainId(): SupportedAnchorChainId | undefined {
  const raw = process.env.NEXT_PUBLIC_RECEIPT_ANCHOR_CHAIN_ID;
  if (!raw) return undefined;
  const n = Number(raw);
  return SUPPORTED_ANCHOR_CHAINS.find((id) => id === n);
}
const ANCHOR_CHAIN_ID = resolveAnchorChainId();

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  walletAddress: string;
};

type Stage =
  | "idle"
  | "hashing"
  | "signing"
  | "writing"
  | "done"
  | "error"
  | "anchoring"
  | "anchored";

type AnchorState = {
  txHash: Hex;
  blockNumber: bigint;
  receiptId: Hex;
  anchoredAt: bigint;
};

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
  const { chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [copied, setCopied] = useState(false);
  const [anchorTxHash, setAnchorTxHash] = useState<Hex | null>(null);
  const [anchorState, setAnchorState] = useState<AnchorState | null>(null);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  const anchorEnabled =
    Boolean(ANCHOR_ADDRESS) && Boolean(ANCHOR_CHAIN_ID);

  const { data: txReceipt, isLoading: waitingForTx } =
    useWaitForTransactionReceipt({
      hash: anchorTxHash ?? undefined,
      chainId: ANCHOR_CHAIN_ID,
    });

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStage("idle");
    setError(null);
    setReceipt(null);
    setCopied(false);
    setAnchorTxHash(null);
    setAnchorState(null);
    setAnchorError(null);
  }, [open]);

  // Once the anchor tx mines, decode the event and reconcile against the
  // signed manifest. Mismatches are surfaced as warnings — the on-chain
  // record exists but doesn't agree with the off-chain claim.
  useEffect(() => {
    if (!txReceipt || !receipt || !ANCHOR_ADDRESS) return;
    const decoded = findAnchoredEvent(txReceipt.logs, ANCHOR_ADDRESS);
    if (!decoded) {
      setAnchorError("Anchor tx mined but the ReceiptAnchored event was not found.");
      setStage("anchored");
      return;
    }
    const reconcile = reconcileAnchorEvent(receipt, decoded);
    if (!reconcile.ok) {
      setAnchorError(
        reconcile.reason === "wallet_mismatch"
          ? "On-chain anchor commits a DIFFERENT wallet than the signed manifest."
          : "On-chain anchor commits a DIFFERENT transcript hash than the signed manifest.",
      );
    }
    setAnchorState({
      txHash: txReceipt.transactionHash,
      blockNumber: txReceipt.blockNumber,
      receiptId: decoded.receiptId,
      anchoredAt: decoded.anchoredAt,
    });
    setStage("anchored");
  }, [txReceipt, receipt]);

  async function anchorOnChain() {
    if (!receipt || !ANCHOR_ADDRESS || !ANCHOR_CHAIN_ID) return;
    setAnchorError(null);
    setStage("anchoring");
    try {
      if (walletChainId !== ANCHOR_CHAIN_ID) {
        await switchChainAsync({ chainId: ANCHOR_CHAIN_ID });
      }
      const receiptId = receiptIdFromManifest(receipt.manifest);
      const transcriptHash = toBytes32Hex(receipt.manifest.transcriptHash);
      const hash = await writeContractAsync({
        address: ANCHOR_ADDRESS,
        abi: PERKOS_RECEIPT_ANCHOR_ABI,
        functionName: "anchor",
        args: [receiptId, transcriptHash],
        chainId: ANCHOR_CHAIN_ID,
      });
      setAnchorTxHash(hash);
      // stage stays "anchoring" until useWaitForTransactionReceipt resolves
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnchorError(msg);
      setStage("done");
    }
  }

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

  const isBusy =
    stage === "hashing" ||
    stage === "signing" ||
    stage === "writing" ||
    stage === "anchoring" ||
    waitingForTx;
  const showDoneFooter = stage === "done" || stage === "anchoring" || stage === "anchored";

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
              {stage === "anchoring" &&
                (waitingForTx
                  ? "Waiting for the anchor tx to mine…"
                  : "Confirm the anchor tx in your wallet…")}
            </span>
          </div>
        ) : null}

        {showDoneFooter && receipt ? (
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

            {/* On-chain anchor panel: visible whenever the anchor address is
                configured. Status reflects the lifecycle: idle → tx pending
                → mined + reconciled (or warning on mismatch). */}
            {anchorEnabled ? (
              <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    on-chain anchor
                  </span>
                  {anchorState ? (
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                      anchored
                    </span>
                  ) : stage === "anchoring" ? (
                    <span className="rounded-full border border-primary/40 px-2 py-0.5 font-mono text-[10px] text-primary">
                      pending
                    </span>
                  ) : (
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                      off-chain only
                    </span>
                  )}
                </div>
                {anchorState ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Block #{anchorState.blockNumber.toString()} on chain{" "}
                      {ANCHOR_CHAIN_ID}. Anyone can replay the
                      <code className="mx-1 font-mono text-[10px]">
                        ReceiptAnchored
                      </code>
                      event to confirm this transcript existed at consensus
                      time.
                    </p>
                    <code className="select-all break-all font-mono text-[10px] text-muted-foreground">
                      {anchorState.txHash}
                    </code>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Publish a 32-byte commitment of this receipt to{" "}
                    {ANCHOR_CHAIN_ID === 84532 ? "Base Sepolia" : "Base"}. No
                    conversation content is sent on-chain — only the hash.
                  </p>
                )}
                {anchorError ? (
                  <p className="text-xs text-destructive">{anchorError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {showDoneFooter ? (
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
              {anchorEnabled && !anchorState ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={anchorOnChain}
                  disabled={stage === "anchoring" || waitingForTx}
                >
                  {stage === "anchoring" || waitingForTx ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Anchor className="h-3.5 w-3.5" />
                  )}
                  Anchor on-chain
                </Button>
              ) : null}
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
