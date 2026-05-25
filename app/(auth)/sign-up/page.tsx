"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConnect, useConnection } from "wagmi";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Mail, Wallet } from "lucide-react";

import { useIsInMiniApp } from "../../lib/useIsInMiniApp";

export default function SignUpPage() {
  const router = useRouter();
  const { connectors, connect, isPending } = useConnect();
  const { status, address } = useConnection();
  const isInMiniApp = useIsInMiniApp();

  const baseAccountConnector = connectors.find((c) => c.id === "baseAccount");
  const injectedConnector = connectors.find((c) => c.id === "injected");

  const isConnected = status === "connected";
  const isReconnecting = status === "reconnecting";

  // /sign-up is only meaningful when there is no wallet to connect.
  // If we're inside a Mini App host (wallet about to auto-connect) or
  // wagmi already has a connected wallet (Base App in-app browser with
  // a persisted session, normal browser tab with a prior session, etc.),
  // skip the choose-your-method buttons and let /continue dispatch to
  // /dashboard or the request-access form based on session status.
  useEffect(() => {
    if (isInMiniApp === true || (isConnected && address)) {
      router.replace("/continue");
    }
  }, [isInMiniApp, isConnected, address, router]);

  // While we don't yet know if we're in a Mini App host, OR while we
  // know we are, OR while wagmi has a connected wallet (and we're about
  // to redirect to /continue), render a splash so the buttons never
  // flash to someone who shouldn't see them.
  if (isInMiniApp === null || isInMiniApp === true || (isConnected && address)) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/perkos-header.png"
          alt="PerkOS"
          width={140}
          height={32}
          priority
        />
        <p className="text-sm text-[#7975a8]">Opening PerkOS…</p>
      </div>
    );
  }

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
