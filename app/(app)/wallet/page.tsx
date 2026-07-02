"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  ensureServerWallet,
  fetchWalletBalances,
  chainLabel,
} from "@/app/lib/serverWallet";
import { SendForm } from "./SendForm";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function WalletPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const walletQuery = useQuery({
    queryKey: ["server-wallet"],
    queryFn: ensureServerWallet,
    staleTime: 5 * 60_000,
  });
  const wallet = walletQuery.data ?? null;

  const balancesQuery = useQuery({
    queryKey: ["wallet-balances", wallet?.address],
    queryFn: fetchWalletBalances,
    enabled: Boolean(wallet?.address),
    staleTime: 30_000,
  });

  const copy = async () => {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
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

      {/* Loading */}
      {walletQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> {t("wallet.loading")}
          </CardContent>
        </Card>
      ) : walletQuery.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            {walletQuery.error instanceof Error
              ? walletQuery.error.message
              : t("wallet.error.load")}
          </CardContent>
        </Card>
      ) : !wallet ? (
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
                {t("wallet.address.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2.5">
                <span
                  className="min-w-0 flex-1 truncate font-mono text-sm text-foreground"
                  title={wallet.address}
                >
                  {wallet.address}
                </span>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("wallet.address.copied") : t("wallet.address.copy")}
                </Button>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowDownToLine className="h-3.5 w-3.5" />
                {t("wallet.address.deposit", { addr: shortAddr(wallet.address) })}
              </p>
            </CardContent>
          </Card>

          {/* Send */}
          <SendForm address={wallet.address} />

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
                (balancesQuery.data?.chains ?? []).map((c) => (
                  <div key={c.chain} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {chainLabel(c.chain)}
                      </Badge>
                      <Separator className="flex-1" />
                    </div>
                    <ul className="flex flex-col gap-1">
                      {c.balances.map((b) => (
                        <li
                          key={`${c.chain}-${b.symbol}`}
                          className="flex items-center justify-between rounded-md px-1 py-1 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {b.symbol === "PERKOS" ? "$PERKOS" : b.symbol}
                          </span>
                          <span className="font-mono text-foreground">{b.formatted}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
