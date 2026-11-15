import type { Metadata } from "next";
import Link from "next/link";

import { ContentSection, FeatureGrid, PublicPageShell } from "../components/marketing/PublicPageShell";
import { ComparisonTable, FaqList, KeyPoint, RelatedPages, Steps } from "../components/marketing/LongForm";
import { publicPageMetadata } from "../lib/publicPageMetadata";

// ============================================================================
// /ai-employees: the page for "AI employees" and "AI workers". Defines the term
// honestly (software teammates that draft work for a person to approve), then
// shows how PerkOS gives a small business a team of them. Speaks only about
// PerkOS: comparisons with other products live on their own pages.
// ============================================================================

const PATH = "/ai-employees";

export const metadata: Metadata = publicPageMetadata({
  title: "AI Employees for Small Business",
  description:
    "What an AI employee is, what AI workers take off a small business owner's plate, and how to bring on a team of them with PerkOS while you approve the work.",
  path: PATH,
});

const FAQ = [
  {
    q: "What is an AI employee?",
    a: "An AI employee is an AI agent with a defined role, like research, content or bookkeeping, that takes tasks and hands back finished drafts. It works toward goals a person sets, and a person approves the results.",
  },
  {
    q: "What is the difference between AI employees and AI workers?",
    a: "They are two names for the same idea: AI agents that do a job's recurring work. \"AI workers\" is often used for single tasks, and \"AI employees\" for agents with a role on a team.",
  },
  {
    q: "Can AI employees replace staff in a small business?",
    a: "They take the first draft of recurring work, so people can spend their time on customers, decisions and the work only they can do. In PerkOS every result waits for a person's approval.",
  },
  {
    q: "How do I hire AI employees?",
    a: "With PerkOS you pick a team made for your kind of business, give it a goal in plain words, and approve the drafts. PerkOS is free to start, and you can add teammates as your business grows.",
  },
  {
    q: "How much do AI employees cost?",
    a: "PerkOS is free to start. Paid plans include a monthly allowance of PerkOS Infra hours, and you can use prepaid Managed AI credits or your own AI provider. Usage pauses at zero, so there are no surprise bills.",
  },
  {
    q: "Do AI employees work on their own?",
    a: "They work on their tasks without supervision and bring the results back to you. Nothing is sent or published until you approve it.",
  },
];

export default function AiEmployeesPage() {
  return (
    <PublicPageShell
      eyebrow="AI employees"
      title="AI employees for small business: a team that drafts, and you approve."
      intro="AI employees are AI agents with a role: research, content, numbers, follow-ups. PerkOS gives a small business a team of them, led by a coordinator, with every result waiting for your OK."
      ctaId="ai_employees"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "AI Employees", path: PATH },
      ]}
    >
      <ContentSection title="What is an AI employee?">
        <p>
          An AI employee is an AI agent with a clear role. Instead of answering one question at a
          time, it takes a task that belongs to its role, works through the steps and hands back a
          finished draft.
        </p>
        <p>
          You may also see them called AI workers or AI teammates. The idea is the same: software
          that does the recurring part of a job, so the people in the business can focus on the
          part that needs them.
        </p>
        <KeyPoint>
          An AI employee does the first draft of a job&apos;s recurring work. You keep the decisions
          and approve every result.
        </KeyPoint>
      </ContentSection>

      <ContentSection title="The AI employees on a PerkOS team">
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
          Each team starts from a template for your kind of business, and you can add teammates as
          the business grows. See the{" "}
          <Link href="/solutions" className="text-foreground underline underline-offset-4">teams by industry</Link>.
        </p>
      </ContentSection>

      <ContentSection title="AI employees, freelancers and software compared">
        <ComparisonTable
          caption="AI employees compared with freelancers and single-purpose software"
          columns={["", "Single-purpose software", "Freelancer", "PerkOS AI employees"]}
          rows={[
            ["What you hand over", "One job, inside its app", "A project", "A goal, split into tasks for the team"],
            ["Getting started", "Learn each tool", "Find, brief and schedule someone", "Pick a team template and write a goal"],
            ["Availability", "When you open it", "During their hours", "Whenever you give it work"],
            ["Covers", "One area", "Their specialty", "Content, research, numbers and follow-ups together"],
            ["Your role", "Do the work in the tool", "Review deliveries", "Approve the drafts"],
          ]}
        />
        <p>
          Many owners use all three: software for one job, a freelancer for specialist projects, and
          a team of AI employees for the recurring work in between.
        </p>
      </ContentSection>

      <ContentSection title="What AI employees can handle in a week">
        <ComparisonTable
          caption="Examples of work a team of AI employees prepares in a week"
          columns={["Your goal", "Who on the team", "What comes back"]}
          rows={[
            ["Fill quiet weeknights", "Distribution Expert", "An offer, three posts and an email to regulars"],
            ["Answer this week's reviews", "Distribution Expert", "A reply to every review, in your voice"],
            ["Check what competitors charge", "Research teammate", "A short price brief with a recommendation"],
            ["Close the month", "Bookkeeping teammate", "A summary of sales and spending, with what needs attention"],
            ["Plan next month", "Sparky", "A calendar of tasks for the whole team"],
          ]}
        />
      </ContentSection>

      <ContentSection title="How to bring on AI employees with PerkOS">
        <Steps
          items={[
            { title: "Pick your business", body: "Choose a ready-made team for your industry, or build a custom one." },
            { title: "Give the first goal", body: "Write what you need in plain words. Sparky turns it into tasks on the team board." },
            { title: "Approve the work", body: "Each draft comes back to you. Approve it, ask for changes or set it aside." },
            { title: "Grow the team", body: "Add the next goal, or a new teammate, as the first ones run smoothly." },
          ]}
        />
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
            { href: "/ai-for-small-business", title: "AI for small business", body: "Where AI helps a small business, the kinds of AI tools, and a 30-day plan to start." },
            { href: "/ai-teams-for-small-business", title: "AI teams for small business", body: "How a coordinated team turns one goal into finished work." },
            { href: "/ai-agents-for-business", title: "AI agents for business", body: "What AI agents can do for a small business and how to choose them." },
          ]}
        />
      </ContentSection>
    </PublicPageShell>
  );
}
