"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rotateEncryptedVoiceCredentialDelivery, type EncryptedVoiceCredentialDelivery } from "@/app/lib/perkosApi";

type Props = {
  agentId: string;
  agentName: string;
  owner: boolean;
};

export function VoiceCredentialDeliveryPanel({ agentId, agentName, owner }: Props) {
  const [publicKey, setPublicKey] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [delivery, setDelivery] = useState<EncryptedVoiceCredentialDelivery | null>(null);
  const [state, setState] = useState<"idle" | "rotating" | "ready" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!owner || agentName !== "Bragi") return null;

  const resetSensitiveState = () => {
    setPublicKey("");
    setAcknowledged(false);
  };

  const rotate = async () => {
    setState("rotating");
    setError(null);
    setDelivery(null);
    try {
      const result = await rotateEncryptedVoiceCredentialDelivery(agentId, publicKey.trim());
      setDelivery(result);
      resetSensitiveState();
      setState("ready");
    } catch (cause) {
      setState("failed");
      setError(cause instanceof Error ? cause.message : "Encrypted rotation failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Voice gateway credential delivery
        </CardTitle>
        <CardDescription>
          Owner-only rotation for {agentName}. The API encrypts the new credential to your
          gateway&apos;s ephemeral public key. Bragi pulls the encrypted payload directly;
          this browser receives safe delivery metadata only.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Generate a one-time public key on the gateway and paste only the public key here.
          Never paste a private key, API key, token, or existing credential. Rotating disables
          the previous voice credential immediately.
        </p>

        <label className="flex flex-col gap-2 text-sm font-medium">
          Ephemeral gateway public key
          <textarea
            aria-label="Ephemeral gateway public key"
            className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            disabled={state === "rotating"}
            placeholder="Paste the gateway-generated public key"
            spellCheck={false}
            autoComplete="off"
            value={publicKey}
            onChange={(event) => {
              setPublicKey(event.target.value);
              setDelivery(null);
              setState("idle");
              setError(null);
            }}
          />
        </label>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={acknowledged}
            disabled={state === "rotating"}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>I generated this public key on the intended gateway and understand this rotates the current voice credential.</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={!acknowledged || publicKey.trim().length === 0 || state === "rotating"}
            onClick={() => void rotate()}
          >
            {state === "rotating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {state === "rotating" ? "Encrypting new credential…" : "Rotate and encrypt"}
          </Button>

        </div>

        {delivery ? (
          <div role="status" className="space-y-1 rounded-md border px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <p className="flex items-center gap-2 font-medium"><Check className="h-4 w-4" /> Delivery pending for Bragi</p>
            <p>Algorithm: {delivery.algorithm}</p>
            <p>Audience: {delivery.audience}</p>
            <p>Public-key fingerprint: <span className="font-mono">{delivery.publicKeyFingerprint}</span></p>
            <p>Expires: {new Date(delivery.expiresAt).toLocaleString()}</p>
            <p className="text-muted-foreground">Delivery and claim identifiers are retained by the API and Bragi receiver; ciphertext is never exposed here.</p>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
