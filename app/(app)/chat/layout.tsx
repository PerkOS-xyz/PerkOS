"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useAppAccount } from "../../lib/useAppAccount";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { ConversationSidebar } from "../../components/ConversationSidebar";
import { NewConversationDialog } from "../../components/NewConversationDialog";

/**
 * Two-pane chat layout:
 *
 *   ┌────────────────┬────────────────────────────────┐
 *   │ Sidebar        │ Active conversation            │
 *   │ (Pinned /      │ (or empty state if `/chat`)    │
 *   │  Recent /      │                                │
 *   │  Archived)     │                                │
 *   └────────────────┴────────────────────────────────┘
 *
 * On mobile (< md) the sidebar becomes a left-side sheet triggered from the
 * top-bar hamburger.
 *
 * The sidebar lives at the layout level so it persists across child route
 * navigations — no flash, no refetch when opening a conversation.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const { address } = useAppAccount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const onNew = () => {
    setNewOpen(true);
    setMobileOpen(false); // close the mobile sheet behind the dialog
  };

  return (
    <>
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:shrink-0 md:flex-col">
        <ConversationSidebar walletAddress={address} onNew={onNew} />
      </div>

      {/* Mobile sheet */}
      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Open conversations"
                className="fixed left-2 top-[4.5rem] z-20 h-8 w-8 p-0"
              />
            }
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 p-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Conversations</SheetTitle>
            </SheetHeader>
            <ConversationSidebar
              walletAddress={address}
              onNew={onNew}
              className="h-full border-0"
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Outlet */}
      <main
        className={cn(
          "flex h-full min-w-0 flex-1 flex-col overflow-hidden",
        )}
      >
        {children}
      </main>

      <NewConversationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        walletAddress={address}
      />
    </div>
    </>
  );
}
