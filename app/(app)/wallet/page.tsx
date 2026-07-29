"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";
import { Wallet, Copy, Check, RefreshCw, ArrowDownToLine, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

const compactBalance = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function displayBalance(value: string, symbol: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  if (amount === 0) return "0.00";
  if (symbol === "PERKOS" && Math.abs(amount) >= 1_000) {
    return compactBalance.format(amount);
  }
  return amount.toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(amount) < 0.01 ? 6 : 2,
  });
}

export default function WalletPage() {
  const { t } = useTranslation();
  const { address: connectedAddress, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);
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

          {/* Balances */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {t("wallet.balances.title")}
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
                  {balanceChains.map((c) => (
                    <div key={c.chain} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {chainLabel(c.chain)}
                        </Badge>
                        <Separator className="flex-1" />
                      </div>
                      {c.available === false ? (
                        <p className="px-1 py-1 text-xs text-destructive">
                          {t("wallet.balances.unavailable")}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {c.balances.map((b) => (
                            <li
                              key={`${c.chain}-${b.symbol}`}
                              className="flex items-center justify-between rounded-md px-1 py-1 text-sm"
                            >
                              <span className="text-muted-foreground">
                                {b.symbol === "PERKOS" ? "$PERKOS" : b.symbol}
                              </span>
                              <span
                                className="font-mono text-foreground"
                                title={b.formatted}
                              >
                                {displayBalance(b.formatted, b.symbol)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
