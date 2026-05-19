"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[Global error]", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-5"
      style={{
        backgroundColor: "#0e0716",
        backgroundImage:
          "radial-gradient(ellipse 60% 35% at 50% 110%, rgba(236,27,105,0.55) 0%, rgba(236,27,105,0.18) 45%, transparent 75%)",
      }}
    >
      <div className="flex max-w-md flex-col items-center gap-5 rounded-lg border border-destructive/40 bg-card p-8 text-center shadow-[0_0_24px_rgba(236,27,105,0.18)]">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/15 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-medium text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest ? (
            <p className="font-mono text-[10px] text-muted-foreground/70">
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
