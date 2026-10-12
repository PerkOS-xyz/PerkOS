import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Check, FileText, ShieldCheck, Sparkles, Timer } from "lucide-react";

export const metadata: Metadata = {
  title: "Creators | PerkOS",
  description: "Turn confirmed project progress into editable community updates with a PerkOS AI companion. You review the draft and decide what to share.",
  alternates: { canonical: "/creators" },
};

const steps = [
  { title: "Bring your project", copy: "Add your project description, a website or portfolio link, and the language you write in. Each project keeps its own context." },
  { title: "Share real progress", copy: "Tell your companion what you can confirm. Writing examples guide the tone; they do not become new facts or permission to publish." },
  { title: "Review your update", copy: "Hermes prepares an editable draft. Check the facts, make it sound like you, and decide what to share with your community." },
];
const controls = [
  { Icon: FileText, title: "Drafts, not automatic posts", copy: "Review and approval stay with you. Approving a writing example does not publish content or connect a social account." },
  { Icon: Timer, title: "Work when you need it", copy: "The creator workflow runs on demand. Where enabled, a confirmed one-time schedule or a signed event can request a draft." },
  { Icon: ShieldCheck, title: "Keep usage controlled", copy: "Managed execution requires permission and an available budget. Access and limits depend on your account and the enabled features." },
];

export default function CreatorsPage() {
  return <div className="flex min-h-screen flex-col bg-background text-foreground">
    <header className="border-b border-border">
      <nav aria-label="Creators navigation" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="PerkOS home"><Image src="/perkos-header.png" alt="PerkOS" width={130} height={28} priority /></Link>
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft aria-hidden="true" className="size-4" />Back to PerkOS</Link>
      </nav>
    </header>
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 md:px-8 md:py-20">
      <section className="max-w-3xl space-y-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary"><Sparkles aria-hidden="true" className="size-4" />PerkOS Creators</p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">Real progress. Updates in your own voice.</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">A companion for creators and founders who want to explain what they are building. Bring confirmed project notes, get an editable community update, and keep the final say.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-in" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">Open PerkOS<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
          <Link href="https://github.com/PerkOS-xyz" className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 py-3 font-medium">Explore the open-source code</Link>
        </div>
        <p className="text-sm text-muted-foreground">Use the Creators Update project template where enabled. Initial configuration does not start compute or authorize spending.</p>
      </section>
      <section aria-labelledby="creators-how" className="mt-16 space-y-6">
        <h2 id="creators-how" className="text-2xl font-semibold">From project notes to a community update</h2>
        <div className="grid gap-4 md:grid-cols-3">{steps.map((step, index) => <article key={step.title} className="rounded-xl border border-border p-6">
          <span className="mb-4 grid size-9 place-items-center rounded-full bg-primary/10 text-primary">{index + 1}</span>
          <h3 className="text-lg font-semibold">{step.title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{step.copy}</p>
        </article>)}</div>
      </section>
      <section aria-labelledby="creators-control" className="mt-16 space-y-6">
        <h2 id="creators-control" className="text-2xl font-semibold">You stay in control</h2>
        <div className="grid gap-4 md:grid-cols-3">{controls.map(({ Icon, title, copy }) => <article key={title} className="rounded-xl border border-primary/20 bg-primary/5 p-6">
          <Icon aria-hidden="true" className="mb-4 size-6 text-primary" /><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{copy}</p>
        </article>)}</div>
        <p className="inline-flex items-start gap-2 text-sm text-muted-foreground"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />A writing companion, not a funding platform. PerkOS does not promise funding, audience growth or fundraising results.</p>
      </section>
    </main>
    <footer className="border-t border-border px-5 py-6 text-center text-sm text-muted-foreground">Creators by PerkOS. Your project, your voice, your decision.</footer>
  </div>;
}
