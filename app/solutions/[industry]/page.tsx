import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentSection, FeatureGrid, PublicPageShell } from "../../components/marketing/PublicPageShell";
import { ComparisonTable, FaqList, RelatedPages, Steps } from "../../components/marketing/LongForm";
import { publicPageMetadata } from "../../lib/publicPageMetadata";

const SOLUTIONS = {
  restaurants: {
    label: "Restaurants",
    title: "An AI team for restaurants that keeps tables full and owners off the screen.",
    intro: "Plan promotions, draft weekly content, answer common customer questions and research local demand without adding another late-night shift.",
    outcomes: [
      { title: "Local promotion", body: "Draft promotions for quiet days, seasonal menus and neighborhood events." },
      { title: "Customer replies", body: "Prepare accurate, on-brand responses to reviews and common questions." },
      { title: "Menu research", body: "Compare local pricing, trends and competitor positioning before making changes." },
    ],
    week: [
      ["Fill Tuesday and Wednesday nights", "A midweek offer, three posts and an email to regulars"],
      ["Answer this week's reviews", "A reply to every new review, in the restaurant's voice"],
      ["Launch the fall menu", "Menu descriptions, a launch post and a note for the staff"],
      ["Check what nearby places charge", "A short price brief with a recommendation"],
    ],
    faq: [
      { q: "What can an AI team do for a restaurant?", a: "It drafts promotions for slow days, weekly posts, replies to reviews and short research on local prices and trends. The owner approves each result before it goes out." },
      { q: "Will the replies sound like my restaurant?", a: "Yes. The team writes from the details and tone you give it, and you can ask for changes on any draft until it sounds right." },
      { q: "How much time does it take each week?", a: "Most owners spend a few minutes giving goals and reviewing drafts. The team prepares the work in between." },
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
    week: [
      ["List the new property on Oak Street", "A listing description, social posts and an email announcement"],
      ["Follow up with this week's open house visitors", "A personal message for each visitor, ready to send"],
      ["Prepare for a listing appointment", "A brief on comparable homes and recent neighborhood changes"],
      ["Stay in touch with past clients", "A monthly market update for your client list"],
    ],
    faq: [
      { q: "What can an AI team do for a real estate agent?", a: "It drafts listing descriptions, posts and emails, prepares follow-ups for buyers and sellers, and summarizes comparable listings and neighborhood trends. You approve everything before it goes out." },
      { q: "Can it help me follow up faster?", a: "Yes. Give the team the names and context after a showing or open house, and it prepares a message for each person for your approval." },
      { q: "Does it work with my CRM?", a: "Yes. PerkOS prepares the work, and you keep sending and tracking it in the tools you already use." },
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
    week: [
      ["Refresh the top ten product pages", "Clearer titles, descriptions and comparisons for each product"],
      ["Plan the holiday sale", "A campaign calendar, email drafts and social variations"],
      ["Answer this week's support questions", "Replies based on your shipping and return policies"],
      ["See what competitors are pricing", "A short brief on prices and offers in your category"],
    ],
    faq: [
      { q: "What can an AI team do for an online store?", a: "It drafts product pages, plans campaigns, prepares email and social content, and writes support replies from your store policies. You approve each result." },
      { q: "Can it write search-friendly product descriptions?", a: "Yes. The team drafts titles and descriptions that explain the product clearly and use the words shoppers search for, and you edit or approve them." },
      { q: "Does it work with my store platform?", a: "PerkOS prepares the content and you publish it in your store. It works alongside whatever platform you already use." },
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
    week: [
      ["Kick off a new client", "A research brief on the client's market and competitors"],
      ["Produce a month of social content", "First drafts for each channel, ready for your team's review"],
      ["Prepare the monthly report", "A summary of results and next steps for the client"],
      ["Pitch a new prospect", "A proposal draft built from your notes"],
    ],
    faq: [
      { q: "What can an AI team do for an agency?", a: "It handles client research, first drafts, channel variations and report preparation, so your people spend their time on strategy and client relationships." },
      { q: "Can several people on my agency team use it?", a: "Yes. You can invite people to your organization in PerkOS and share projects with them." },
      { q: "How do I keep quality high?", a: "Every draft waits for approval, and your team can ask for changes on any task before it reaches a client." },
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

  return publicPageMetadata({
    title: `AI Team for ${solution.label}`,
    description: solution.intro,
    path: `/solutions/${industry}`,
  });
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
      <ContentSection title={`A week with an AI team for ${solution.label.toLowerCase()}`}>
        <ComparisonTable
          caption={`Example goals for an AI team for ${solution.label.toLowerCase()}`}
          columns={["Your goal", "What the team prepares"]}
          rows={solution.week.map((row) => [...row])}
        />
      </ContentSection>
      <ContentSection title="How it works">
        <Steps
          items={[
            { title: "Start from your industry", body: `Pick the ${solution.label.toLowerCase()} team template. It already knows the work that fits your business.` },
            { title: "Give it a goal", body: "Write what you need in plain words. Sparky, the team lead, turns it into tasks on the team board." },
            { title: "Approve the results", body: "The team drafts the work and you approve, ask for changes or set it aside." },
          ]}
        />
      </ContentSection>
      <ContentSection title="Built around approval, not autopilot">
        <p>PerkOS teammates prepare work and recommendations, but you decide what is ready. That makes it practical for customer-facing work where accuracy, voice and local judgment matter.</p>
        <p>Start from an industry template, describe the result you want and adjust the team as your business changes.</p>
      </ContentSection>
      <ContentSection title="Frequently asked questions">
        <FaqList items={[...solution.faq]} path={`/solutions/${industry}`} />
      </ContentSection>
      <ContentSection title="Keep reading">
        <RelatedPages
          links={[
            { href: "/ai-agents-for-business", title: "AI agents for business", body: "What AI agents can do for a small business and how to choose them." },
            { href: "/ai-teams-for-small-business", title: "AI teams for small business", body: "How a coordinated team turns one goal into finished work." },
            { href: "/solutions", title: "All solutions", body: "Ready-made teams for restaurants, real estate, online stores and agencies." },
          ]}
        />
      </ContentSection>
    </PublicPageShell>
  );
}
