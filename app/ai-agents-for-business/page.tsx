import type { Metadata } from "next";
import Link from "next/link";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";
import { ComparisonTable, FaqList, KeyPoint, RelatedPages, Steps } from "../components/marketing/LongForm";
import { publicPageMetadata } from "../lib/publicPageMetadata";

// ============================================================================
// /ai-agents-for-business: the guide for the search "AI agents for business".
// Written for an owner who is deciding, not for a developer: what an agent
// is, what it can take off their plate, and how to start with approval in
// place. Plain words, no jargon past "agent" itself.
// ============================================================================

const PATH = "/ai-agents-for-business";

export const metadata: Metadata = publicPageMetadata({
  title: "AI Agents for Business: A Practical Guide",
  description:
    "What AI agents for business are, what they can do for a small business, how a team of agents works, and how to start with PerkOS while you approve every result.",
  path: PATH,
});

const FAQ = [
  {
    q: "What is an AI agent for business?",
    a: "An AI agent for business is software that takes a goal, plans the steps, and does the work, such as drafting a promotion, researching competitors or preparing follow-up messages. In PerkOS, agents work as a team and the owner approves each result before it goes out.",
  },
  {
    q: "How is an AI agent different from a chatbot?",
    a: "A chatbot answers one message at a time. An AI agent works toward a goal across several steps and hands back finished work. A team of agents splits a bigger goal into tasks, so research, writing and follow-up happen side by side.",
  },
  {
    q: "Are AI agents useful for a small business?",
    a: "Yes. Small businesses have the same recurring work as large ones, like content, customer replies, research and paperwork, with fewer people to do it. AI agents take the first draft of that work so the owner spends time on decisions and customers.",
  },
  {
    q: "Do AI agents act on their own?",
    a: "In PerkOS, every result waits for your approval. You can approve it, ask for changes or set it aside, and nothing is sent or published until you say so.",
  },
  {
    q: "How much do AI agents for business cost?",
    a: "PerkOS is free to start. Paid plans add monthly PerkOS Infra hours, and you can use prepaid Managed AI credits or connect your own AI provider. Usage pauses at zero, so there are no surprise bills. See perkos.xyz/pricing.",
  },
  {
    q: "Do I need technical skills to use AI agents?",
    a: "No. You pick a team made for your kind of business and write your goal the way you would say it to a colleague. Sparky, the PerkOS coordinator, turns it into tasks for the team.",
  },
];

export default function AiAgentsForBusinessPage() {
  return (
    <PublicPageShell
      eyebrow="AI agents for business"
      title="AI agents for business: a team that drafts the work, and you approve it."
      intro="AI agents can now handle the first draft of the work that fills a small business week: content, customer replies, research, follow-ups and paperwork. This guide explains what they are, where they help most, and how to start with a team you stay in charge of."
      ctaId="ai_agents_business"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "AI Agents for Business", path: PATH },
      ]}
    >
      <ContentSection title="What is an AI agent for business?">
        <p>
          An AI agent is software that works toward a goal. You tell it what you want, for example
          &quot;fill our quiet Tuesday nights&quot; or &quot;follow up with everyone who asked about
          the listing on Oak Street&quot;, and it plans the steps, gathers what it needs and hands
          back finished work.
        </p>
        <p>
          That is the difference from the AI chat tools most people tried first. A chat tool answers
          one question at a time and waits for the next prompt. An agent keeps going until the task
          is done, then shows you the result.
        </p>
        <p>
          For a business, the most useful setup is several agents working together, each with one
          job: one researches, one writes, one prepares the numbers, and one coordinates. That is
          what PerkOS calls an <Link href="/ai-teams-for-small-business" className="text-foreground underline underline-offset-4">AI team</Link>.
        </p>
        <KeyPoint>
          In short: an AI agent for business takes a goal, does the work in steps, and brings you a
          draft to approve.
        </KeyPoint>
      </ContentSection>

      <ContentSection title="What AI agents can do for a small business">
        <p>
          Most of the week in a small business goes to recurring work that matters but rarely needs
          the owner&apos;s full attention. That is where agents help first.
        </p>
        <FeatureGrid
          items={[
            { title: "Content and promotions", body: "Social posts, email newsletters, seasonal offers and event announcements written in your business voice." },
            { title: "Customer replies", body: "Answers to reviews and common questions, drafted from your own policies and details." },
            { title: "Research", body: "Competitor prices, local trends and market changes, summed up as a short brief with a recommendation." },
            { title: "Follow-ups", body: "Messages for leads, clients and suppliers, ready on time so nobody waits on you." },
            { title: "Documents and proposals", body: "Quotes, proposals, plans and checklists prepared from a few notes." },
            { title: "Numbers and reports", body: "Weekly summaries of sales, spending and results, in plain words." },
          ]}
        />
      </ContentSection>

      <ContentSection title="One agent or a team of agents?">
        <p>
          A single agent works well for one clear task. Real goals usually need several kinds of
          work at once, and that is where a team pays off.
        </p>
        <ComparisonTable
          caption="AI chat tool, single AI agent and AI agent team compared"
          columns={["", "AI chat tool", "Single AI agent", "AI agent team"]}
          rows={[
            ["How you start", "One prompt at a time", "One task", "One business goal"],
            ["Who plans the work", "You", "The agent", "A coordinator splits it into tasks"],
            ["Kinds of work", "Whatever you ask next", "One skill", "Research, writing, numbers and more, side by side"],
            ["What you get back", "A reply", "A result", "A set of finished drafts on one board"],
            ["Your role", "Writing prompts", "Checking one output", "Approving the work"],
          ]}
        />
      </ContentSection>

      <ContentSection title="How a team of AI agents works in PerkOS">
        <p>
          In PerkOS every team has a coordinator called Sparky and a few specialists chosen for your
          kind of business. The work is visible on a shared board from start to finish.
        </p>
        <Steps
          items={[
            { title: "You give one goal", body: "Write what you need in plain words, like you would to a colleague. One sentence is enough to start." },
            { title: "Sparky plans the work", body: "Sparky turns the goal into tasks on the team board and assigns each task to the right specialist." },
            { title: "The specialists draft it", body: "Research, writing and number work happen side by side. You can follow every task on the board as it moves." },
            { title: "You approve", body: "Each result comes back to you. Approve it, ask for changes or set it aside. Nothing goes out until you say so." },
          ]}
        />
        <p>
          Teams run in PerkOS Cloud, or on your own computers with{" "}
          <Link href="/runtime" className="text-foreground underline underline-offset-4">PerkOS Runtime</Link>.
        </p>
      </ContentSection>

      <ContentSection title="AI agents by type of business">
        <p>
          The same idea looks different in every business. PerkOS starts each team with work that
          fits the business, so the first goal already makes sense to it.
        </p>
        <FeatureGrid
          items={[
            { title: "Restaurants", body: "Promotions for quiet days, weekly posts, review replies and local price research." },
            { title: "Real estate", body: "Listing descriptions, buyer and seller follow-ups, and neighborhood briefs." },
            { title: "Online stores", body: "Product pages, campaign calendars and support replies grounded in store policies." },
            { title: "Agencies", body: "Client research, first drafts and status updates, so the team spends time on strategy." },
            { title: "Consulting", body: "Proposals and background research prepared while you are with clients." },
            { title: "Local services", body: "Quotes, reminders and posts that keep the calendar full." },
          ]}
        />
        <p>
          See the full examples for{" "}
          <Link href="/solutions/restaurants" className="text-foreground underline underline-offset-4">restaurants</Link>,{" "}
          <Link href="/solutions/real-estate" className="text-foreground underline underline-offset-4">real estate</Link>,{" "}
          <Link href="/solutions/ecommerce" className="text-foreground underline underline-offset-4">ecommerce</Link> and{" "}
          <Link href="/solutions/agencies" className="text-foreground underline underline-offset-4">agencies</Link>.
        </p>
      </ContentSection>

      <ContentSection title="How to choose AI agents for your business">
        <p>Before you pick a platform, check these six things.</p>
        <FeatureGrid
          items={[
            { title: "You approve the results", body: "Customer-facing work needs your judgment. Look for a clear approval step before anything is sent or published." },
            { title: "You can see the work", body: "A shared board shows what each agent is doing and why, so you always know where a goal stands." },
            { title: "It fits your kind of business", body: "Ready-made teams for your industry save hours of setup and give better first drafts." },
            { title: "Clear pricing", body: "Prefer plans with a fixed allowance and usage that pauses at zero over open-ended bills." },
            { title: "Your choice of AI provider", body: "Using your own AI provider, or prepaid credits, keeps costs under your control." },
            { title: "Open standards", body: "PerkOS supports x402 for agent payments in USDC and ERC-8004 for checking agent identity, so your agents can work with the wider agent ecosystem." },
          ]}
        />
      </ContentSection>

      <ContentSection title="Getting good results from AI agents">
        <p>
          AI agents do their best work with the same things a new employee needs: a clear goal,
          the right details and quick feedback.
        </p>
        <FeatureGrid
          items={[
            { title: "Give the result, not the steps", body: "Say what you want to see at the end, like \"ten posts for next week\". The team works out the steps." },
            { title: "Share your details once", body: "Your hours, prices, tone and policies make every draft more accurate from the first round." },
            { title: "Start with recurring work", body: "Weekly posts, review replies and follow-ups show results fast and repeat every week." },
            { title: "Review early drafts closely", body: "Specific feedback on the first rounds, like \"shorter\" or \"warmer\", shapes the drafts that follow." },
            { title: "Keep decisions with you", body: "Let agents prepare the options and the research. Prices, promises and anything sensitive stay your call." },
            { title: "Grow one goal at a time", body: "Add a new goal once the last one runs smoothly, and the team grows with your business." },
          ]}
        />
      </ContentSection>

      <ContentSection title="Start with AI agents in one afternoon">
        <Steps
          items={[
            { title: "Pick your business", body: "Choose a ready-made team for your industry, or build a custom one." },
            { title: "Write your first goal", body: "Start with something that repeats every week, like next week's posts or replies to recent reviews." },
            { title: "Review the first drafts", body: "Approve what is ready and ask for changes on the rest. Your feedback shapes the next round." },
            { title: "Add the next goal", body: "Once the first one runs smoothly, give the team the next piece of recurring work." },
          ]}
        />
        <p>
          PerkOS is free to start. See the plans on the{" "}
          <Link href="/pricing" className="text-foreground underline underline-offset-4">pricing page</Link>.
        </p>
      </ContentSection>

      <ContentSection title="Frequently asked questions">
        <FaqList items={FAQ} path={PATH} />
      </ContentSection>

      <ContentSection title="Keep reading">
        <RelatedPages
          links={[
            { href: "/ai-teams-for-small-business", title: "AI teams for small business", body: "How a small team of AI agents turns one goal into finished work." },
            { href: "/agentic-business", title: "What is an agentic business?", body: "What changes when AI agents handle the routine work and people make the calls." },
            { href: "/faq", title: "PerkOS FAQ", body: "Short answers about PerkOS, Sparky, pricing and the open standards behind it." },
          ]}
        />
      </ContentSection>
    </PublicPageShell>
  );
}
