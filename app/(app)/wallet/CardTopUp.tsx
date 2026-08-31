"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { authedFetch } from "../../lib/apiClient";

/**
 * Adding credit with a card.
 *
 * ## Why the amounts start at five dollars
 *
 * Card processing costs a percentage plus a fixed fee of roughly thirty cents.
 * The fixed part is what sets the floor: below a few dollars it eats most of
 * the purchase, and at the smallest stablecoin pack it exceeds it entirely.
 *
 * So the copy points anyone wanting less at USDC rather than leaving them to
 * discover the floor by being refused. Buying small genuinely is better on
 * that rail, which is worth saying rather than hiding.
 *
 * ## Nothing here decides what was paid
 *
 * This asks the API for a short-lived, wallet-bound payment capability and
 * sends the person to PerkOS Pay. The portal, rather than this browser, redeems
 * the capability and starts Stripe Checkout. The balance moves only when
 * Stripe's signed webhook reports the money arrived.
 */
const AMOUNTS = [5, 10, 25] as const;

export function CardTopUp() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(amount: number) {
    setPending(amount);
    setError(null);
    try {
      const response = await authedFetch("/api/billing/portal/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { url?: string };
        error?: { message?: string };
      };

      if (!response.ok || !body.data?.url) {
        // The server's own message distinguishes "card payment is not
        // configured" from a rejected amount, and those call for different
        // things from the person reading it.
        setError(body.error?.message ?? t("wallet.cardTopUp.failed"));
        setPending(null);
        return;
      }

      window.location.assign(body.data.url);
    } catch {
      setError(t("wallet.cardTopUp.failed"));
      setPending(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          {t("wallet.cardTopUp.title")}
        </CardTitle>
        <CardDescription>{t("wallet.cardTopUp.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex flex-wrap gap-2">
          {AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              className="min-w-20 gap-2"
              disabled={pending !== null}
              onClick={() => start(amount)}
            >
              {pending === amount ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              ${amount}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("wallet.cardTopUp.smallAmounts")}
        </p>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
