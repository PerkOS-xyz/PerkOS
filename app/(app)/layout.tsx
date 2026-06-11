"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useConnection, useDisconnect } from "wagmi";
import { Menu, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { ChatbotProvider } from "../components/ChatbotProvider";
import { ChatbotTrigger } from "../components/ChatbotTrigger";
import { ChatbotPanel } from "../components/ChatbotPanel";
import { CommandMenu } from "../components/CommandMenu";
import { MobileBottomNav } from "../components/MobileBottomNav";
import { AccessGate } from "../components/AccessGate";
import { NotificationsBell } from "../components/NotificationsBell";
import { NetworkPill } from "../components/NetworkPill";
import { UserMenu } from "../components/UserMenu";
import { RefreshButton } from "../components/RefreshButton";
import { PullToRefresh } from "../components/PullToRefresh";
import { OrgSwitcher, ProjectPicker } from "../components/OrgSwitcher";
import { ActiveOrgProvider } from "../lib/useActiveOrg";
import { formatAddress } from "../lib/format";
import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { useWalletSession } from "../lib/useWalletSession";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/agents", label: "Agents" },
  { href: "/chat", label: "Chat" },
  { href: "/organizations", label: "Organization" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { address, connector } = useConnection();
  const { disconnect } = useDisconnect();
  const session = useWalletSession();
  // Inside a Mini App host (Base App / Farcaster) the wallet IS the host's
  // identity — there is no meaningful "log out", so the button is hidden.
  // In a regular browser, logging out returns to the public landing page.
  const inMiniApp = useIsInMiniApp();
  // Base App's in-app BROWSER is not a Mini App host (sdk.isInMiniApp() is
  // false there) — it connects through the injected Coinbase provider
  // (rdns com.coinbase.wallet, see AutoConnect). The wallet is still the
  // host app's identity, so it gets no logout either. Note: the baseAccount
  // connector alone is NOT a signal — it's also "Sign in with email" in a
  // regular browser, where logout must exist.
  const isBaseAppBrowser =
    !!connector &&
    (connector.id === "com.coinbase.wallet" ||
      (connector as { rdns?: string }).rdns === "com.coinbase.wallet");
  const hideLogout = inMiniApp === true || isBaseAppBrowser;
  // Intentional logout goes to the LANDING page; the signed-out effect below
  // otherwise bounces to /sign-in (its job for unexpected session loss).
  const loggingOut = useRef(false);
  const logout = () => {
    loggingOut.current = true;
    disconnect();
    router.push("/");
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (session.status === "signed-out" && !loggingOut.current)
      router.replace("/sign-in");
  }, [session.status, router]);

  // Close the mobile drawer when the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Alpha gate: wagmi connected but Firebase rejected (wallet not allowlisted).
  if (session.status === "not-allowlisted" && address) {
    return <AccessGate address={address} />;
  }

  // While we're loading state or running the Firebase sign-in, render a quiet
  // splash so the app doesn't flash through guarded routes.
  if (
    session.status === "loading" ||
    session.status === "syncing" ||
    session.status === "error"
  ) {
    return <SessionSplash status={session.status} error={session.error} />;
  }

  return (
    <ChatbotProvider>
      <ActiveOrgProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-primary focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow-lg"
        >
          Skip to main content
        </a>

        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border bg-card p-6 md:flex">
          <Brand />
          <NavList pathname={pathname} />
          <WalletFooter address={address} onDisconnect={hideLogout ? null : logout} />
        </aside>

        <main className="flex-1 overflow-x-hidden">
          {/* Desktop topbar */}
          <header className="hidden items-center justify-between gap-2 border-b border-border px-8 py-3 md:flex">
            <div className="flex min-w-0 items-center gap-1">
              <OrgSwitcher />
              <span className="text-muted-foreground/50">/</span>
              <ProjectPicker />
            </div>
            <div className="flex items-center gap-2">
              <CommandHint />
              <RefreshButton />
              <NetworkPill />
              <NotificationsBell />
              <UserMenu />
            </div>
          </header>

          {/* Mobile header */}
          <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 md:hidden">
            <Image
              src="/perkos-header.png"
              alt="PerkOS"
              width={150}
              height={52}
            />

            <div className="flex items-center gap-1">
              <NetworkPill />
              <RefreshButton />

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open menu"
                      className="h-9 w-9 text-foreground hover:bg-primary/10"
                    />
                  }
                >
                  <Menu className="h-5 w-5" />
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="flex w-72 flex-col gap-6 border-l border-border bg-card p-6"
                >
                  <SheetHeader className="p-0 text-left">
                    <SheetTitle className="flex items-center gap-3 text-base px-4">
                      <Image
                        src="/perkos-header.png"
                        alt="PerkOS"
                        width={120}
                        height={32}
                      />
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      Main navigation
                    </SheetDescription>
                  </SheetHeader>

                  <NavList pathname={pathname} />

                  <Separator className="bg-border" />

                  <WalletFooter
                    address={address}
                    onDisconnect={hideLogout ? null : logout}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </header>

          {/* Mobile org + project bar */}
          <div className="flex min-w-0 items-center gap-1 overflow-hidden border-b border-border px-3 py-2 md:hidden">
            <div className="min-w-0 flex-1">
              <OrgSwitcher />
            </div>
            <span className="shrink-0 text-muted-foreground/50">/</span>
            <div className="min-w-0 flex-1">
              <ProjectPicker />
            </div>
          </div>

          <div id="main-content" className="p-5 pb-44 md:p-8 md:pb-8">
            <PullToRefresh>{children}</PullToRefresh>
          </div>
        </main>
        <MobileBottomNav />
        <ChatbotTrigger />
        <ChatbotPanel />
        <CommandMenu />
      </div>
      </ActiveOrgProvider>
    </ChatbotProvider>
  );
}

function SessionSplash({
  status,
  error,
}: {
  status: "loading" | "syncing" | "error";
  error?: string;
}) {
  const label =
    status === "syncing"
      ? "Signing you in…"
      : status === "error"
      ? "Sign-in failed"
      : "Loading session…";

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5"
      style={{
        backgroundColor: "#0e0716",
        backgroundImage:
          "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/perkos-header.png"
          alt="PerkOS"
          width={140}
          height={32}
          priority
        />
        <p className="text-sm text-muted-foreground">{label}</p>
        {error ? (
          <p className="max-w-sm text-xs text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4">
      <Image src="/perkos-header.png" alt="Perkos" width={160} height={32} />
    </div>
  );
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function WalletFooter({
  address,
  onDisconnect,
}: {
  address?: string;
  /** null → no logout affordance (Mini App hosts own the identity). */
  onDisconnect: (() => void) | null;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      {address ? (
        <p
          className="truncate font-mono text-xs text-muted-foreground"
          title={address}
        >
          {formatAddress(address)}
        </p>
      ) : null}
      {onDisconnect ? (
        <Button
          variant="outline"
          onClick={onDisconnect}
          className="justify-start gap-2"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      ) : null}
    </div>
  );
}

function CommandHint() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window === "undefined") return;
        const isMac = /mac/i.test(navigator.userAgent);
        const ev = new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: !isMac,
          metaKey: isMac,
          bubbles: true,
        });
        window.dispatchEvent(ev);
      }}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      <span>Search projects, agents, commands…</span>
      <span className="flex items-center gap-0.5">
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘</kbd>
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">K</kbd>
      </span>
    </button>
  );
}
