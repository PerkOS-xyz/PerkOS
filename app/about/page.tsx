import type { Metadata } from "next";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";

export const metadata: Metadata = {
  title: "About PerkOS AI",
  description: "Learn how PerkOS AI helps small businesses use practical AI teams while keeping people in control of every action.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PublicPageShell
      eyebrow="About PerkOS AI"
      title="Practical AI help, built for the people doing everything themselves."
      intro="PerkOS AI gives small-business owners a coordinated team for the work that steals time from customers, craft and growth."
      ctaId="about"
    >
      <ContentSection title="Why we built PerkOS AI">
        <p>Most AI products give you another blank chat box. PerkOS starts with a team that already understands common business jobs: planning, marketing, research, customer replies and keeping work organized.</p>
        <p>You describe the outcome in plain language. The team turns it into a plan, drafts the work and brings decisions back to you. Nothing is published or sent without your approval.</p>
      </ContentSection>
      <ContentSection title="What we believe">
        <FeatureGrid items={[
          { title: "People stay in control", body: "AI should remove repetitive work without removing judgment. You review, revise and approve." },
          { title: "Results beat jargon", body: "Business owners should not need to understand models, infrastructure or prompts to get useful work." },
          { title: "A team beats another tool", body: "PerkOS coordinates specialized teammates around one goal, so work moves forward instead of piling up." },
        ]} />
      </ContentSection>
    </PublicPageShell>
  );
}
