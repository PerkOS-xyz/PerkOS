"use client";

import { useTranslation } from "react-i18next";

export function WalletFeatureNotice({ feature }: { feature: "billing" | "receipts" }) {
  const { t } = useTranslation();
  return (
    <div role="status" className="rounded-md border border-border bg-card px-4 py-3 text-sm">
      <p className="font-medium">{t("walletCapabilities.title")}</p>
      <p className="mt-1 text-muted-foreground">{t(`walletCapabilities.${feature}`)}</p>
    </div>
  );
}
