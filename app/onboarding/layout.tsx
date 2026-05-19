"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useConnection } from "wagmi";

import { useWalletSession } from "../lib/useWalletSession";
import { AccessGate } from "../components/AccessGate";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { address } = useConnection();
  const session = useWalletSession();

  useEffect(() => {
    if (session.status === "signed-out") router.replace("/sign-in");
  }, [session.status, router]);

  if (
    session.status === "loading" ||
    session.status === "syncing" ||
    session.status === "error"
  ) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center px-5"
        style={{
          backgroundColor: "#0e0716",
          backgroundImage:
            "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
        }}
      />
    );
  }

  // Alpha gate.
  if (session.status === "not-allowlisted" && address) {
    return <AccessGate address={address} />;
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
      {children}
    </div>
  );
}
