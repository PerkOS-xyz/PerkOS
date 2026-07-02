"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Copy,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { formatAddress } from "../lib/format";
import { useWalletSession } from "../lib/useWalletSession";

export function UserMenu({ onLogout }: { onLogout?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  // Read the wallet from the session (Dynamic in a browser, wagmi in a Mini
  // App) so the menu renders on both paths. Logout goes through the layout's
  // handler (single path: it tears down wallet + Firebase and routes to the
  // landing page); fall back to session.logout() if no handler was provided.
  const session = useWalletSession();
  const address = session.address;
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  if (!address) return null;

  function copy() {
    navigator.clipboard
      .writeText(address ?? "")
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  async function handleDisconnect() {
    setOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    await session.logout();
    router.replace("/");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("chrome.userMenu.accountMenu")}
            className="gap-2 px-2 hover:bg-muted/40"
          />
        }
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
          {address.slice(2, 4).toUpperCase()}
        </span>
        <span className="hidden font-mono text-xs text-foreground md:inline">
          {formatAddress(address)}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 border-border bg-card p-2"
      >
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-medium text-primary">
            {address.slice(2, 4).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-xs text-foreground" title={address}>
              {formatAddress(address)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t("chrome.userMenu.ownerWallet")}
            </span>
          </div>
        </div>

        <Separator className="my-1 bg-border" />

        <button
          type="button"
          onClick={copy}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted/40"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
              {t("chrome.userMenu.copied")}
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              {t("chrome.userMenu.copyFullAddress")}
            </>
          )}
        </button>

        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted/40"
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          {t("nav.settings")}
        </Link>

        <Separator className="my-1 bg-border" />

        <button
          type="button"
          onClick={handleDisconnect}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t("chrome.userMenu.disconnect")}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export function UserMenuFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Wallet className="h-3.5 w-3.5" />
      {t("chrome.userMenu.notConnected")}
    </div>
  );
}
