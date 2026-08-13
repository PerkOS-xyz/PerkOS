"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { emailSchema } from "../lib/validators";
import { useWalletSession } from "../lib/useWalletSession";
import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { privyBrowserEnabled } from "../lib/privyBrowser";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Props = {
  address: string;
};

export function AccessGate({ address }: Props) {
  const { t } = useTranslation();
  const session = useWalletSession();
  const isInMiniApp = useIsInMiniApp();
  // "Use a different wallet" only makes sense in a real browser (Privy owns
  // the wallet). In Farcaster / Base App the wallet is the host identity.
  const privyEnabled = privyBrowserEnabled(isInMiniApp);
  const [loggingOut, setLoggingOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  // With an access code the user redeems for instant access → email + a valid
  // username are required (username is claimed in the shared /usernames
  // registry: 3-20 chars, [a-z0-9_-]). Without a code it's the normal
  // request-access flow (email + username + company).
  const hasCode = accessCode.trim().length > 0;
  const usernameValid = /^[a-z0-9_-]{3,20}$/.test(username.trim().toLowerCase());

  function copyAddress() {
    navigator.clipboard
      .writeText(address)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  async function useDifferentWallet() {
    // Fully log out the Privy wallet + Firebase (a bare wagmi disconnect() is
    // a no-op on the browser/Privy path), then start over from the landing.
    setLoggingOut(true);
    try {
      await session.logout();
    } catch {
      // ignore — navigate away regardless
    }
    window.location.assign("/");
  }

  const emailError = useMemo(() => {
    const parsed = emailSchema.safeParse(email);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  }, [email]);
  const canSubmit =
    !submitting &&
    !emailError &&
    (hasCode
      ? usernameValid
      : username.trim().length > 0 && company.trim().length > 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (hasCode) {
        // Redeem path: valid code → allowlisted instantly, then re-enter.
        const res = await fetch("/api/redeem-access-code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            code: accessCode.trim(),
            email: email.trim(),
            username: username.trim(),
            company: company.trim() || undefined,
            website: website.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            payload.error ||
              t("chrome.accessGate.requestFailed", { status: res.status }),
          );
        }
        // A redeemed code = a brand-new user → send them to onboarding (the
        // wizard sets up their workspace + first project). Full reload so the
        // wallet session re-checks and picks up the fresh allowlist grant.
        window.location.assign("/onboarding/welcome");
        return;
      }

      // Request-access path: no code → goes to the pending queue + team email.
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          email: email.trim(),
          username: username.trim(),
          company: company.trim(),
          website: website.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          payload.error ||
            t("chrome.accessGate.requestFailed", { status: res.status }),
        );
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("chrome.accessGate.submitError"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5 py-10"
      style={{
        backgroundColor: "#0e0716",
        backgroundImage:
          "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
      }}
    >
      <Card className="w-full max-w-md border-primary/40 bg-card shadow-[0_0_24px_rgba(236,27,105,0.18)]">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex items-center justify-center">
            <Image
              src="/perkos-header.png"
              alt="PerkOS"
              width={130}
              height={28}
              priority
            />
          </div>
          <Badge
            variant="secondary"
            className="border-primary/30 bg-primary/10 text-[10px] uppercase tracking-wider text-primary"
          >
            {t("chrome.accessGate.privateAlpha")}
          </Badge>
          <CardTitle className="flex items-center gap-2 pt-2 text-lg">
            <ShieldAlert className="h-4 w-4 text-primary" />
            {submitted
              ? t("chrome.accessGate.titleSubmitted")
              : t("chrome.accessGate.title")}
          </CardTitle>
          <CardDescription className="text-center">
            {submitted
              ? t("chrome.accessGate.descriptionSubmitted")
              : t("chrome.accessGate.description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs">
            <span className="uppercase tracking-wider text-muted-foreground">
              {t("chrome.accessGate.yourWallet")}
            </span>
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 break-all font-mono text-foreground">
                {address}
              </span>
              <button
                type="button"
                onClick={copyAddress}
                aria-label={t("chrome.userMenu.copyFullAddress")}
                title={
                  copied
                    ? t("chrome.userMenu.copied")
                    : t("chrome.userMenu.copyFullAddress")
                }
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              {t("chrome.accessGate.onTheList")}
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-code">
                  {t("chrome.accessGate.accessCodeLabel")}
                </Label>
                <Input
                  id="access-code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder={t("chrome.accessGate.accessCodePlaceholder")}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  {t("chrome.accessGate.accessCodeHint")}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-email">
                  {t("chrome.accessGate.emailLabel")}
                </Label>
                <Input
                  id="access-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-invalid={attempted && Boolean(emailError)}
                  aria-describedby={
                    attempted && emailError ? "access-email-error" : undefined
                  }
                />
                {attempted && emailError ? (
                  <p
                    id="access-email-error"
                    className="text-xs text-destructive"
                  >
                    {emailError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-username">
                  {t("chrome.accessGate.usernameLabel")}
                </Label>
                <Input
                  id="access-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("chrome.accessGate.usernamePlaceholder")}
                  aria-invalid={
                    attempted && hasCode && !usernameValid ? true : undefined
                  }
                />
                {attempted && hasCode && !usernameValid ? (
                  <p className="text-xs text-destructive">
                    {t("chrome.accessGate.usernameInvalid")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-company">
                  {t("chrome.accessGate.companyLabel")}
                </Label>
                <Input
                  id="access-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder={t("chrome.accessGate.companyPlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-website">
                  {t("chrome.accessGate.websiteLabel")}
                </Label>
                <Input
                  id="access-website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>

              {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={!canSubmit}
                className="mt-1 gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {submitting
                  ? hasCode
                    ? t("chrome.accessGate.granting")
                    : t("chrome.accessGate.sending")
                  : hasCode
                    ? t("chrome.accessGate.redeemButton")
                    : t("chrome.accessGate.requestAccessButton")}
              </Button>
            </form>
          )}

          {/* Browser/Privy only — the wallet is connected through Privy, so
              "use a different wallet" fully logs it out (Privy + Firebase) and
              returns to the landing to start over. Hidden in Farcaster / Base App
              (Mini App + in-app browser): there the wallet IS the host identity
              and can't be disconnected. */}
          {privyEnabled ? (
            <Button
              variant="outline"
              size="sm"
              disabled={loggingOut}
              onClick={useDifferentWallet}
              className="mt-1 justify-center gap-2 text-muted-foreground hover:text-foreground"
            >
              {loggingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              {t("chrome.accessGate.useDifferentWallet")}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
