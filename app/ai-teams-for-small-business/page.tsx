import type { Metadata } from "next";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";

const SITE = "https://perkos.xyz";

export const metadata: Metadata = {
  title: "AI Teams for Small Business",
  description: "See how an AI team can help a small business with marketing, research, customer support and operations while you approve every action.",
  alternates: { canonical: "/ai-teams-for-small-business" },
};

const FAQ = [
  { q: "What is an AI team for a small business?", a: "It is a coordinated group of specialized AI assistants. One plans the work while others draft marketing, research, customer replies or operational documents." },
  { q: "Does PerkOS act without approval?", a: "No. PerkOS is designed around draft-and-approve workflows, so the business owner remains responsible for what is sent or published." },
  { q: "Do I need technical experience?", a: "No. You choose a business template and describe goals in plain language. PerkOS handles the coordination behind the scenes." },
];

export default function AiTeamsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
    url: `${SITE}/ai-teams-for-small-business`,
  };

  return (
    <PublicPageShell
      eyebrow="AI teams for small business"
      title="A small AI team that turns one business goal into finished work."
      intro="PerkOS AI coordinates specialized teammates for planning, marketing, research, customer support and operations—with you approving every result."
      ctaId="ai_teams"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "AI Teams for Small Business", path: "/ai-teams-for-small-business" },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ContentSection title="What an AI team can handle">
        <FeatureGrid items={[
          { title: "Marketing", body: "Draft social posts, email campaigns, promotions and content in your business voice." },
          { title: "Research", body: "Compare competitors, summarize market changes and turn long research into decisions." },
          { title: "Operations", body: "Prepare plans, organize follow-ups, draft documents and keep recurring work moving." },
        ]} />
      </ContentSection>
      <ContentSection title="How PerkOS AI works">
        <p><strong className="text-foreground">1. Pick your business.</strong> Start with a team designed for your industry or create a custom one.</p>
        <p><strong className="text-foreground">2. Give it a goal.</strong> Write what you need in the same language you would use with a colleague.</p>
        <p><strong className="text-foreground">3. Review the work.</strong> Your team drafts and recommends; you approve, revise or reject.</p>
      </ContentSection>
      <ContentSection title="Frequently asked questions">
        {FAQ.map(({ q, a }) => (
          <article key={q} className="border-b border-border pb-5">
            <h3 className="font-semibold text-foreground">{q}</h3>
            <p className="mt-2">{a}</p>
          </article>
        ))}
      </ContentSection>
    </PublicPageShell>
  );
}
