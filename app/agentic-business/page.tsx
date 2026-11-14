import type { Metadata } from "next";
import Link from "next/link";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";
import { ComparisonTable, FaqList, KeyPoint, RelatedPages, Steps } from "../components/marketing/LongForm";
import { publicPageMetadata } from "../lib/publicPageMetadata";

// ============================================================================
// /agentic-business: the explainer for "agentic business". Defines the term in
// plain words and ties it to how PerkOS works, so answer engines that look it
// up find a clear definition with PerkOS as the example.
// ============================================================================

const PATH = "/agentic-business";

export const metadata: Metadata = publicPageMetadata({
  title: "What Is an Agentic Business?",
  description:
    "An agentic business uses AI agents for routine work while people make the decisions. What it means, what it looks like in a small business, and how to start.",
  path: PATH,
});

const FAQ = [
  {
    q: "What is an agentic business?",
    a: "An agentic business is a company where AI agents carry out routine work toward goals that people set, and people review and approve the results. The owner decides what matters; the agents do the first draft of the work.",
  },
  {
    q: "What does agentic mean?",
    a: "Agentic describes AI that acts toward a goal over several steps, instead of answering one question at a time. An agentic system plans, does the work and reports back.",
  },
  {
    q: "Can a small business be an agentic business?",
    a: "Yes, and small businesses may gain the most. A team of AI agents gives a business of one to ten people help with content, research, customer replies and paperwork that it could not staff before.",
  },
  {
    q: "How do I start running an agentic business?",
    a: "Start with one recurring goal, such as weekly posts or review replies, give it to a team of AI agents, and approve the results. Add the next goal once the first runs smoothly. PerkOS gives you a ready-made team for your kind of business and is free to start.",
  },
];

export default function AgenticBusinessPage() {
  return (
    <PublicPageShell
      eyebrow="Agentic business"
      title="What is an agentic business?"
      intro="An agentic business is a company where AI agents handle the routine work toward goals that people set, and people approve the results. Here is what that means in practice, and how a small business can start."
      ctaId="agentic_business"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Agentic Business", path: PATH },
      ]}
    >
      <ContentSection title="Agentic business, in plain words">
        <p>
          &quot;Agentic&quot; describes AI that works toward a goal instead of answering one
          question at a time. It plans the steps, does the work and reports back.
        </p>
        <p>
          An agentic business puts that kind of AI to work on its everyday tasks. People choose the
          goals and make the calls. AI agents prepare the drafts, research and follow-ups that used
          to fill the week.
        </p>
        <KeyPoint>
          The short version: people decide, AI agents do the first draft, and every result waits for
          a person to approve it.
        </KeyPoint>
      </ContentSection>

      <ContentSection title="How it changes the work">
        <ComparisonTable
          caption="A traditional small business and an agentic business compared"
          columns={["", "Traditional", "Agentic"]}
          rows={[
            ["Weekly content", "Written late at night by the owner", "Drafted by an agent, approved in minutes"],
            ["Customer replies", "Answered when there is time", "Drafted from your policies, ready to send"],
            ["Research", "Skipped, or done in a rush", "A short brief before each decision"],
            ["Follow-ups", "Kept in the owner's head", "Prepared on time on a shared board"],
            ["The owner's time", "Spent on busywork", "Spent on customers and decisions"],
          ]}
        />
      </ContentSection>

      <ContentSection title="The three parts of an agentic business">
        <FeatureGrid
          items={[
            { title: "Clear goals", body: "People set goals in plain words: fill Tuesday nights, answer every review this week, prepare the March offer." },
            { title: "A team of agents", body: "A coordinator splits each goal into tasks, and specialist agents handle research, writing and numbers side by side." },
            { title: "Human approval", body: "Every result comes back for review. People approve, ask for changes or set it aside, so quality and voice stay theirs." },
          ]}
        />
      </ContentSection>

      <ContentSection title="What it looks like with PerkOS">
        <p>
          PerkOS is built for this way of working. Each business gets a team led by Sparky, the
          PerkOS coordinator, with specialists chosen for its industry.
        </p>
        <Steps
          items={[
            { title: "Set the goal", body: "Write what you want this week. Sparky turns it into tasks on the team board." },
            { title: "Let the team draft", body: "Specialist agents work on their tasks in parallel, and you can follow every step." },
            { title: "Approve the results", body: "Approve, edit or set aside. Nothing goes out until you say so." },
          ]}
        />
        <p>
          Read the full guide to{" "}
          <Link href="/ai-agents-for-business" className="text-foreground underline underline-offset-4">AI agents for business</Link>{" "}
          or see how{" "}
          <Link href="/ai-teams-for-small-business" className="text-foreground underline underline-offset-4">AI teams for small business</Link>{" "}
          work day to day.
        </p>
      </ContentSection>

      <ContentSection title="Frequently asked questions">
        <FaqList items={FAQ} path={PATH} />
      </ContentSection>

      <ContentSection title="Keep reading">
        <RelatedPages
          links={[
            { href: "/ai-agents-for-business", title: "AI agents for business", body: "What AI agents can do for a small business and how to choose them." },
            { href: "/ai-teams-for-small-business", title: "AI teams for small business", body: "How a coordinated team turns one goal into finished work." },
            { href: "/solutions", title: "Solutions by industry", body: "Ready-made teams for restaurants, real estate, online stores and agencies." },
          ]}
        />
      </ContentSection>
    </PublicPageShell>
  );
}
