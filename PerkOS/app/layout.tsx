import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PerkOS - The Operating System for AI Agents",
  description: "Build, deploy, and monetize AI agents across multiple platforms. Web3-native infrastructure with x402 payments, ERC-8004 identity, and agent discovery. Spark ignites. Stack powers.",
  keywords: ["AI agents", "Web3", "x402", "ERC-8004", "agent infrastructure", "Discord bot", "Telegram bot", "micropayments"],
  authors: [{ name: "PerkOS" }],
  openGraph: {
    title: "PerkOS - The Operating System for AI Agents",
    description: "Spark ignites. Stack powers. The complete infrastructure for the agentic economy.",
    type: "website",
    url: "https://perkos.xyz",
  },
  twitter: {
    card: "summary_large_image",
    title: "PerkOS - The Operating System for AI Agents",
    description: "Build, deploy, and monetize AI agents with Spark and Stack",
    creator: "@PerkOS_xyz",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
