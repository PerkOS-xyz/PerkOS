"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import { useDisconnect } from "wagmi";
import { CheckCircle2, Loader2, ShieldAlert, LogOut } from "lucide-react";

import { emailSchema } from "../lib/validators";

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
import { formatAddress } from "../lib/format";

type Props = {
  address: string;
};

export function AccessGate({ address }: Props) {
  const { disconnect } = useDisconnect();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const emailError = useMemo(() => {
    const parsed = emailSchema.safeParse(email);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  }, [email]);
  const canSubmit =
    !submitting &&
    !emailError &&
    username.trim().length > 0 &&
    company.trim().length > 0;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
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
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request");
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
            Private alpha
          </Badge>
          <CardTitle className="flex items-center gap-2 pt-2 text-lg">
            <ShieldAlert className="h-4 w-4 text-primary" />
            {submitted ? "Request received" : "Request alpha access"}
          </CardTitle>
          <CardDescription className="text-center">
            {submitted
              ? "We'll reach out to the email you provided once this wallet is approved."
              : "PerkOS is in private alpha. This wallet doesn't have access yet. Tell us a bit about you and we'll get back."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs">
            <span className="uppercase tracking-wider text-muted-foreground">
              Your wallet
            </span>
            <span className="font-mono text-foreground" title={address}>
              {formatAddress(address)}
            </span>
          </div>

          {submitted ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              You&apos;re on the list. Watch your inbox.
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-email">Email</Label>
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
                <Label htmlFor="access-username">Username</Label>
                <Input
                  id="access-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your name or handle"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-company">Company / organization</Label>
                <Input
                  id="access-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="access-website">Website (optional)</Label>
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
                {submitting ? "Sending…" : "Request access"}
              </Button>
            </form>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect()}
            className="mt-1 justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Use a different wallet
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
