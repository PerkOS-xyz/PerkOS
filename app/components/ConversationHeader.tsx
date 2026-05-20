"use client";

import { Bot, Circle, FileSignature, Hash, MessageSquare, Pencil } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { updateConversation, type Conversation } from "../lib/conversationsApi";
import { useChatClientStatus } from "../lib/useChatClient";
import { ReceiptDialog } from "./ReceiptDialog";

type Props = {
  conversation: Conversation;
  walletAddress: string;
};

export function ConversationHeader({ conversation, walletAddress }: Props) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const KindIcon = conversation.kind === "channel" ? Hash : MessageSquare;
  const { status } = useChatClientStatus();

  const agents = conversation.participants
    .filter((p) => p.startsWith("agent:"))
    .map((p) => p.slice("agent:".length));

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-background/60 px-4 py-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <KindIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex min-w-0 flex-col leading-tight">
          <h1 className="truncate text-sm font-medium text-foreground">
            {conversation.title || "Untitled conversation"}
          </h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {agents.length === 0 ? (
              "No agents in this conversation"
            ) : (
              <span className="inline-flex items-center gap-1">
                <Bot className="h-3 w-3" />
                {agents.join(", ")}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ConnectionBadge status={status} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Generate signed receipt"
          title="Generate signed receipt"
          onClick={() => setReceiptOpen(true)}
          className="h-7 w-7 p-0"
        >
          <FileSignature className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Rename conversation"
          onClick={() => setRenameOpen(true)}
          className="h-7 w-7 p-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        conversation={conversation}
        walletAddress={walletAddress}
      />
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        conversation={conversation}
        walletAddress={walletAddress}
      />
    </header>
  );
}

function ConnectionBadge({ status }: { status: ReturnType<typeof useChatClientStatus>["status"] }) {
  const tone =
    status === "connected"
      ? "text-emerald-400"
      : status === "authing" || status === "connecting"
      ? "text-amber-400"
      : status === "auth-error"
      ? "text-destructive"
      : "text-muted-foreground";
  const label =
    status === "connected"
      ? "Live"
      : status === "authing"
      ? "Authing"
      : status === "connecting"
      ? "Connecting"
      : status === "auth-error"
      ? "Auth error"
      : status === "disconnected"
      ? "Offline"
      : "Idle";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px]",
        tone,
      )}
      title={`Chat connection: ${label}`}
    >
      <Circle className="h-2 w-2 fill-current" />
      {label}
    </span>
  );
}

function RenameDialog({
  open,
  onOpenChange,
  conversation,
  walletAddress,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: Conversation;
  walletAddress: string;
}) {
  const [value, setValue] = useState(conversation.title || "");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (!next || next === conversation.title) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    try {
      await updateConversation({
        walletAddress,
        convId: conversation.id,
        title: next,
      });
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Only the title is stored in Firestore. Message content stays on
              the host agent.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            placeholder="New title"
            maxLength={120}
            disabled={pending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !value.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
