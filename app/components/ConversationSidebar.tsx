"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronRight, Pin, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ConversationListItem } from "./ConversationListItem";
import { type Conversation } from "../lib/conversationsApi";
import { useConversations } from "../lib/useConversations";

type Props = {
  walletAddress: string | null | undefined;
  /**
   * Called when the "New conversation" button is clicked. The picker UI
   * (#16) will mount in response. Left undefined while the picker is being
   * built so the button no-ops gracefully.
   */
  onNew?: () => void;
  /** Optional class to override container styling (e.g. mobile sheet). */
  className?: string;
};

/**
 * Left-rail conversation list. ChatGPT-style: pinned at top, recent below,
 * archived collapsed at the bottom. Realtime — subscribes to Firestore.
 *
 * The active conversation is read from the dynamic `[convId]` URL param if
 * present.
 */
export function ConversationSidebar({ walletAddress, onNew, className }: Props) {
  const params = useParams<{ convId?: string }>();
  const activeId = params?.convId ?? null;

  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  // Active set (un-archived).
  const active = useConversations(walletAddress, { archived: false });
  // Archived set (lazy — fetch only when expanded).
  const archived = useConversations(showArchived ? walletAddress : null, { archived: true });

  const { pinned, recent } = useMemo(() => {
    const list = active.conversations.filter((c) => matchesSearch(c, search));
    list.sort((a, b) => {
      const ka = a.lastMessageAt ?? a.updatedAt ?? a.createdAt ?? "";
      const kb = b.lastMessageAt ?? b.updatedAt ?? b.createdAt ?? "";
      return kb.localeCompare(ka);
    });
    return {
      pinned: list.filter((c) => c.pinned),
      recent: list.filter((c) => !c.pinned),
    };
  }, [active.conversations, search]);

  const archivedFiltered = useMemo(
    () => archived.conversations.filter((c) => matchesSearch(c, search)),
    [archived.conversations, search],
  );

  return (
    <aside
      className={cn(
        "flex h-full flex-col gap-3 border-r border-border bg-card/40",
        className,
      )}
      aria-label="Conversations"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 px-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground">Chats</h2>
          <Button
            type="button"
            size="sm"
            onClick={onNew}
            disabled={!walletAddress || !onNew}
            className="h-7 gap-1 px-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-7 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {!walletAddress ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Sign in to see your conversations.
          </p>
        ) : active.loading ? (
          <SkeletonRows />
        ) : active.error ? (
          <p className="px-2 py-4 text-xs text-destructive">
            Couldn&apos;t load conversations: {active.error.message}
          </p>
        ) : pinned.length === 0 && recent.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No conversations yet. Click <b>New</b> to start one.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {pinned.length > 0 ? (
              <Section label="Pinned" Icon={Pin}>
                <ul className="flex flex-col gap-0.5">
                  {pinned.map((c) => (
                    <ConversationListItem
                      key={c.id}
                      conversation={c}
                      walletAddress={walletAddress}
                      active={activeId === c.id}
                    />
                  ))}
                </ul>
              </Section>
            ) : null}

            {recent.length > 0 ? (
              <Section label={pinned.length > 0 ? "Recent" : undefined}>
                <ul className="flex flex-col gap-0.5">
                  {recent.map((c) => (
                    <ConversationListItem
                      key={c.id}
                      conversation={c}
                      walletAddress={walletAddress}
                      active={activeId === c.id}
                    />
                  ))}
                </ul>
              </Section>
            ) : null}
          </div>
        )}

        {/* Archived (collapsible) */}
        {walletAddress ? (
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowArchived((s) => !s)}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
              aria-expanded={showArchived}
            >
              {showArchived ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Archive className="h-3 w-3" />
              Archived
              {archivedFiltered.length > 0 ? (
                <span className="ml-auto text-muted-foreground/70">
                  {archivedFiltered.length}
                </span>
              ) : null}
            </button>
            {showArchived ? (
              archived.loading ? (
                <div className="px-2 py-2">
                  <SkeletonRows count={2} />
                </div>
              ) : archivedFiltered.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  No archived conversations.
                </p>
              ) : (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {archivedFiltered.map((c) => (
                    <ConversationListItem
                      key={c.id}
                      conversation={c}
                      walletAddress={walletAddress}
                      active={activeId === c.id}
                    />
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Section({
  label,
  Icon,
  children,
}: {
  label?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      {label ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {Icon ? <Icon className="h-3 w-3" /> : null}
          {label}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-1 px-1">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="h-7 animate-pulse rounded-md border border-border bg-card"
        />
      ))}
    </ul>
  );
}

function matchesSearch(c: Conversation, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.toLowerCase();
  if (c.title?.toLowerCase().includes(needle)) return true;
  for (const p of c.participants) {
    if (p.toLowerCase().includes(needle)) return true;
  }
  return false;
}
