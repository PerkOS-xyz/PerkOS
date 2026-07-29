"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  transferOut,
  chainLabel,
  explorerTxUrl,
  type ChainBalances,
  type TransferInput,
  type TransferResult,
  type WalletBalance,
} from "@/app/lib/serverWallet";

type Chain = "base" | "celo" | "robinhood";
type Step = "form" | "review" | "success";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const SUPPORTED_CHAINS = new Set<Chain>(["base", "celo", "robinhood"]);

function shortValue(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function assetLabel(symbol: string): string {
  return symbol === "PERKOS" ? "$PERKOS" : symbol;
}

function apiToken(balance: WalletBalance): string {
  return balance.address === null ? "native" : balance.symbol;
}

function positiveBalance(balance: WalletBalance): boolean {
  return Number(balance.formatted) > 0;
}

type AvailableAsset = {
  symbol: string;
  networks: Array<{
    chain: Chain;
    balance: WalletBalance;
  }>;
};

export function SendForm({
  address,
  chains,
}: {
  address: string;
  chains: ChainBalances[];
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [symbol, setSymbol] = useState("");
  const [chain, setChain] = useState<Chain | "">("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [touchedRecipient, setTouchedRecipient] = useState(false);
  const [touchedAmount, setTouchedAmount] = useState(false);

  const assets = useMemo<AvailableAsset[]>(() => {
    const grouped = new Map<string, AvailableAsset>();
    for (const chainBalances of chains) {
      if (
        chainBalances.available === false ||
        !SUPPORTED_CHAINS.has(chainBalances.chain as Chain)
      ) {
        continue;
      }
      for (const balance of chainBalances.balances) {
        const current = grouped.get(balance.symbol) ?? {
          symbol: balance.symbol,
          networks: [],
        };
        current.networks.push({
          chain: chainBalances.chain as Chain,
          balance,
        });
        grouped.set(balance.symbol, current);
      }
    }
    return [...grouped.values()].sort((a, b) => {
      const aHasFunds = a.networks.some(({ balance }) => positiveBalance(balance));
      const bHasFunds = b.networks.some(({ balance }) => positiveBalance(balance));
      return Number(bHasFunds) - Number(aHasFunds);
    });
  }, [chains]);

  const hasFunds = assets.some((asset) =>
    asset.networks.some(({ balance }) => positiveBalance(balance)),
  );
  const selectedAsset = assets.find((asset) => asset.symbol === symbol);
  const selectedNetwork = selectedAsset?.networks.find(
    (network) => network.chain === chain,
  );
  const available = Number(selectedNetwork?.balance.formatted ?? 0);
  const isNative = selectedNetwork?.balance.address === null;

  const toTrimmed = to.trim();
  const amountTrimmed = amount.trim();
  const amountNum = Number(amountTrimmed);
  const toValid = ADDR_RE.test(toTrimmed);
  const sendingToSelf =
    toValid && toTrimmed.toLowerCase() === address.toLowerCase();
  const amountValid =
    amountTrimmed !== "" && Number.isFinite(amountNum) && amountNum > 0;
  const insufficientFunds = amountValid && amountNum > available;
  const canReview =
    Boolean(selectedNetwork) &&
    toValid &&
    !sendingToSelf &&
    amountValid &&
    !insufficientFunds;

  const mutation = useMutation<TransferResult, Error, TransferInput>({
    mutationFn: transferOut,
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
    },
  });

  const initializeSelection = () => {
    const firstAsset =
      assets.find((asset) =>
        asset.networks.some(({ balance }) => positiveBalance(balance)),
      ) ?? assets[0];
    const firstNetwork =
      firstAsset?.networks.find(({ balance }) => positiveBalance(balance)) ??
      firstAsset?.networks[0];
    setSymbol(firstAsset?.symbol ?? "");
    setChain(firstNetwork?.chain ?? "");
  };

  const setAsset = (nextSymbol: string) => {
    const nextAsset = assets.find((asset) => asset.symbol === nextSymbol);
    const nextNetwork =
      nextAsset?.networks.find(({ balance }) => positiveBalance(balance)) ??
      nextAsset?.networks[0];
    setSymbol(nextSymbol);
    setChain(nextNetwork?.chain ?? "");
    setAmount("");
    setTouchedAmount(false);
  };

  const begin = () => {
    initializeSelection();
    setStep("form");
    mutation.reset();
    setOpen(true);
  };

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setStep("form");
    setTo("");
    setAmount("");
    setTouchedRecipient(false);
    setTouchedAmount(false);
    mutation.reset();
  };

  const review = (event: React.FormEvent) => {
    event.preventDefault();
    setTouchedRecipient(true);
    setTouchedAmount(true);
    if (canReview) setStep("review");
  };

  const confirm = () => {
    if (!selectedNetwork || !canReview || mutation.isPending) return;
    mutation.mutate({
      chain: selectedNetwork.chain,
      token: apiToken(selectedNetwork.balance),
      to: toTrimmed,
      amount: amountTrimmed,
    });
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // The address remains selectable in the wallet card above.
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/[0.04]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ArrowUpRight className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-medium text-foreground">
                {hasFunds
                  ? t("walletSend.compact.title")
                  : t("walletSend.empty.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFunds
                  ? t("walletSend.compact.description")
                  : t("walletSend.empty.description")}
              </p>
            </div>
          </div>
          {hasFunds ? (
            <Button className="h-11 shrink-0 gap-2 sm:px-6" onClick={begin}>
              <Send className="h-4 w-4" />
              {t("walletSend.compact.action")}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-11 shrink-0 gap-2"
              onClick={copyAddress}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied
                ? t("wallet.address.copied")
                : t("walletSend.empty.copyAddress")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
          {step === "form" ? (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                  {t("walletSend.form.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("walletSend.form.from", { address: shortValue(address) })}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={review} className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="send-asset">
                      {t("walletSend.form.asset")}
                    </Label>
                    <Select
                      value={symbol}
                      onValueChange={(value) => value && setAsset(value)}
                    >
                      <SelectTrigger id="send-asset" className="h-12 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((asset) => (
                          <SelectItem key={asset.symbol} value={asset.symbol}>
                            {assetLabel(asset.symbol)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="send-network">
                      {t("walletSend.form.network")}
                    </Label>
                    <Select
                      value={chain}
                      onValueChange={(value) => {
                        if (!value) return;
                        setChain(value as Chain);
                        setAmount("");
                        setTouchedAmount(false);
                      }}
                    >
                      <SelectTrigger id="send-network" className="h-12 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedAsset?.networks.map((network) => (
                          <SelectItem
                            key={network.chain}
                            value={network.chain}
                          >
                            {chainLabel(network.chain)} ·{" "}
                            {network.balance.formatted}{" "}
                            {assetLabel(network.balance.symbol)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="send-amount">
                      {t("walletSend.form.amount")}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {t("walletSend.form.available", {
                        amount: selectedNetwork?.balance.formatted ?? "0",
                        token: assetLabel(symbol),
                      })}
                    </span>
                  </div>
                  <div className="relative mt-2">
                    <Input
                      id="send-amount"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      onBlur={() => setTouchedAmount(true)}
                      placeholder="0.00"
                      inputMode="decimal"
                      autoComplete="off"
                      className="h-14 pr-24 font-mono text-xl"
                      aria-invalid={
                        touchedAmount && (!amountValid || insufficientFunds)
                      }
                    />
                    {!isNative ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-primary"
                        onClick={() =>
                          setAmount(selectedNetwork?.balance.formatted ?? "")
                        }
                      >
                        {t("walletSend.form.max")}
                      </Button>
                    ) : (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {assetLabel(symbol)}
                      </span>
                    )}
                  </div>
                  {touchedAmount && !amountValid ? (
                    <p className="mt-2 text-xs text-destructive">
                      {t("walletSend.form.amountInvalid")}
                    </p>
                  ) : touchedAmount && insufficientFunds ? (
                    <p className="mt-2 text-xs text-destructive">
                      {t("walletSend.form.insufficient", {
                        token: assetLabel(symbol),
                        network: chainLabel(chain),
                      })}
                    </p>
                  ) : isNative ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t("walletSend.form.nativeGas")}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="send-recipient">
                    {t("walletSend.form.recipient")}
                  </Label>
                  <Input
                    id="send-recipient"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    onBlur={() => setTouchedRecipient(true)}
                    placeholder="0x…"
                    spellCheck={false}
                    autoComplete="off"
                    className="h-12 font-mono"
                    aria-invalid={
                      touchedRecipient && (!toValid || sendingToSelf)
                    }
                  />
                  {touchedRecipient && !toValid ? (
                    <p className="text-xs text-destructive">
                      {t("walletSend.form.recipientInvalid")}
                    </p>
                  ) : touchedRecipient && sendingToSelf ? (
                    <p className="text-xs text-destructive">
                      {t("walletSend.form.recipientSelf")}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {t("walletSend.form.security")}
                </div>

                <Button type="submit" className="h-12 w-full gap-2">
                  {t("walletSend.form.review")}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : step === "review" ? (
            <>
              <DialogHeader className="pr-8">
                <DialogTitle className="text-xl">
                  {t("walletSend.review.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("walletSend.review.description")}
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {[
                  [t("walletSend.review.youSend"), `${amountTrimmed} ${assetLabel(symbol)}`],
                  [t("walletSend.review.from"), `${t("wallet.source.managed")} · ${shortValue(address)}`],
                  [t("walletSend.review.network"), chainLabel(chain)],
                  [t("walletSend.review.to"), shortValue(toTrimmed)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium text-foreground">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                {t("walletSend.review.warning")}
              </div>

              {mutation.isError ? (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : t("walletSend.form.transferFailed")}
                </p>
              ) : null}

              <DialogFooter className="-mx-5 -mb-5 px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
                <Button
                  className="h-11 gap-2"
                  onClick={confirm}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {mutation.isPending
                    ? t("walletSend.form.sending")
                    : t("walletSend.review.confirm")}
                </Button>
                <Button
                  variant="outline"
                  className="h-11 gap-2"
                  onClick={() => {
                    mutation.reset();
                    setStep("form");
                  }}
                  disabled={mutation.isPending}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("walletSend.review.back")}
                </Button>
              </DialogFooter>
            </>
          ) : mutation.data ? (
            <>
              <DialogHeader>
                <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-6 w-6" />
                </span>
                <DialogTitle className="text-xl">
                  {t("walletSend.success.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("walletSend.success.description", {
                    amount: mutation.data.amount,
                    token: assetLabel(symbol),
                    chain: chainLabel(mutation.data.chain),
                  })}
                </DialogDescription>
              </DialogHeader>
              <a
                href={explorerTxUrl(mutation.data.chain, mutation.data.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm transition-colors hover:bg-muted/70"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-foreground">
                  {shortValue(mutation.data.hash)}
                </span>
                <span className="flex items-center gap-1 text-primary">
                  {t("walletSend.success.view")}{" "}
                  <ExternalLink className="h-4 w-4" />
                </span>
              </a>
              <DialogFooter className="-mx-5 -mb-5 px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
                <Button onClick={close}>{t("walletSend.success.done")}</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    mutation.reset();
                    setStep("form");
                    setTo("");
                    setAmount("");
                  }}
                >
                  {t("walletSend.success.sendAnother")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
