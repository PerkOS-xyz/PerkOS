import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentSection, FeatureGrid, PublicPageShell } from "../../components/marketing/PublicPageShell";

const SOLUTIONS = {
  restaurants: {
    label: "Restaurants",
    title: "An AI team for restaurants that keeps tables full and owners off the screen.",
    intro: "Answer WhatsApp questions from your menu and hours, draft promos for approval, and hand off when a table or allergy needs a human — never invent availability.",
    outcomes: [
      { title: "WhatsApp FAQ", body: "Reply on menu, hours and allergies from your knowledge — escalate when unsure." },
      { title: "Reservations with guardrails", body: "Offer only real slots; never confirm a table that was not actually free." },
      { title: "Owner drafts", body: "Promotions and review replies stay as drafts until you approve." },
    ],
  },
  barbershops: {
    label: "Barbershops",
    title: "An AI team for barbershops and stylists that books real chairs, not imaginary ones.",
    intro: "Take WhatsApp booking requests, offer only open stylist slots, and pass the chat to the front desk when confidence is low.",
    outcomes: [
      { title: "WhatsApp booking", body: "Offer concrete stylist slots and confirm only numbers the customer picks from that list." },
      { title: "Services and pricing", body: "Answer from your real price list — never invent a cut or a fee." },
      { title: "Human handoff", body: "Angry clients, VIP requests and unclear cases go straight to a person." },
    ],
  },
  "real-estate": {
    label: "Real Estate",
    title: "An AI team for real estate professionals who would rather meet clients than chase drafts.",
    intro: "Turn listing details into polished marketing, prepare follow-ups and summarize neighborhood research while you stay focused on showings and relationships.",
    outcomes: [
      { title: "Listing content", body: "Draft descriptions, social posts and email announcements from property details." },
      { title: "Follow-up", body: "Prepare timely buyer and seller messages for your approval." },
      { title: "Market briefs", body: "Summarize comparable listings, neighborhood changes and useful client context." },
    ],
  },
  ecommerce: {
    label: "Ecommerce",
    title: "An AI team for ecommerce that keeps products, promotions and customer replies moving.",
    intro: "Create clearer product pages, plan campaigns and draft support answers without growing the pile of tools your store already depends on.",
    outcomes: [
      { title: "Product pages", body: "Draft search-friendly titles, descriptions, comparisons and benefit-led copy." },
      { title: "Campaigns", body: "Prepare promotional calendars, email drafts and social variations." },
      { title: "Customer support", body: "Draft helpful replies grounded in your store policies and product details." },
    ],
  },
  agencies: {
    label: "Agencies",
    title: "An AI team for agencies that increases delivery capacity without increasing late nights.",
    intro: "Delegate research, first drafts, campaign variations and reporting preparation while your team protects strategy, quality and client relationships.",
    outcomes: [
      { title: "Client research", body: "Summarize markets, competitors and source material before kickoff." },
      { title: "Content production", body: "Create structured first drafts and channel-specific variations for review." },
      { title: "Delivery operations", body: "Break goals into tasks, prepare status updates and keep work visible." },
    ],
  },
} as const;

type Industry = keyof typeof SOLUTIONS;

export function generateStaticParams() {
  return Object.keys(SOLUTIONS).map((industry) => ({ industry }));
}

export async function generateMetadata({ params }: { params: Promise<{ industry: string }> }): Promise<Metadata> {
  const { industry } = await params;
  const solution = SOLUTIONS[industry as Industry];
  if (!solution) return {};

  return {
    title: `AI Team for ${solution.label}`,
    description: solution.intro,
    alternates: { canonical: `/solutions/${industry}` },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ industry: string }> }) {
  const { industry } = await params;
  const solution = SOLUTIONS[industry as Industry];
  if (!solution) notFound();

  return (
    <PublicPageShell
      eyebrow={`PerkOS AI for ${solution.label}`}
      title={solution.title}
      intro={solution.intro}
      ctaId={`solution_${industry}`}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Solutions", path: "/solutions" },
        { name: solution.label, path: `/solutions/${industry}` },
      ]}
    >
      <ContentSection title={`What PerkOS can help ${solution.label.toLowerCase()} accomplish`}>
        <FeatureGrid items={[...solution.outcomes]} />
      </ContentSection>
      <ContentSection title="Built around approval, not autopilot">
        <p>PerkOS teammates prepare work and recommendations, but you decide what is ready. That makes it practical for customer-facing work where accuracy, voice and local judgment matter.</p>
        <p>Start from an industry template, describe the result you want and adjust the team as your business changes.</p>
      </ContentSection>
    </PublicPageShell>
  );
}
