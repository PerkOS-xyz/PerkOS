"use client";

import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";

export function PrivySignInButton() {
  const { login, ready } = usePrivy();
  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => login()}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ec1b69] px-6 py-4 font-medium text-[#ececff] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      <Image src="/brand/icon-mail.svg" alt="" width={16} height={16} />
      <span className="text-base leading-none">Continue with email or wallet</span>
    </button>
  );
}
