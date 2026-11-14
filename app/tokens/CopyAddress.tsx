"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies a contract address so people paste it instead of retyping it. */
export function CopyAddress({ address, chain }: { address: string; chain: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(address);
      ok = true;
    } catch {
      // Some browsers and embedded views block the async clipboard. The old
      // copy command still works there; if it fails too, the address stays
      // selectable on the page.
      const field = document.createElement("textarea");
      field.value = address;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      field.remove();
    }
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `${chain} contract copied` : `Copy the ${chain} contract`}
      className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
