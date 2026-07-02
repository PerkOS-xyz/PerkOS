"use client";

/**
 * Header pill that shows the connected wallet's USDC + PERKOS
 * balances on the currently selected EVM chain, with a switcher for
 * picking between Base mainnet and Celo mainnet.
 *
 * Pill body shape (left → right):
 *   [chain logo]  $usdc USDC  ·  perkos $PERKOS  [chevron|spinner]
 *
 * Large PERKOS balances render in compact notation (30.2M) rather
 * than the exact token count — see formatBalance.
 *
 * Three contexts, controlled by the Mini App host:
 *
 *   1. Inside Base App miniapp host (clientFid 309857)
 *      → Static pill. Base only, no switcher.
 *
 *   2. Inside Farcaster (Warpcast / Farcaster app)
 *      → Interactive dropdown with Base + Celo.
 *
 *   3. Plain web browser
 *      → Same as Farcaster.
 *
 * UX spec source: ui-ux-designer agent, 2026-05-25. The PERKOS slot
 * was added afterwards (the original spec was USDC-only); both
 * balances share the same loading + error treatment.
 */

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnectors,
  useReadContract,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { erc20Abi } from "viem";
import { base, celo } from "wagmi/chains";
import { sdk } from "@farcaster/miniapp-sdk";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import {
  PERKOS_BY_CHAIN,
  USDC_BY_CHAIN,
  isSupportedChainId,
  type SupportedChainId,
} from "../lib/tokenAddresses";

const BASE_APP_CLIENT_FID = 309857;
const COINBASE_WALLET_RDNS = "com.coinbase.wallet";

function rdnsOf(connector: Connector): string | undefined {
  const c = connector as Connector & {
    rdns?: string;
    info?: { rdns?: string };
  };
  return c.rdns ?? c.info?.rdns;
}

/**
 * Heuristic for "we are in a Coinbase-flavoured context where the
 * wallet is pinned to Base mainnet" — i.e. Base App miniapp host OR
 * Base App's in-app browser OR Coinbase Wallet's in-app browser.
 *
 * Signals (any → treat as Base-only):
 *   - sdk.context.client.clientFid === 309857 (miniapp host) → exact
 *   - userAgent contains "CoinbaseBrowser" or "CoinbaseWallet" → exact
 *   - we're on mobile AND the ONLY EIP-6963 provider announced is
 *     com.coinbase.wallet — strong signal of a Coinbase-issued
 *     webview that injected just its own wallet. Desktop users with
 *     Coinbase Wallet extension typically have other extensions too
 *     (MetaMask, Phantom, …) so they won't trip this.
 */
function detectBaseContext(opts: {
  inMiniApp: boolean;
  miniappClientFid: number | undefined;
  userAgent: string;
  connectors: readonly Connector[];
}): boolean {
  if (opts.miniappClientFid === BASE_APP_CLIENT_FID) return true;

  const uaSignals = /CoinbaseBrowser|CoinbaseWallet/i;
  if (uaSignals.test(opts.userAgent)) return true;

  if (opts.inMiniApp) return false; // miniapp but not Base App → Farcaster

  // EIP-6963 discovered providers only — exclude wagmi's static
  // connectors (farcasterMiniApp, baseAccount, injected) which are
  // always present regardless of host.
  const discovered = opts.connectors.filter((c) => rdnsOf(c) !== undefined);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(opts.userAgent);
  if (
    isMobile &&
    discovered.length > 0 &&
    discovered.every((c) => rdnsOf(c) === COINBASE_WALLET_RDNS)
  ) {
    return true;
  }

  return false;
}

type NetworkOption = {
  id: SupportedChainId;
  name: string;
  logo: string;
};

const NETWORKS: NetworkOption[] = [
  { id: base.id, name: "Base", logo: "/base.png" },
  { id: celo.id, name: "Celo", logo: "/celo.png" },
];

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Format an ERC20 balance as a compact display string:
 *   - "0.00" when zero
 *   - "X.XM" / "X.XK" / "X.XB" (compact notation) when whole part ≥ 1,000
 *     — large governance-token balances (PERKOS) would otherwise be an
 *     unreadable run of digits; 30,225,719 → "30.2M"
 *   - "X,XXX" (comma-grouped, no decimals) when 100 ≤ whole part < 1,000
 *   - "X.XX" (two decimals) when whole part < 100
 *
 * Callers compose the prefix ($ for USDC) and suffix (symbol for
 * other tokens) around the result.
 */
function formatBalance(raw: bigint, decimals: number): string {
  if (raw === BigInt(0)) return "0.00";

  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const wholeNum = Number(whole);

  if (wholeNum >= 1000) {
    return compactFormatter.format(wholeNum);
  }

  if (wholeNum >= 100) {
    return wholeNum.toLocaleString("en-US");
  }

  const fractionScaled = Number(fraction) / Number(divisor); // 0..1
  return (wholeNum + fractionScaled).toFixed(2);
}

export function NetworkPill() {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const connectors = useConnectors();
  const [isInBaseApp, setIsInBaseApp] = useState<boolean>(false);

  // Decide whether we're in a "Base-only" context (miniapp host,
  // in-app browser, or Coinbase Wallet webview). When true the pill
  // collapses to a static Base-only display — the wallet is pinned
  // to Base and offering Celo would just fail on switch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userAgent =
        typeof navigator !== "undefined" ? navigator.userAgent : "";

      let inMiniApp = false;
      let clientFid: number | undefined;

      try {
        inMiniApp = await sdk.isInMiniApp();
        if (cancelled) return;
        if (inMiniApp) {
          const context = await sdk.context;
          if (cancelled) return;
          clientFid = context?.client?.clientFid;
        }
      } catch {
        // SDK unreachable — fall through with the empty defaults.
      }

      const isBaseContext = detectBaseContext({
        inMiniApp,
        miniappClientFid: clientFid,
        userAgent,
        connectors,
      });
      if (!cancelled) setIsInBaseApp(isBaseContext);
    })();
    return () => {
      cancelled = true;
    };
  }, [connectors]);

  // The chain whose balance + logo we display. We honour wagmi's
  // active chain when it's one we support; otherwise pin to Base.
  // Base App context is always Base regardless of wagmi state.
  const displayedChainId: SupportedChainId = isInBaseApp
    ? base.id
    : isSupportedChainId(activeChainId)
      ? activeChainId
      : base.id;

  const displayedNetwork = NETWORKS.find((n) => n.id === displayedChainId)!;
  const usdc = USDC_BY_CHAIN[displayedChainId];
  const perkos = PERKOS_BY_CHAIN[displayedChainId];

  const usdcQuery = useReadContract({
    address: usdc.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: displayedChainId,
    query: { enabled: isConnected && !!address },
  });

  const perkosQuery = useReadContract({
    address: perkos.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: displayedChainId,
    query: { enabled: isConnected && !!address },
  });

  const usdcLabel = formatQueryResult(usdcQuery, usdc.decimals, isConnected);
  const perkosLabel = formatQueryResult(
    perkosQuery,
    perkos.decimals,
    isConnected,
  );

  const isUnsupportedChain =
    !isInBaseApp &&
    isConnected &&
    activeChainId !== undefined &&
    !isSupportedChainId(activeChainId);

  async function handleSelect(target: NetworkOption) {
    if (target.id === activeChainId) return;
    try {
      await switchChainAsync({ chainId: target.id });
      toast.success(t("chrome.network.switchedTo", { network: target.name }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("chrome.network.unknownError");
      // Some smart wallets (Coinbase Smart Wallet in particular) reject
      // wallet_switchEthereumChain entirely because they're pinned to
      // a single chain. Surface the wallet's message so the user can
      // see what's going on rather than a generic "cancelled".
      toast.error(t("chrome.network.switchFailed", { network: target.name }), {
        description: message,
      });
    }
  }

  const ariaLabel = (() => {
    const u =
      usdcLabel === null
        ? t("chrome.network.loadingToken", { token: "USDC" })
        : usdcLabel === "—"
          ? t("chrome.network.tokenUnavailable", { token: "USDC" })
          : t("chrome.network.usdcBalance", { amount: usdcLabel });
    const p =
      perkosLabel === null
        ? t("chrome.network.loadingToken", { token: "PERKOS" })
        : perkosLabel === "—"
          ? t("chrome.network.tokenUnavailable", { token: "PERKOS" })
          : t("chrome.network.perkosBalance", { amount: perkosLabel });
    return t("chrome.network.balancesSummary", {
      usdc: u,
      perkos: p,
      network: displayedNetwork.name,
    });
  })();

  // -----------------------------------------------------------------
  // Base App context — static pill (non-interactive).
  // -----------------------------------------------------------------

  if (isInBaseApp) {
    return (
      <PillShell static aria-label={ariaLabel}>
        <LogoMark network={displayedNetwork} />
        <BalancesBody usdcLabel={usdcLabel} perkosLabel={perkosLabel} />
      </PillShell>
    );
  }

  // -----------------------------------------------------------------
  // Farcaster / web — dropdown.
  // -----------------------------------------------------------------

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-haspopup="listbox"
        aria-label={t("chrome.network.triggerAria", { summary: ariaLabel })}
        aria-disabled={isSwitching || undefined}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition-colors",
          "h-11 md:h-8", // 44px tap target on mobile, 32px on desktop
          "border-border text-muted-foreground",
          "hover:border-primary/40 hover:text-foreground",
          "data-[popup-open]:border-primary/40 data-[popup-open]:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          isSwitching && "pointer-events-none opacity-80",
          isUnsupportedChain && "border-destructive/60",
        )}
      >
        <LogoMark network={displayedNetwork} />
        {isUnsupportedChain ? (
          <span className="text-destructive">
            {t("chrome.network.wrongNetwork")}
          </span>
        ) : (
          <BalancesBody usdcLabel={usdcLabel} perkosLabel={perkosLabel} />
        )}
        {isSwitching ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform motion-safe:duration-150 group-data-[popup-open]:rotate-180" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-44 rounded-xl border-border bg-card p-1 shadow-lg"
      >
        {NETWORKS.map((network) => {
          const selected = network.id === displayedChainId;
          return (
            <DropdownMenuItem
              key={network.id}
              onClick={() => handleSelect(network)}
              aria-selected={selected}
              className={cn(
                "flex h-10 items-center gap-2 rounded-md px-3 text-sm",
                selected
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted/40",
              )}
            >
              <LogoMark network={network} />
              <span className="flex-1">{network.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------

/**
 * Maps a wagmi useReadContract query result to either:
 *   - "—" on error
 *   - null while loading
 *   - a formatted balance string ("0.00" / "12.50" / "2,450")
 *
 * Disconnected wallet collapses to "0.00" so the pill always has
 * meaningful content even before the user signs in.
 */
function formatQueryResult(
  query: { data: unknown; isError: boolean },
  decimals: number,
  isConnected: boolean,
): string | null {
  if (!isConnected) return "0.00";
  if (query.isError) return "—";
  if (query.data === undefined || query.data === null) return null;
  return formatBalance(query.data as bigint, decimals);
}

function LogoMark({ network }: { network: NetworkOption }) {
  return (
    <Image
      src={network.logo}
      alt=""
      width={16}
      height={16}
      aria-hidden
      className="shrink-0"
    />
  );
}

/**
 * The "$usdc USDC · perkos $PERKOS" body. Each side handles its own
 * loading / error state independently so a flaky RPC on one token
 * doesn't blank the other.
 */
function BalancesBody({
  usdcLabel,
  perkosLabel,
}: {
  usdcLabel: string | null;
  perkosLabel: string | null;
}) {
  return (
    <span className="flex items-center gap-1.5 truncate">
      <TokenSlot label={usdcLabel} prefix="$" suffix="USDC" loadingHint="USDC" />
      {/* Tablet portrait (md→lg) runs the pill compact — USDC only — so the
          topbar fits on one row. $PERKOS returns on desktop and stays on
          mobile (its own header has room). */}
      <span className="flex items-center gap-1.5 md:max-lg:hidden">
        <span className="text-muted-foreground/60" aria-hidden>
          ·
        </span>
        <TokenSlot label={perkosLabel} suffix="$PERKOS" loadingHint="PERKOS" />
      </span>
    </span>
  );
}

function TokenSlot({
  label,
  prefix,
  suffix,
  loadingHint,
}: {
  label: string | null;
  prefix?: string;
  suffix?: string;
  loadingHint: string;
}) {
  const { t } = useTranslation();
  if (label === null) {
    return (
      <span
        className="block h-2 w-8 animate-pulse rounded-full bg-muted"
        aria-label={t("chrome.network.loadingBalance", { token: loadingHint })}
        role="status"
      />
    );
  }
  return (
    <span className="whitespace-nowrap">
      {prefix}
      {label}
      {suffix ? <span className="ml-1 text-muted-foreground/80">{suffix}</span> : null}
    </span>
  );
}

function PillShell({
  children,
  static: isStatic,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { static?: boolean }) {
  return (
    <div
      role={isStatic ? "status" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground",
        "h-11 md:h-8",
        isStatic && "cursor-default",
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
