import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";

export const metadata: Metadata = {
  title: "AI Solutions for Small Business",
  description:
    "Explore PerkOS AI teams for restaurants, real estate, ecommerce and agencies. Start with a practical workflow and keep every result under your approval.",
  alternates: { canonical: "/solutions" },
};

const SOLUTIONS = [
  {
    href: "/solutions/restaurants",
    title: "Restaurants",
    body: "Plan local promotions, draft weekly content, prepare customer replies and research neighborhood demand.",
  },
  {
    href: "/solutions/real-estate",
    title: "Real estate",
    body: "Turn listing details into marketing, prepare follow-ups and summarize useful market research.",
  },
  {
    href: "/solutions/ecommerce",
    title: "Ecommerce",
    body: "Improve product pages, prepare campaigns and draft support answers grounded in your store policies.",
  },
  {
    href: "/solutions/agencies",
    title: "Agencies",
    body: "Increase research and delivery capacity while your team protects strategy, quality and client relationships.",
  },
];

export default function SolutionsPage() {
  return (
    <PublicPageShell
      eyebrow="PerkOS AI solutions"
      title="AI teams built around the way your business works."
      intro="Choose an industry starting point, describe the result you need in your language and let a coordinated AI team prepare the work for your approval."
      ctaId="solutions"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Solutions", path: "/solutions" },
      ]}
    >
      <ContentSection title="Find the right starting point">
        <div className="grid gap-4 md:grid-cols-2">
          {SOLUTIONS.map((solution) => (
            <Link
              key={solution.href}
              href={solution.href}
              className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold text-foreground">{solution.title}</h3>
                <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{solution.body}</p>
            </Link>
          ))}
        </div>
      </ContentSection>
      <ContentSection title="One goal, a coordinated team, your final say">
        <FeatureGrid
          items={[
            { title: "Start with context", body: "Pick a ready-made team and give it the facts, voice and priorities that matter to your business." },
            { title: "Work in your language", body: "Communicate naturally across PerkOS-supported languages instead of translating your business into technical prompts." },
            { title: "Approve every result", body: "Review drafts and recommendations before anything reaches a customer or becomes part of your workflow." },
          ]}
        />
      </ContentSection>
    </PublicPageShell>
  );
}
