"use client";

/**
 * Header pill that shows the connected wallet's USDC balance on the
 * currently selected EVM chain, with a switcher for picking between
 * Base mainnet and Celo mainnet.
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
 * USX spec source: ui-ux-designer agent, 2026-05-25. See PR description
 * for the full pattern, state, and accessibility breakdown.
 */

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAccount, useChainId, useReadContract, useSwitchChain } from "wagmi";
import { erc20Abi } from "viem";
import { base, celo } from "wagmi/chains";
import { sdk } from "@farcaster/miniapp-sdk";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import {
  USDC_BY_CHAIN,
  isSupportedChainId,
  type SupportedChainId,
} from "../lib/usdcTokens";

const BASE_APP_CLIENT_FID = 309857;

type NetworkOption = {
  id: SupportedChainId;
  name: string;
  logo: string;
};

const NETWORKS: NetworkOption[] = [
  { id: base.id, name: "Base", logo: "/logos/base-mark.svg" },
  { id: celo.id, name: "Celo", logo: "/logos/celo-mark.svg" },
];

/**
 * Format a USDC balance for display:
 *   - $0.00 when zero
 *   - $X,XXX (no decimals, comma grouping) when ≥ 100
 *   - $X.XX (two decimals) when < 100
 *
 * The input is a bigint of base units (USDC has 6 decimals).
 */
function formatUsdc(raw: bigint, decimals: number): string {
  if (raw === BigInt(0)) return "$0.00";

  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  const wholeNum = Number(whole);

  if (wholeNum >= 100) {
    return `$${wholeNum.toLocaleString("en-US")}`;
  }

  // Two-decimal precision for values < 100.
  const fractionScaled = Number(fraction) / Number(divisor); // 0..1
  const total = wholeNum + fractionScaled;
  return `$${total.toFixed(2)}`;
}

export function NetworkPill() {
  const { address, isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [isInBaseApp, setIsInBaseApp] = useState<boolean>(false);

  // Detect Base App miniapp host once on mount. We don't reuse
  // useIsInMiniApp() because we need clientFid specificity (a
  // Farcaster host should NOT collapse to the static pill).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (cancelled || !inMiniApp) return;
        const context = await sdk.context;
        if (cancelled) return;
        if (context?.client?.clientFid === BASE_APP_CLIENT_FID) {
          setIsInBaseApp(true);
        }
      } catch {
        // Not in a miniapp host — leave default (interactive pill).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const balance = useReadContract({
    address: usdc.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: displayedChainId,
    query: { enabled: isConnected && !!address },
  });

  const balanceLabel = (() => {
    if (!isConnected || !address) return "$0.00";
    if (balance.isError) return "—";
    if (balance.data !== undefined) {
      return formatUsdc(balance.data, usdc.decimals);
    }
    return null; // loading
  })();

  const isUnsupportedChain =
    !isInBaseApp &&
    isConnected &&
    activeChainId !== undefined &&
    !isSupportedChainId(activeChainId);

  async function handleSelect(target: NetworkOption) {
    if (target.id === activeChainId) return;
    try {
      await switchChainAsync({ chainId: target.id });
    } catch {
      toast("Network switch cancelled");
    }
  }

  // -----------------------------------------------------------------
  // Base App context — static pill (non-interactive).
  // -----------------------------------------------------------------

  if (isInBaseApp) {
    return (
      <PillShell
        aria-label={
          balanceLabel
            ? `${balanceLabel} USDC on ${displayedNetwork.name}`
            : `Loading USDC balance on ${displayedNetwork.name}`
        }
        static
      >
        <LogoMark network={displayedNetwork} />
        <BalanceLabel value={balanceLabel} />
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
        aria-label={
          balanceLabel
            ? `Network and balance: ${balanceLabel} on ${displayedNetwork.name}`
            : `Loading balance on ${displayedNetwork.name}`
        }
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
          <span className="text-destructive">Wrong network</span>
        ) : (
          <BalanceLabel value={balanceLabel} />
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
              onSelect={() => handleSelect(network)}
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

function BalanceLabel({ value }: { value: string | null }) {
  if (value === null) {
    return (
      <span
        className="block h-2 w-10 animate-pulse rounded-full bg-muted"
        aria-label="Loading USDC balance"
        role="status"
      />
    );
  }
  return <span className="max-w-[72px] truncate md:max-w-none">{value}</span>;
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
