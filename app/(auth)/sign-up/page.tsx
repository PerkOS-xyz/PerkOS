"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConnect, useConnection } from "wagmi";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Mail, Wallet } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const { connectors, connect, isPending } = useConnect();
  const { status, address } = useConnection();

  const baseAccountConnector = connectors.find((c) => c.id === "baseAccount");
  const injectedConnector = connectors.find((c) => c.id === "injected");

  const isConnected = status === "connected";
  const isReconnecting = status === "reconnecting";

  // If the user lands here already connected (e.g., reconnecting), send them
  // straight to the onboarding flow.
  useEffect(() => {
    if (isConnected && address) {
      router.replace("/onboarding/welcome");
    }
  }, [isConnected, address, router]);

  return (
    <div className="flex w-[329px] flex-col gap-8 rounded-lg border border-[#530922] bg-[#0e0716] p-10 shadow-[0_0_5px_rgba(236,27,105,0.3)] md:w-[616px] md:gap-14">
      <div className="flex w-full flex-col items-center gap-6 md:gap-5">
        <Image
          src="/perkos-header.png"
          alt="PerkOS"
          width={151}
          height={27}
          priority
        />
      </div>

      <div className="flex w-full flex-col gap-3">
        <h1 className="text-center text-xl font-medium text-[#ececff]">
          Create your account
        </h1>
        <p className="text-center text-sm text-[#7975a8]">
          PerkOS uses your wallet as the account. Connect with email + passkey
          to spin up a smart wallet, or bring an existing wallet.
        </p>
      </div>

      <div className="flex w-full flex-col gap-4">
        <Button
          type="button"
          onClick={() =>
            baseAccountConnector &&
            connect({ connector: baseAccountConnector })
          }
          disabled={!baseAccountConnector || isPending || isReconnecting}
          className="h-12 gap-2 text-base"
        >
          <Mail className="h-4 w-4" />
          Sign up with email
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() =>
            injectedConnector && connect({ connector: injectedConnector })
          }
          disabled={!injectedConnector || isPending || isReconnecting}
          className="h-12 gap-2 text-base"
        >
          <Wallet className="h-4 w-4" />
          Sign up with wallet
        </Button>

        {isReconnecting ? (
          <p className="text-center text-xs text-[#7975a8]">
            Restoring previous session…
          </p>
        ) : null}
      </div>

      <div className="flex h-11 w-full items-center justify-center gap-2 text-sm">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1 text-[#ec1b69] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Already have an account? Sign in
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
