import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Investor Overview",
  description: "PerkOS investor overview: from business problem to accountable AI team.",
  alternates: { canonical: "/deck" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "PerkOS — From business problem to accountable AI team",
    description: "Investor overview of the PerkOS product, operating model, proof, and roadmap.",
    url: "/deck",
    images: [{ url: "/hero/sparky-hero-poster.jpg", width: 1440, height: 810, alt: "PerkOS investor overview" }],
  },
};

export default function DeckLayout({ children }: { children: React.ReactNode }) {
  return children;
}

