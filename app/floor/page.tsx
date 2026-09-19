import type { Metadata } from "next";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";

/**
 * /floor — download page for the PerkOS Floor desktop app.
 *
 * The build lives in the PerkOS-Runtime release, so the button points straight
 * at the release asset and the version lives in one constant here. The app is
 * signed with Developer ID but not notarized yet, and the page says so: a first
 * open needs right click and Open, and hiding that only costs trust.
 */

const VERSION = "0.5.8";
const DMG = `https://github.com/PerkOS-xyz/PerkOS-Runtime/releases/download/v${VERSION}/PerkOS-${VERSION}-arm64.dmg`;
const RELEASE = `https://github.com/PerkOS-xyz/PerkOS-Runtime/releases/tag/v${VERSION}`;
const REPO = "https://github.com/PerkOS-xyz/PerkOS-Runtime";
const VIDEO = "https://www.youtube.com/embed/ZsdH46NOCdk";

export const metadata: Metadata = {
  title: "PerkOS Floor",
  description:
    "A Mac app where a desk of agents works tokenized stocks on Base. They draft the order, you hold to approve and sign it in your own wallet.",
  alternates: { canonical: "/floor" },
};

export default function FloorPage() {
  return (
    <PublicPageShell
      eyebrow="PerkOS Floor"
      title="They draft. You approve."
      intro="A Mac app where a desk of agents works tokenized stocks on Base. Scout reads the market, Risk sets the size and can block, Trader drafts the order and never executes, Auditor keeps the record. Nothing moves until you hold and sign in your own wallet."
      ctaId="floor"
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "Floor", path: "/floor" }]}
    >
      <ContentSection title="Download">
        <div className="rounded-2xl border border-border bg-card p-6">
          <a
            href={DMG}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
          >
            Download for macOS
          </a>
          <p className="mt-4 text-sm">
            Version {VERSION}, Apple Silicon, 141 MB. Signed with a Developer ID certificate.
          </p>
          <p className="mt-2 text-sm">
            This build is not notarized yet, so the first open needs a right click on the app and then Open.
            After that it opens normally.
          </p>
          <p className="mt-2 text-sm">
            <a className="underline" href={RELEASE}>Release notes</a>
            {" · "}
            <a className="underline" href={REPO}>Source code</a>
          </p>
        </div>
      </ContentSection>

      <ContentSection title="What the desk does">
        <FeatureGrid
          items={[
            { title: "It reads the market", body: "Prices come from Uniswap and Aerodrome on Base, with a second quote from Bankr beside them. The desk refuses a stock whose deepest pool is too thin to trade." },
            { title: "It sizes and can block", body: "Risk measures the clip against the pool, sets the exits and stops an order outright when the references disagree." },
            { title: "It drafts, never executes", body: "Trader builds the exact transaction and leaves it on the table. You hold to approve, and the signature happens in your own wallet." },
            { title: "It keeps the record", body: "Auditor reconciles what was asked against what happened. Every decision stays in your history with the facts behind it." },
            { title: "It launches tokens", body: "One sentence drafts a launch paired with a tokenized stock, simulated with Bankr before you hold. Creator fees go to your wallet." },
            { title: "It stays yours", body: "Chat history is encrypted on your machine under a key derived from a wallet signature, and your notes stay in your own folder, in Markdown." },
          ]}
        />
      </ContentSection>

      <ContentSection title="See it work">
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border">
          <iframe
            className="h-full w-full"
            src={VIDEO}
            title="PerkOS Floor demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </ContentSection>

      <ContentSection title="What you need">
        <p>A Mac with Apple Silicon, a wallet you already use, and an AI subscription for the voice that talks to you. The agents run on PerkOS infrastructure and rest between tasks.</p>
        <p>Orders are capped at 100 USDC while the desk is new. Everything runs on Base mainnet with your own money, so the cap is there on purpose.</p>
      </ContentSection>
    </PublicPageShell>
  );
}
