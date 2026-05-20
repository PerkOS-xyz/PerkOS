"use client";

import Link from "next/link";
import { Archive, Hash, MessageSquare, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { formatRelativeShort } from "../lib/format";
import {
  deleteConversation,
  dmCounterparty,
  updateConversation,
  type Conversation,
} from "../lib/conversationsApi";

type Props = {
  conversation: Conversation;
  walletAddress: string;
  active: boolean;
  onRename?: (conv: Conversation) => void;
};

export function ConversationListItem({
  conversation,
  walletAddress,
  active,
  onRename,
}: Props) {
  const [pending, setPending] = useState<"pin" | "archive" | "delete" | null>(null);

  const counterparty = dmCounterparty(conversation, walletAddress);
  const displayName =
    conversation.title?.trim() ||
    (conversation.kind === "dm" && counterparty
      ? counterparty.slice("agent:".length)
      : "Untitled");

  const Icon = conversation.kind === "channel" ? Hash : MessageSquare;
  const when = formatRelativeShort(conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt);

  async function togglePin() {
    setPending("pin");
    try {
      await updateConversation({
        walletAddress,
        convId: conversation.id,
        pinned: !conversation.pinned,
      });
    } finally {
      setPending(null);
    }
  }

  async function toggleArchive() {
    setPending("archive");
    try {
      await updateConversation({
        walletAddress,
        convId: conversation.id,
        archived: !conversation.archived,
      });
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete “${displayName}”? This removes the conversation metadata. Message history on the host agent stays on its disk.`)) return;
    setPending("delete");
    try {
      await deleteConversation(walletAddress, conversation.id);
    } finally {
      setPending(null);
    }
  }

  return (
    <li className="group relative">
      <Link
        href={`/chat/${encodeURIComponent(conversation.id)}`}
        prefetch={false}
        className={cn(
          "flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm transition-colors",
          active
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
          pending && "opacity-50",
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate" title={displayName}>
          {displayName}
        </span>
        {conversation.pinned ? (
          <Pin className="h-3 w-3 shrink-0 text-primary" aria-label="Pinned" />
        ) : null}
        {when ? (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/80">
            {when}
          </span>
        ) : null}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Actions for ${displayName}`}
              className="absolute right-1 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            />
          }
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={togglePin}>
            {conversation.pinned ? (
              <>
                <PinOff className="h-3.5 w-3.5" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="h-3.5 w-3.5" />
                Pin
              </>
            )}
          </DropdownMenuItem>
          {onRename ? (
            <DropdownMenuItem onSelect={() => onRename(conversation)}>
              Rename
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={toggleArchive}>
            <Archive className="h-3.5 w-3.5" />
            {conversation.archived ? "Unarchive" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={remove} variant="destructive">
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
