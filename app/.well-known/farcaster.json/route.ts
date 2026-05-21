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
      // Farcaster manifest constraints:
      //   subtitle, tagline, ogTitle  ≤ 30 chars
      //   description                 ≤ 170 chars
      //   ogDescription               ≤ 100 chars
      //   No special chars in description / ogDescription:
      //     @  #  $  %  ^  &  *  +  =  /  \  |  ~  «  »
      subtitle: "AI agents ship with your team",
      description:
        "Project rooms, task boards, and channel routing for external agents. Connect Hermes, OpenClaw, or your own. Built on Base and Celo.",
      primaryCategory: "productivity",
      tags: ["ai", "agents", "productivity", "base", "celo"],
      tagline: "Agents and humans ship work",
      ogTitle: "PerkOS: agents ship work",
      ogDescription:
        "Wallet-native coordination for external agents. Built on Base and Celo.",
      ogImageUrl: `${SITE_URL}/opengraph-image`,
      // noindex while in private alpha so the Mini App directory doesn't
      // surface us before we're ready.
      noindex: true,
    },
  });
}
