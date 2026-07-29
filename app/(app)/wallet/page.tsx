"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import {
  Wallet,
  Copy,
  Check,
  RefreshCw,
  ArrowDownToLine,
  Sparkles,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ensureServerWallet,
  fetchWalletBalances,
  chainLabel,
  type WalletSource,
} from "@/app/lib/serverWallet";
import { SendForm } from "./SendForm";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function displayBalance(value: string, symbol: string, locale = "en"): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  if (amount === 0) return "0.00";
  if (symbol === "PERKOS" && Math.abs(amount) >= 1_000) {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return amount.toLocaleString(locale, {
    maximumFractionDigits: Math.abs(amount) < 1 ? 6 : 2,
  });
}

type AssetEntry = {
  chain: string;
  chainId: number;
  formatted: string;
};

type AssetGroup = {
  symbol: string;
  total: number;
  entries: AssetEntry[];
};

const ASSET_ORDER = ["PERKOS", "ETH", "USDC", "USDG", "CELO"];

function assetSort(a: AssetGroup, b: AssetGroup): number {
  const aIndex = ASSET_ORDER.indexOf(a.symbol);
  const bIndex = ASSET_ORDER.indexOf(b.symbol);
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? ASSET_ORDER.length : aIndex) -
      (bIndex === -1 ? ASSET_ORDER.length : bIndex);
  }
  return a.symbol.localeCompare(b.symbol);
}

function assetInitial(symbol: string): string {
  if (symbol === "ETH") return "◆";
  if (symbol === "USDC" || symbol === "USDG") return "$";
  return symbol.slice(0, 1);
}

export default function WalletPage() {
  const { t, i18n } = useTranslation();
  const { address: connectedAddress, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(
    () => new Set(),
  );
  const [walletSource, setWalletSource] =
    useState<WalletSource>("connected");

  const walletQuery = useQuery({
    queryKey: ["server-wallet"],
    queryFn: ensureServerWallet,
    enabled: walletSource === "managed",
    staleTime: 5 * 60_000,
  });
  const wallet = walletQuery.data ?? null;
  const selectedAddress =
    walletSource === "connected"
      ? connectedAddress ?? null
      : wallet?.address ?? null;

  const balancesQuery = useQuery({
    queryKey: ["wallet-balances", walletSource, selectedAddress],
    queryFn: () => fetchWalletBalances(walletSource),
    enabled: Boolean(selectedAddress),
    staleTime: 30_000,
  });
  const balanceChains = balancesQuery.data?.chains ?? [];
  const readableBalances = balanceChains
    .filter((chain) => chain.available !== false)
    .flatMap((chain) => chain.balances);
  const assetGroups = useMemo(() => {
    const groups = new Map<string, AssetGroup>();
    for (const chain of balanceChains) {
      if (chain.available === false) continue;
      for (const balance of chain.balances) {
        const current = groups.get(balance.symbol) ?? {
          symbol: balance.symbol,
          total: 0,
          entries: [],
        };
        current.total += Number(balance.formatted) || 0;
        current.entries.push({
          chain: chain.chain,
          chainId: chain.chainId,
          formatted: balance.formatted,
        });
        groups.set(balance.symbol, current);
      }
    }
    return [...groups.values()].sort(assetSort);
  }, [balanceChains]);
  const unavailableChains = balanceChains.filter(
    (chain) => chain.available === false,
  );
  const hasNoFunds =
    readableBalances.length > 0 &&
    readableBalances.every((balance) => balance.raw === "0");

  const copy = async () => {
    if (!selectedAddress) return;
    try {
      await navigator.clipboard.writeText(selectedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-medium text-foreground">
          <Wallet className="h-7 w-7 text-primary" />
          {t("wallet.header.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("wallet.header.subtitle")}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t(`wallet.source.${walletSource}`)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`wallet.source.${walletSource}Description`)}
            </p>
          </div>
          <Select
            value={walletSource}
            onValueChange={(value) => setWalletSource(value as WalletSource)}
          >
            <SelectTrigger
              aria-label={t("wallet.source.label")}
              className="h-10 w-full sm:w-64"
            >
              <SelectValue>
                {t(`wallet.source.${walletSource}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="connected">
                {t("wallet.source.connected")}
              </SelectItem>
              <SelectItem value="managed">
                {t("wallet.source.managed")}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Loading */}
      {walletSource === "managed" && walletQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> {t("wallet.loading")}
          </CardContent>
        </Card>
      ) : walletSource === "managed" && walletQuery.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            {walletQuery.error instanceof Error
              ? walletQuery.error.message
              : t("wallet.error.load")}
          </CardContent>
        </Card>
      ) : walletSource === "connected" && (!isConnected || !selectedAddress) ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("wallet.error.connect")}
          </CardContent>
        </Card>
      ) : walletSource === "managed" && !wallet ? (
        /* Backend not enabled yet → friendly coming-soon */
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> {t("wallet.comingSoon.title")}
            </CardTitle>
            <CardDescription>
              {t("wallet.comingSoon.description")}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {/* Address + deposit */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {t("wallet.address.title")}
              </CardTitle>
              <CardDescription>
                {t(`wallet.address.${walletSource}Description`)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-2.5">
                <span
                  className="min-w-0 flex-1 break-all font-mono text-sm text-foreground"
                  title={selectedAddress ?? undefined}
                >
                  {selectedAddress}
                </span>
                <Button size="sm" variant="ghost" className="h-7 shrink-0 gap-1.5" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("wallet.address.copied") : t("wallet.address.copy")}
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDownToLine className="h-3.5 w-3.5" />
                {t(`wallet.address.${walletSource}Deposit`, {
                  addr: shortAddr(selectedAddress!),
                })}
              </p>
            </CardContent>
          </Card>

          {/* Send */}
          {walletSource === "managed" ? (
            <SendForm address={selectedAddress!} />
          ) : null}

          {/* Assets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {t("wallet.assets.title")}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5"
                disabled={balancesQuery.isFetching}
                onClick={() => balancesQuery.refetch()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${balancesQuery.isFetching ? "animate-spin" : ""}`} />
                {t("wallet.balances.refresh")}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 pt-0">
              {balancesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("wallet.balances.reading")}</p>
              ) : balancesQuery.isError ? (
                <p className="text-sm text-destructive">{t("wallet.balances.error")}</p>
              ) : (
                <>
                  {hasNoFunds ? (
                    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      {t("wallet.balances.empty")}
                    </p>
                  ) : null}
                  <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80">
                    {assetGroups.map((asset) => {
                      const expanded = expandedAssets.has(asset.symbol);
                      const assetLabel =
                        asset.symbol === "PERKOS" ? "$PERKOS" : asset.symbol;
                      return (
                        <li key={asset.symbol} className="bg-muted/10">
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                            aria-expanded={expanded}
                            aria-label={t(
                              expanded
                                ? "wallet.assets.hideDetails"
                                : "wallet.assets.showDetails",
                              { asset: assetLabel },
                            )}
                            onClick={() => {
                              setExpandedAssets((current) => {
                                const next = new Set(current);
                                if (next.has(asset.symbol)) {
                                  next.delete(asset.symbol);
                                } else {
                                  next.add(asset.symbol);
                                }
                                return next;
                              });
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
                            >
                              {assetInitial(asset.symbol)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-foreground">
                                {assetLabel}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1">
                                {asset.entries.map((entry) => (
                                  <Badge
                                    key={`${asset.symbol}-${entry.chain}`}
                                    variant="secondary"
                                    className="px-1.5 py-0 text-[9px] font-normal"
                                  >
                                    {chainLabel(entry.chain)}
                                  </Badge>
                                ))}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span
                                className="text-right font-mono text-sm font-medium text-foreground sm:text-base"
                                title={`${asset.total} ${assetLabel}`}
                              >
                                {displayBalance(
                                  String(asset.total),
                                  asset.symbol,
                                  i18n.resolvedLanguage || i18n.language,
                                )}
                              </span>
                              <ChevronDown
                                aria-hidden="true"
                                className={`h-4 w-4 text-muted-foreground transition-transform ${
                                  expanded ? "rotate-180" : ""
                                }`}
                              />
                            </span>
                          </button>

                          {expanded ? (
                            <ul className="border-t border-border/70 bg-background/35 px-3 py-2">
                              {asset.entries.map((entry) => (
                                <li
                                  key={`${asset.symbol}-${entry.chainId}`}
                                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm"
                                >
                                  <span className="text-muted-foreground">
                                    {chainLabel(entry.chain)}
                                  </span>
                                  <span
                                    className="font-mono text-foreground"
                                    title={entry.formatted}
                                  >
                                    {displayBalance(
                                      entry.formatted,
                                      asset.symbol,
                                      i18n.resolvedLanguage || i18n.language,
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {unavailableChains.map((chain) => (
                    <p
                      key={chain.chain}
                      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                    >
                      {t("wallet.assets.unavailable", {
                        network: chainLabel(chain.chain),
                      })}
                    </p>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
