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
import { useUserProfile } from "../lib/useUserProfile";
import { effectiveAvatarUrl } from "../lib/perkosApi";
import { useAdvancedFeatures } from "../lib/advancedFeatures";
import { UserAvatar } from "./UserAvatar";
import { toast } from "sonner";
import { copyText } from "../lib/copyText";

export function UserMenu({ onLogout }: { onLogout?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  // Read the wallet from the session (Privy in a browser, wagmi in a Mini
  // App) so the menu renders on both paths. Logout goes through the layout's
  // handler (single path: it tears down wallet + Firebase and routes to the
  // landing page); fall back to session.logout() if no handler was provided.
  const session = useWalletSession();
  const address = session.address;
  const advancedFeatures = useAdvancedFeatures(address);
  const { data: profile } = useUserProfile(address);
  const avatarUrl = effectiveAvatarUrl(profile);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  if (!address) return null;

  const accountLabel =
    profile?.username || session.identityLabel || t("chrome.userMenu.account");

  async function copy() {
    // Same reason as settings: an empty catch made a blocked clipboard look
    // like a dead button. See lib/copyText.
    if (await copyText(address ?? "")) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error(t("settings.account.copyFailed"));
    }
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
        <UserAvatar
          address={address}
          avatarUrl={avatarUrl}
          size={28}
          title={advancedFeatures.enabled ? address : accountLabel}
        />
        <span className="hidden max-w-36 truncate text-xs text-foreground md:inline">
          {advancedFeatures.enabled ? formatAddress(address) : accountLabel}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 border-border bg-card p-2"
      >
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <UserAvatar
            address={address}
            avatarUrl={avatarUrl}
            size={36}
            title={advancedFeatures.enabled ? address : accountLabel}
          />
          <div className="flex min-w-0 flex-col">
            <span
              className="truncate text-xs text-foreground"
              title={advancedFeatures.enabled ? address : accountLabel}
            >
              {advancedFeatures.enabled ? formatAddress(address) : accountLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {advancedFeatures.enabled
                ? t("chrome.userMenu.ownerWallet")
                : t("chrome.userMenu.secureAccount")}
            </span>
          </div>
        </div>

        <Separator className="my-1 bg-border" />

        {advancedFeatures.enabled ? (
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
        ) : null}

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
