"use client";

import Image from "next/image";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTranslation } from "react-i18next";

export function DynamicSignInButton() {
  const { setShowAuthFlow, sdkHasLoaded } = useDynamicContext();
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled={!sdkHasLoaded}
      onClick={() => setShowAuthFlow(true)}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      <Image src="/brand/icon-mail.svg" alt="" width={16} height={16} />
      <span className="text-base leading-none">{t("landing.nav.signIn")}</span>
    </button>
  );
}
