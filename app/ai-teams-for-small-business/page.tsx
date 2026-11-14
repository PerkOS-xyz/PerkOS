import type { Metadata } from "next";
import Link from "next/link";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";
import { ComparisonTable, FaqList, KeyPoint, RelatedPages, Steps } from "../components/marketing/LongForm";
import { publicPageMetadata } from "../lib/publicPageMetadata";

const PATH = "/ai-teams-for-small-business";

export const metadata: Metadata = publicPageMetadata({
  title: "AI Teams for Small Business",
  description:
    "An AI team is a coordinator and specialist AI agents that turn one business goal into finished drafts. See how AI teams work in PerkOS, with you approving every result.",
  path: PATH,
});

const FAQ = [
  {
    q: "What is an AI team for a small business?",
    a: "An AI team is a coordinated group of AI agents. A team lead plans the work and assigns tasks, while specialist agents handle content, research and numbers. The owner approves each result.",
  },
  {
    q: "How is an AI team different from one AI assistant?",
    a: "One assistant handles one request at a time. An AI team takes a whole goal, splits it into tasks and works on them side by side, so you get a set of finished drafts instead of one answer.",
  },
  {
    q: "Who leads a PerkOS AI team?",
    a: "Sparky, the PerkOS coordinator. Sparky turns your goal into tasks on the team board, assigns each one to the right specialist and brings the results back to you.",
  },
  {
    q: "Does the AI team act without approval?",
    a: "Every result waits for your OK. PerkOS is built around draft and approve, so the business owner decides what is sent or published.",
  },
  {
    q: "Do I need technical experience to run an AI team?",
    a: "No. You choose a team made for your kind of business and describe goals in plain language. PerkOS handles the coordination behind the scenes.",
  },
  {
    q: "Where does my AI team run?",
    a: "In PerkOS Cloud, or on your own computers with PerkOS Runtime.",
  },
];

export default function AiTeamsPage() {
  return (
    <PublicPageShell
      eyebrow="AI teams for small business"
      title="An AI team for your small business: one goal in, finished work out."
      intro="PerkOS AI gives a small business a team of AI agents. A coordinator plans the work, specialists draft it, and you approve every result before anything goes out."
      ctaId="ai_teams"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "AI Teams for Small Business", path: PATH },
      ]}
    >
      <ContentSection title="What is an AI team?">
        <p>
          An AI team is a small group of AI agents that work together on one business goal. Each
          agent has one job, and a coordinator keeps them in step, the same way a good manager
          runs a small crew.
        </p>
        <p>
          In PerkOS the coordinator is Sparky. You give Sparky a goal, Sparky puts the tasks on a
          shared board and assigns them, and the specialists do the work side by side. When the
          drafts are ready, they come back to you for approval.
        </p>
        <KeyPoint>
          An AI team does what one AI assistant cannot: it takes a whole goal, splits it up, and
          hands back a set of finished drafts.
        </KeyPoint>
      </ContentSection>

      <ContentSection title="Who is on a PerkOS AI team">
        <FeatureGrid
          columns={2}
          items={[
            { title: "Sparky, the team lead", body: "Takes your goal, breaks it into a plan, hands out the work and checks everything before it reaches you." },
            { title: "Distribution Expert", body: "Drafts your posts, emails and promotions in your voice, so something good goes out every week." },
            { title: "Research teammate", body: "Looks into competitors, prices and trends, then hands you the short version you can act on." },
            { title: "Bookkeeping teammate", body: "Keeps your numbers tidy and flags what needs attention." },
          ]}
        />
        <p>
          Every team starts from a template for your kind of business, so the team already knows
          the work that fits it. You can add teammates and adjust the team as your business
          changes.
        </p>
      </ContentSection>

      <ContentSection title="What an AI team can handle in a week">
        <ComparisonTable
          caption="Examples of goals an AI team handles for a small business"
          columns={["Your goal", "What the team prepares", "What you do"]}
          rows={[
            ["Fill quiet weeknights", "A promotion, three posts and an email to regulars", "Approve or adjust"],
            ["Answer every review", "Replies to each new review, in your voice", "Read and approve"],
            ["Price the new menu or service", "A brief on local prices with a recommendation", "Decide"],
            ["Follow up with new leads", "A message for each lead, ready to send", "Approve and send"],
            ["Plan next month", "A calendar of content and offers", "Approve the plan"],
          ]}
        />
      </ContentSection>

      <ContentSection title="How an AI team works">
        <Steps
          items={[
            { title: "Pick your business", body: "Start with a team made for your industry, or create a custom one." },
            { title: "Give it a goal", body: "Write what you need the way you would say it to a colleague." },
            { title: "Watch the board", body: "Sparky plans the tasks and every task moves on the shared board as the team works." },
            { title: "Review the work", body: "Your team drafts and recommends. You approve, revise or set it aside." },
          ]}
        />
      </ContentSection>

      <ContentSection title="Why a team instead of one AI assistant">
        <p>
          Most AI tools give you one assistant and a blank box. You still plan the work, write every
          prompt and stitch the answers together. That works for a quick question, and it gets slow
          for a real goal like a monthly campaign or a week of follow-ups.
        </p>
        <p>
          A team takes the planning off your plate. Sparky decides who does what, the specialists
          work in parallel, and you see everything in one place. Your time goes to the part only you
          can do: deciding what is right for your business.
        </p>
        <p>
          Learn more in the guide to{" "}
          <Link href="/ai-agents-for-business" className="text-foreground underline underline-offset-4">AI agents for business</Link>.
        </p>
      </ContentSection>

      <ContentSection title="AI teams by industry">
        <p>
          PerkOS has ready-made AI teams for{" "}
          <Link href="/solutions/restaurants" className="text-foreground underline underline-offset-4">restaurants</Link>,{" "}
          <Link href="/solutions/real-estate" className="text-foreground underline underline-offset-4">real estate</Link>,{" "}
          <Link href="/solutions/ecommerce" className="text-foreground underline underline-offset-4">online stores</Link>,{" "}
          <Link href="/solutions/agencies" className="text-foreground underline underline-offset-4">agencies</Link>, consulting,
          health and wellness, coaching, trades, finance and local services. Each one starts with
          the work that matters most in that business.
        </p>
      </ContentSection>

      <ContentSection title="Frequently asked questions">
        <FaqList items={FAQ} path={PATH} />
      </ContentSection>

      <ContentSection title="Keep reading">
        <RelatedPages
          links={[
            { href: "/ai-agents-for-business", title: "AI agents for business", body: "What AI agents can do for a small business and how to choose them." },
            { href: "/agentic-business", title: "What is an agentic business?", body: "People decide, AI agents do the first draft, and every result waits for approval." },
            { href: "/pricing", title: "Pricing", body: "Free to start. Add capacity when the work proves its value." },
          ]}
        />
      </ContentSection>
    </PublicPageShell>
  );
}
