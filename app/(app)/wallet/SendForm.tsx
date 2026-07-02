"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Send,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  transferOut,
  chainLabel,
  explorerTxUrl,
  type TransferInput,
  type TransferResult,
} from "@/app/lib/serverWallet";

type Chain = "base" | "celo";

const CHAINS: Chain[] = ["base", "celo"];
const NATIVE_SYMBOL: Record<Chain, string> = { base: "ETH", celo: "CELO" };

/** Token options for a chain — `value` is what the API expects, `label` what we show. */
function tokenOptions(chain: Chain): { value: string; label: string }[] {
  return [
    { value: "USDC", label: "USDC" },
    { value: "PERKOS", label: "$PERKOS" },
    { value: "native", label: NATIVE_SYMBOL[chain] },
  ];
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function shortHash(h: string): string {
  return `${h.slice(0, 10)}…${h.slice(-8)}`;
}

export function SendForm({ address }: { address: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [chain, setChain] = useState<Chain>("base");
  const [token, setToken] = useState<string>("USDC");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const mutation = useMutation<TransferResult, Error, TransferInput>({
    mutationFn: transferOut,
    onSuccess: () => {
      // Balance moved — refresh the Balances card.
      queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
    },
  });

  const toTrimmed = to.trim();
  const amountTrimmed = amount.trim();
  const amountNum = Number(amountTrimmed);

  const toValid = ADDR_RE.test(toTrimmed);
  const amountValid =
    amountTrimmed !== "" && Number.isFinite(amountNum) && amountNum > 0;
  const sendingToSelf = toValid && toTrimmed.toLowerCase() === address.toLowerCase();
  const canSubmit = toValid && amountValid && !mutation.isPending;

  const tokenLabel =
    tokenOptions(chain).find((t) => t.value === token)?.label ?? token;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({ chain, token, to: toTrimmed, amount: amountTrimmed });
  };

  const reset = () => {
    mutation.reset();
    setTo("");
    setAmount("");
  };

  // ----- Success view -----
  if (mutation.isSuccess && mutation.data) {
    const r = mutation.data;
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Check className="h-4 w-4 text-primary" /> {t("walletSend.success.title")}
          </CardTitle>
          <CardDescription>
            {t("walletSend.success.description", {
              amount: r.amount,
              token: r.token === "PERKOS" ? "$PERKOS" : r.token,
              chain: chainLabel(r.chain),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <a
            href={explorerTxUrl(r.chain, r.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-2.5 text-sm transition-colors hover:bg-muted/70"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-foreground">
              {shortHash(r.hash)}
            </span>
            <span className="flex items-center gap-1 text-xs text-primary">
              {t("walletSend.success.view")} <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </a>
          <Button variant="outline" size="sm" className="self-start" onClick={reset}>
            {t("walletSend.success.sendAnother")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ----- Form view -----
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <ArrowUpRight className="h-4 w-4" /> {t("walletSend.form.title")}
        </CardTitle>
        <CardDescription>
          {t("walletSend.form.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Chain */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("walletSend.form.network")}</Label>
            <div className="flex gap-2">
              {CHAINS.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={chain === c ? "default" : "outline"}
                  onClick={() => setChain(c)}
                >
                  {chainLabel(c)}
                </Button>
              ))}
            </div>
          </div>

          {/* Token */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{t("walletSend.form.token")}</Label>
            <div className="flex flex-wrap gap-2">
              {tokenOptions(chain).map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  size="sm"
                  variant={token === t.value ? "default" : "outline"}
                  onClick={() => setToken(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="to" className="text-xs text-muted-foreground">
              {t("walletSend.form.recipient")}
            </Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
              aria-invalid={toTrimmed !== "" && !toValid}
            />
            {toTrimmed !== "" && !toValid ? (
              <p className="text-xs text-destructive">
                {t("walletSend.form.recipientInvalid")}
              </p>
            ) : sendingToSelf ? (
              <p className="text-xs text-muted-foreground">
                {t("walletSend.form.recipientSelf")}
              </p>
            ) : null}
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount" className="text-xs text-muted-foreground">
              {t("walletSend.form.amount", { token: tokenLabel })}
            </Label>
            <Input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={amountTrimmed !== "" && !amountValid}
            />
            {amountTrimmed !== "" && !amountValid ? (
              <p className="text-xs text-destructive">
                {t("walletSend.form.amountInvalid")}
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {mutation.error instanceof Error
                ? mutation.error.message
                : t("walletSend.form.transferFailed")}
            </p>
          ) : null}

          <Button type="submit" disabled={!canSubmit} className="gap-1.5 self-start">
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {mutation.isPending ? t("walletSend.form.sending") : t("walletSend.form.send")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
