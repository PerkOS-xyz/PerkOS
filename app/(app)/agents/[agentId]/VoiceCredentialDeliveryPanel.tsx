"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { rotateEncryptedVoiceCredentialDelivery, type EncryptedVoiceCredentialDelivery } from "@/app/lib/perkosApi";

type Props = {
  agentId: string;
  agentName: string;
  owner: boolean;
};

export function VoiceCredentialDeliveryPanel({ agentId, agentName, owner }: Props) {
  const { t, i18n } = useTranslation();
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
      setError(cause instanceof Error ? cause.message : t("agentDetail.voiceCredential.rotationFailed"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {t("agentDetail.voiceCredential.title")}
        </CardTitle>
        <CardDescription>
          {t("agentDetail.voiceCredential.description", { name: agentName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {t("agentDetail.voiceCredential.warning")}
        </p>

        <label className="flex flex-col gap-2 text-sm font-medium">
          {t("agentDetail.voiceCredential.publicKey")}
          <textarea
            aria-label={t("agentDetail.voiceCredential.publicKey")}
            className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            disabled={state === "rotating"}
            placeholder={t("agentDetail.voiceCredential.placeholder")}
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
          <span>{t("agentDetail.voiceCredential.acknowledge")}</span>
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
            {state === "rotating" ? t("agentDetail.voiceCredential.encrypting") : t("agentDetail.voiceCredential.rotate")}
          </Button>

        </div>

        {delivery ? (
          <div role="status" className="space-y-1 rounded-md border px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <p className="flex items-center gap-2 font-medium"><Check className="h-4 w-4" /> {t("agentDetail.voiceCredential.pending")}</p>
            <p>{t("agentDetail.voiceCredential.algorithm")}: {delivery.algorithm}</p>
            <p>{t("agentDetail.voiceCredential.audience")}: {delivery.audience}</p>
            <p>{t("agentDetail.voiceCredential.fingerprint")}: <span className="font-mono">{delivery.publicKeyFingerprint}</span></p>
            <p>{t("agentDetail.voiceCredential.expires")}: {new Date(delivery.expiresAt).toLocaleString(i18n.language)}</p>
            <p className="text-muted-foreground">{t("agentDetail.voiceCredential.safeMetadata")}</p>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
