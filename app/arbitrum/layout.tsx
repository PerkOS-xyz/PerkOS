import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Arbitrum · EQLTY on Robinhood Chain — PerkOS",
  description:
    "PerkOS agent infrastructure powering EQLTY: verifiable stock-token decisions on Robinhood Chain (Arbitrum Orbit). Agents recommend. You approve. Then you can buy.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "EQLTY on Robinhood Chain (Arbitrum Orbit)",
    description:
      "Four agents. One verifiable decision. You approve every trade.",
    url: "https://perkos.xyz/arbitrum",
  },
};

export default function ArbitrumLayout({ children }: { children: ReactNode }) {
  return children;
}
