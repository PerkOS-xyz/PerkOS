import type { Metadata } from "next";

import { ContentSection, PublicPageShell } from "../components/marketing/PublicPageShell";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How PerkOS AI uses website analytics and contact information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy"
      title="A plain-language privacy notice for the PerkOS AI website."
      intro="This notice explains the limited information used to operate the website, respond to inquiries and improve the experience."
      ctaId="privacy"
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "Privacy", path: "/privacy" }]}
    >
      <ContentSection title="Website analytics">
        <p>PerkOS AI loads Google Analytics only after a visitor accepts analytics. We use aggregated page views, acquisition sources and product-funnel events to understand which pages and steps are useful.</p>
        <p>We do not intentionally send wallet addresses, message contents, contact-form text or other sensitive product data to Google Analytics.</p>
      </ContentSection>
      <ContentSection title="Contact information">
        <p>If you submit the contact form, we use the name, email, subject and message you provide to respond to your inquiry and protect the form from abuse.</p>
      </ContentSection>
      <ContentSection title="Your choices">
        <p>You may decline analytics in the consent prompt. You can reset the choice by clearing site data for perkos.xyz. For privacy questions, email contact@perkos.xyz.</p>
        <p>Last updated: August 9, 2026.</p>
      </ContentSection>
    </PublicPageShell>
  );
}
