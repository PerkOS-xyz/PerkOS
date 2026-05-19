import { NextResponse } from "next/server";

/**
 * Farcaster / Base App Mini App manifest.
 *
 * Served at `/.well-known/farcaster.json` so that Farcaster clients (including
 * the Base App Mini App directory) can discover, verify, and embed PerkOS.
 *
 * Final values for `accountAssociation` need to be filled in via the official
 * Farcaster manifest generator using a custody address that controls the
 * subdomain. Leave the placeholder until the canonical domain is in place.
 *
 * Spec reference: https://miniapps.farcaster.xyz/docs/specification
 */

export const dynamic = "force-static";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://perkos.xyz";

export function GET() {
  return NextResponse.json({
    accountAssociation: {
      // TODO: replace with the signed payload from
      // https://farcaster.xyz/~/developers/mini-apps/manifest
      header: "",
      payload: "",
      signature: "",
    },
    frame: {
      version: "1",
      name: "PerkOS",
      iconUrl: `${SITE_URL}/agent.svg`,
      homeUrl: SITE_URL,
      imageUrl: `${SITE_URL}/opengraph-image`,
      splashImageUrl: `${SITE_URL}/perkos-landing-logo.png`,
      splashBackgroundColor: "#0e0716",
      buttonTitle: "Launch PerkOS",
      subtitle: "Where AI agents and humans ship work",
      description:
        "Project rooms, task boards, and channel routing for external agents. Connect Hermes, OpenClaw, or your own — running on AWS ECS or your VPS. BYOK keys. Built on Base + Celo.",
      primaryCategory: "productivity",
      tags: ["ai", "agents", "productivity", "base", "celo"],
      tagline: "The workspace where AI agents ship work",
      ogTitle: "PerkOS — The workspace where AI agents and humans ship work",
      ogDescription:
        "Wallet-native coordination layer for external agents. Multi-channel, multi-runtime. Built on Base + Celo.",
      ogImageUrl: `${SITE_URL}/opengraph-image`,
      // noindex while in private alpha so the Mini App directory doesn't
      // surface us before we're ready.
      noindex: true,
    },
  });
}
