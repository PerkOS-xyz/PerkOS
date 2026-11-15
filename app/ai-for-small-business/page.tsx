import type { Metadata } from "next";
import Link from "next/link";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";
import { ComparisonTable, FaqList, KeyPoint, RelatedPages, Steps } from "../components/marketing/LongForm";
import { publicPageMetadata } from "../lib/publicPageMetadata";

// ============================================================================
// /ai-for-small-business: the guide for "AI for small business" and its close
// variants (AI tools for small business, best AI for small business). Written
// for an owner deciding where to start, so it explains the kinds of AI tools
// before it talks about PerkOS. Plain words, no jargon.
// ============================================================================

const PATH = "/ai-for-small-business";

export const metadata: Metadata = publicPageMetadata({
  title: "AI for Small Business: A Practical Guide",
  description:
    "How a small business can use AI today: what it is good at, the three kinds of AI tools, how to choose, and a simple 30-day plan to get started.",
  path: PATH,
});

const FAQ = [
  {
    q: "How can AI help a small business?",
    a: "AI helps most with recurring work that takes time but follows a pattern: posts and newsletters, replies to reviews and common questions, research before a decision, follow-ups, quotes and weekly summaries. The owner keeps the decisions and approves the results.",
  },
  {
    q: "What is the best AI for a small business?",
    a: "It depends on the work. A chat assistant is good for one question at a time, a single-purpose tool is good for one job, and a team of AI agents is best when you want whole goals handled, like a monthly campaign or a week of follow-ups. Start with the work you repeat every week.",
  },
  {
    q: "Is AI expensive for a small business?",
    a: "It does not have to be. Many tools have a free tier, and PerkOS is free to start. Paid PerkOS plans include a monthly allowance, and usage pauses at zero, so there are no surprise bills.",
  },
  {
    q: "Do I need technical skills to use AI in my business?",
    a: "No. Modern AI tools take instructions in plain language. With PerkOS you pick a team made for your kind of business and write your goal the way you would say it to a colleague.",
  },
  {
    q: "How do I keep control of what AI sends to customers?",
    a: "Choose tools with an approval step. In PerkOS every result waits for your OK, so nothing is sent or published until you say so.",
  },
  {
    q: "Where should a small business start with AI?",
    a: "Pick one task you do every week, give it to AI for a month, and review every result. Weekly posts, review replies and follow-ups are good first choices because they repeat and show results quickly.",
  },
];

export default function AiForSmallBusinessPage() {
  return (
    <PublicPageShell
      eyebrow="AI for small business"
      title="AI for small business: where it helps, and how to start this month."
      intro="AI can now take the first draft of the work that fills a small business week. This guide explains what it is good at, the kinds of AI tools you can choose from, and a simple plan to start while you stay in charge."
      ctaId="ai_small_business"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "AI for Small Business", path: PATH },
      ]}
    >
      <ContentSection title="What AI is good at in a small business">
        <p>
          A small business has the same recurring work as a large one, with far fewer people to do
          it. AI is strongest at exactly that kind of work: tasks that follow a pattern, take time
          and still need a person to make the final call.
        </p>
        <FeatureGrid
          items={[
            { title: "Content and promotions", body: "Weekly posts, newsletters, seasonal offers and event announcements in your business voice." },
            { title: "Customer replies", body: "Answers to reviews and common questions, written from your own policies and details." },
            { title: "Research", body: "Competitor prices, local trends and supplier options, summed up as a short brief." },
            { title: "Follow-ups", body: "Messages for leads, clients and suppliers, ready on time." },
            { title: "Quotes and documents", body: "Proposals, quotes, plans and checklists prepared from a few notes." },
            { title: "Numbers", body: "Weekly summaries of sales and spending, with what needs attention." },
          ]}
        />
        <KeyPoint>
          A good rule: give AI the first draft, and keep the decision. You save the hours, and the
          judgment stays yours.
        </KeyPoint>
      </ContentSection>

      <ContentSection title="The three kinds of AI tools">
        <p>
          Most AI products for business fall into three groups. Knowing which one you need saves a
          lot of trial and error.
        </p>
        <ComparisonTable
          caption="Chat assistants, single-purpose AI tools and AI agent teams compared"
          columns={["", "Chat assistant", "Single-purpose tool", "Team of AI agents"]}
          rows={[
            ["Best for", "One question at a time", "One job, like captions or invoices", "Whole goals, like a campaign or a week of follow-ups"],
            ["Who plans the work", "You", "The tool, for its one job", "A coordinator splits the goal into tasks"],
            ["How you work with it", "Write a prompt, copy the answer", "Use it inside its own app", "Give a goal, approve the results"],
            ["Setup", "None", "One tool per job", "Pick a team for your kind of business"],
            ["Where it shines", "Quick help", "A single repeated task", "Recurring work across several areas"],
          ]}
        />
        <p>
          PerkOS is the third kind: a{" "}
          <Link href="/ai-teams-for-small-business" className="text-foreground underline underline-offset-4">team of AI agents</Link>{" "}
          led by a coordinator called Sparky. Read more in the guide to{" "}
          <Link href="/ai-agents-for-business" className="text-foreground underline underline-offset-4">AI agents for business</Link>.
        </p>
      </ContentSection>

      <ContentSection title="How to choose AI for your small business">
        <FeatureGrid
          items={[
            { title: "Start from the work", body: "List the tasks you repeat every week. Choose the tool that covers the most of them, not the one with the most features." },
            { title: "Look for an approval step", body: "Anything that reaches customers should wait for your OK. That keeps your voice and your promises yours." },
            { title: "Prefer plain language", body: "You should be able to describe what you want the way you would to a colleague, with no setup scripts." },
            { title: "Check that it knows your business", body: "Tools that start from your industry give better first drafts than a blank box." },
            { title: "Read the pricing", body: "Look for a free way to start, a clear monthly allowance and usage that stops at zero." },
            { title: "See the work as it happens", body: "A shared view of every task makes it easy to trust the results and spot what needs a change." },
          ]}
        />
      </ContentSection>

      <ContentSection title="A 30-day plan to start with AI">
        <Steps
          items={[
            { title: "Week 1: pick one task", body: "Choose something you do every week, like next week's posts or replies to recent reviews. Write down how long it takes today." },
            { title: "Week 2: share your details", body: "Give the AI your hours, prices, tone and policies once. Every draft gets more accurate from here." },
            { title: "Week 3: review closely", body: "Approve what is ready and give short, specific feedback on the rest, like \"shorter\" or \"warmer\"." },
            { title: "Week 4: measure and add", body: "Compare the time spent with week 1. If it saved hours, add the next recurring task." },
          ]}
        />
      </ContentSection>

      <ContentSection title="How PerkOS does it">
        <p>
          With PerkOS you choose a team made for your kind of business: restaurants, real estate,
          online stores, agencies, consulting, health and wellness, coaching, trades, finance or
          local services. You give the team a goal in plain words. Sparky, the team lead, turns it
          into tasks on a shared board, the specialists draft the work, and every result comes back
          to you for approval.
        </p>
        <p>
          Teams run in PerkOS Cloud, or on your own computers with{" "}
          <Link href="/runtime" className="text-foreground underline underline-offset-4">PerkOS Runtime</Link>.
          PerkOS is free to start; see the{" "}
          <Link href="/pricing" className="text-foreground underline underline-offset-4">plans</Link>.
        </p>
      </ContentSection>

      <ContentSection title="Frequently asked questions">
        <FaqList items={FAQ} path={PATH} />
      </ContentSection>

      <ContentSection title="Keep reading">
        <RelatedPages
          links={[
            { href: "/ai-employees", title: "AI employees for small business", body: "What an AI employee is, what it can take off your plate, and how to bring one on." },
            { href: "/ai-agents-for-business", title: "AI agents for business", body: "What AI agents can do for a small business and how a team of agents works." },
            { href: "/solutions", title: "Solutions by industry", body: "Ready-made teams for restaurants, real estate, online stores and agencies." },
          ]}
        />
      </ContentSection>
    </PublicPageShell>
  );
}
