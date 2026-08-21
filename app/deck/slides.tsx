"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Blocks,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Compass,
  Database,
  FileJson2,
  FileText,
  Fingerprint,
  Gauge,
  Globe2,
  Handshake,
  Layers3,
  Lightbulb,
  Link2,
  MessagesSquare,
  Network,
  Orbit,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { DECK_ROADMAP, DECK_SLIDE_TITLES, DECK_VERSION } from "./content";
import { useDeckCopy } from "./copy";

export const W = 1600;
export const H = 900;

const COLOR = {
  bg: "#08030d",
  panel: "#11091a",
  panel2: "#160d22",
  border: "#2a2038",
  fg: "#f7f3fb",
  muted: "#b9b1ca",
  dim: "#7d7391",
  pink: "#ec1b69",
  pinkSoft: "#ff8ab4",
  coral: "#ff665f",
  violet: "#9b87f5",
  green: "#54d6a1",
  amber: "#ffbd66",
};

function GlowGrid() {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black, transparent 92%)",
        }}
      />
      <div aria-hidden className="absolute -right-40 -top-48 h-[620px] w-[620px] rounded-full bg-[#ec1b69]/14 blur-[150px]" />
      <div aria-hidden className="absolute -bottom-64 -left-32 h-[600px] w-[600px] rounded-full bg-[#6541bd]/12 blur-[160px]" />
    </>
  );
}

function Frame({
  children,
  index,
  section,
  hideChrome = false,
}: {
  children: ReactNode;
  index: number;
  section?: string;
  hideChrome?: boolean;
}) {
  const { copy } = useDeckCopy();
  return (
    <section
      className="relative overflow-hidden text-[#f7f3fb]"
      style={{ width: W, height: H, background: COLOR.bg }}
      aria-label={`${copy.nav.deck} ${index}`}
    >
      <GlowGrid />
      <div className="relative z-10 flex h-full flex-col px-[92px] pb-[76px] pt-[72px]">
        {!hideChrome ? (
          <div className="mb-9 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image src="/perkos-header.png" alt="PerkOS" width={130} height={42} />
              {section ? (
                <span className="border-l border-white/15 pl-4 text-[17px] font-medium uppercase tracking-[0.16em] text-[#b9b1ca]">
                  {section}
                </span>
              ) : null}
            </div>
            <span className="font-mono text-[15px] text-[#7d7391]">
              {String(index).padStart(2, "0")} / {DECK_SLIDE_TITLES.length}
            </span>
          </div>
        ) : null}
        {children}
      </div>
      {!hideChrome ? (
        <div className="absolute inset-x-[92px] bottom-[30px] z-10 flex items-center justify-between text-[13px] text-[#7d7391]">
          <span>{copy.nav.overview} · {DECK_VERSION}</span>
          <span>perkos.xyz</span>
        </div>
      ) : null}
    </section>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-[16px] font-semibold uppercase tracking-[0.22em] text-[#ff8ab4]">
      <span className="h-[3px] w-11 rounded-full bg-[#ec1b69]" />
      {children}
    </div>
  );
}

function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`mt-5 max-w-[1320px] text-[58px] font-semibold leading-[1.08] tracking-[-0.035em] ${className}`}>
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[26px] border border-[#2a2038] bg-[#11091a]/90 ${className}`}>
      {children}
    </div>
  );
}

function IconBox({ Icon, tone = "pink" }: { Icon: LucideIcon; tone?: "pink" | "violet" | "green" | "amber" }) {
  const tones = {
    pink: "bg-[#ec1b69]/14 text-[#ff8ab4] border-[#ec1b69]/25",
    violet: "bg-[#9b87f5]/14 text-[#b5a8ff] border-[#9b87f5]/25",
    green: "bg-[#54d6a1]/14 text-[#72e7b8] border-[#54d6a1]/25",
    amber: "bg-[#ffbd66]/14 text-[#ffd093] border-[#ffbd66]/25",
  };
  return (
    <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border ${tones[tone]}`}>
      <Icon className="h-7 w-7" />
    </span>
  );
}

function Status({ children, future = false }: { children: ReactNode; future?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] ${
        future
          ? "border-[#9b87f5]/30 bg-[#9b87f5]/10 text-[#b5a8ff]"
          : "border-[#54d6a1]/30 bg-[#54d6a1]/10 text-[#72e7b8]"
      }`}
    >
      {future ? <Compass className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      {children}
    </span>
  );
}

function SlideHero() {
  const { copy } = useDeckCopy();
  const c = copy.hero;
  return (
    <Frame index={1} hideChrome>
      <Image
        src="/hero/sparky-hero-poster.jpg"
        alt=""
        fill
        priority
        sizes="1600px"
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#08030d] via-[#08030d]/92 to-transparent" />
      <div className="relative z-10 flex h-full max-w-[930px] flex-col justify-center">
        <div className="mb-14 flex items-center gap-5">
          <Image src="/perkos-header.png" alt="PerkOS" width={205} height={66} />
          <span className="border-l border-white/20 pl-5 text-[16px] font-medium uppercase tracking-[0.18em] text-white/60">
            {copy.nav.overview}
          </span>
        </div>
        <p className="mb-5 text-[17px] font-semibold uppercase tracking-[0.22em] text-[#ff8ab4]">
          {c.eyebrow}
        </p>
        <h1 className="text-[83px] font-semibold leading-[0.98] tracking-[-0.052em]">
          {c.title}
          <span className="block bg-gradient-to-r from-[#ff3f7f] to-[#ff7765] bg-clip-text text-transparent">
            {c.accent}
          </span>
        </h1>
        <p className="mt-8 max-w-[800px] text-[24px] leading-[1.55] text-[#d1c9de]">
          {c.copy}
        </p>
        <div className="mt-12 flex items-center gap-4 text-[15px] text-white/55">
          <span>{DECK_VERSION}</span>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <span>perkos.xyz</span>
        </div>
      </div>
    </Frame>
  );
}

function SlideProblem() {
  const { copy } = useDeckCopy();
  const c = copy.problem;
  const problemIcons = [Search, BrainCircuit, Workflow, Gauge];
  return (
    <Frame index={2} section={c.section}>
      <Kicker>{c.kicker}</Kicker>
      <Title>
        {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
      </Title>
      <p className="mt-5 max-w-[1120px] text-[22px] leading-[1.55] text-[#b9b1ca]">
        {c.intro}
      </p>
      <div className="mt-12 grid flex-1 grid-cols-4 gap-6">
        {c.items.map(([title, itemCopy], i) => {
          const Icon = problemIcons[i];
          return <Card key={title} className="flex flex-col p-7">
            <div className="flex items-center justify-between">
              <IconBox Icon={Icon} tone={i === 3 ? "amber" : i === 2 ? "violet" : "pink"} />
              <span className="font-mono text-[15px] text-[#625870]">0{i + 1}</span>
            </div>
            <h3 className="mt-7 text-[24px] font-semibold leading-[1.25]">{title}</h3>
            <p className="mt-4 text-[17px] leading-[1.6] text-[#a99fb9]">{itemCopy}</p>
          </Card>
        })}
      </div>
      <div className="mt-7 flex items-center gap-4 rounded-2xl border border-[#ec1b69]/25 bg-[#ec1b69]/8 px-7 py-5 text-[21px]">
        <Lightbulb className="h-6 w-6 text-[#ff8ab4]" />
        <span>{c.insight}</span>
      </div>
    </Frame>
  );
}

function SlideThesis() {
  const { copy } = useDeckCopy();
  const c = copy.thesis;
  const rails = [
    { Icon: Database, label: c.rails[0], x: "left-[85px]", y: "top-[150px]", tone: "violet" as const },
    { Icon: Users, label: c.rails[1], x: "right-[80px]", y: "top-[150px]", tone: "pink" as const },
    { Icon: ShieldCheck, label: c.rails[2], x: "left-[100px]", y: "bottom-[90px]", tone: "green" as const },
    { Icon: Activity, label: c.rails[3], x: "right-[60px]", y: "bottom-[90px]", tone: "amber" as const },
  ];
  return (
    <Frame index={3} section={c.section}>
      <div className="grid flex-1 grid-cols-[1.05fr_.95fr] items-center gap-16">
        <div>
          <Kicker>{c.kicker}</Kicker>
          <h2 className="mt-7 text-[69px] font-semibold leading-[1.06] tracking-[-0.045em]">
            {c.title}
            <span className="mt-3 block text-[#ff4f86]">{c.accent}</span>
          </h2>
          <p className="mt-8 max-w-[760px] text-[23px] leading-[1.6] text-[#b9b1ca]">
            {c.copy}
          </p>
        </div>
        <div className="relative h-[570px]">
          <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9b87f5]/18" />
          <div className="absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ec1b69]/24" />
          <div className="absolute left-1/2 top-1/2 grid h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[44px] border border-[#ec1b69]/50 bg-[#150a20] shadow-[0_0_90px_-18px_rgba(236,27,105,.8)]">
            <div className="text-center">
              <Image src="/logo.png" alt="PerkOS" width={72} height={72} className="mx-auto" />
              <p className="mt-3 text-[18px] font-semibold">{c.center}</p>
            </div>
          </div>
          {rails.map(({ Icon, label, x, y, tone }) => (
            <div key={label} className={`absolute ${x} ${y} flex w-[210px] items-center gap-3 rounded-2xl border border-[#2a2038] bg-[#11091a] p-4`}>
              <IconBox Icon={Icon} tone={tone} />
              <span className="text-[16px] font-medium leading-snug">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function SlideLoop() {
  const { copy } = useDeckCopy();
  const c = copy.loop;
  const stepIcons = [Search, FileJson2, Users, Workflow, RefreshCw];
  const steps = [
    ...c.steps.map(([title, sub], i) => ({ Icon: stepIcons[i], n: String(i + 1).padStart(2, "0"), title, sub })),
  ];
  return (
    <Frame index={4} section={c.section}>
      <Kicker>{c.kicker}</Kicker>
      <Title>
        {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
      </Title>
      <div className="mt-14 flex flex-1 items-stretch gap-3">
        {steps.map(({ Icon, n, title, sub }, i) => (
          <div key={title} className="flex flex-1 items-center gap-3">
            <Card className="flex h-full w-full flex-col p-6">
              <div className="flex items-center justify-between">
                <IconBox Icon={Icon} tone={i === 4 ? "green" : i === 1 ? "violet" : "pink"} />
                <span className="font-mono text-[14px] text-[#7d7391]">{n}</span>
              </div>
              <h3 className="mt-8 text-[28px] font-semibold">{title}</h3>
              <p className="mt-4 text-[16px] leading-[1.65] text-[#a99fb9]">{sub}</p>
              {i === 4 ? (
                <span className="mt-auto flex items-center gap-2 text-[14px] font-medium text-[#72e7b8]">
                  <RefreshCw className="h-4 w-4" /> {c.cycle}
                </span>
              ) : null}
            </Card>
            {i < steps.length - 1 ? <ArrowRight className="h-6 w-6 shrink-0 text-[#5f526d]" /> : null}
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-5">
        {c.principles.map(([title, itemCopy]) => (
          <div key={title} className="flex items-start gap-3 px-2 text-[16px]">
            <Check className="mt-1 h-5 w-5 shrink-0 text-[#54d6a1]" />
            <p><b>{title}.</b> <span className="text-[#a99fb9]">{itemCopy}</span></p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function SlideSurfaces() {
  const { copy } = useDeckCopy();
  const c = copy.surfaces;
  const surfaceIcons = [Compass, BriefcaseBusiness, Network];
  const surfaces = [
    ...c.items.map((item, i) => ({ ...item, Icon: surfaceIcons[i], tone: (["amber", "pink", "violet"] as const)[i] })),
  ];
  return (
    <Frame index={5} section={c.section}>
      <Kicker>{c.kicker}</Kicker>
      <Title>
        {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
      </Title>
      <div className="mt-12 grid flex-1 grid-cols-3 gap-7">
        {surfaces.map(({ Icon, label, title, copy, foot, tone }, i) => (
          <Card key={title} className="relative flex flex-col overflow-hidden p-8">
            <div aria-hidden className={`absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${i === 0 ? "bg-[#ffbd66]/10" : i === 1 ? "bg-[#ec1b69]/12" : "bg-[#9b87f5]/12"}`} />
            <div className="relative flex items-center justify-between">
              <IconBox Icon={Icon} tone={tone} />
              <span className="text-[13px] font-semibold tracking-[0.13em] text-[#7d7391]">{label}</span>
            </div>
            <h3 className="relative mt-9 text-[34px] font-semibold">{title}</h3>
            <p className="relative mt-5 text-[18px] leading-[1.62] text-[#b9b1ca]">{copy}</p>
            <div className="relative mt-auto border-t border-white/8 pt-6 text-[14px] leading-relaxed text-[#8e849f]">{foot}</div>
          </Card>
        ))}
      </div>
      <div className="mt-7 flex items-center justify-center gap-3 text-[17px] text-[#a99fb9]">
        <CircleDot className="h-5 w-5 text-[#ff8ab4]" />
        {c.summary}
      </div>
    </Frame>
  );
}

function SlideLive() {
  const { copy } = useDeckCopy();
  const c = copy.live;
  const liveIcons = [Compass, MessagesSquare, Link2, Database, BrainCircuit, FileText];
  const live = [
    ...c.items.map(([title, itemCopy], i) => ({ Icon: liveIcons[i], title, copy: itemCopy })),
  ];
  return (
    <Frame index={6} section={c.section}>
      <div className="flex items-end justify-between">
        <div>
          <Kicker>{c.kicker}</Kicker>
          <Title>
            {c.title} <span className="text-[#54d6a1]">{c.accent}</span>
          </Title>
        </div>
        <Status>{c.badge}</Status>
      </div>
      <p className="mt-4 max-w-[1060px] text-[20px] leading-[1.55] text-[#b9b1ca]">
        {c.intro}
      </p>
      <div className="mt-10 grid flex-1 grid-cols-3 gap-5">
        {live.map(({ Icon, title, copy }, i) => (
          <Card key={title} className="flex gap-5 p-6">
            <IconBox Icon={Icon} tone={i === 0 ? "amber" : i === 3 || i === 5 ? "violet" : i === 2 ? "green" : "pink"} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[21px] font-semibold">{title}</h3>
                <BadgeCheck className="h-4 w-4 text-[#54d6a1]" />
              </div>
              <p className="mt-3 text-[15px] leading-[1.58] text-[#a99fb9]">{copy}</p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-[14px] text-[#7d7391]">
        {c.note}
      </p>
    </Frame>
  );
}

function AgentChip({ name, runtime, tone }: { name: string; runtime: string; tone: "pink" | "violet" | "green" }) {
  const tones = {
    pink: "border-[#ec1b69]/30 bg-[#ec1b69]/10 text-[#ff8ab4]",
    violet: "border-[#9b87f5]/30 bg-[#9b87f5]/10 text-[#b5a8ff]",
    green: "border-[#54d6a1]/30 bg-[#54d6a1]/10 text-[#72e7b8]",
  };
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-full bg-black/25">
        <Bot className="h-5 w-5" />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#11091a] bg-[#54d6a1]" />
      </span>
      <span>
        <b className="block text-[15px] text-[#f7f3fb]">{name}</b>
        <span className="text-[11px] uppercase tracking-wider">{runtime}</span>
      </span>
    </div>
  );
}

function SlideProof() {
  const { copy } = useDeckCopy();
  const c = copy.proof;
  const proofIcons = [MessagesSquare, Database, ShieldCheck];
  return (
    <Frame index={7} section={c.section}>
      <Kicker>{c.kicker}</Kicker>
      <Title>
        {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
      </Title>
      <div className="mt-11 grid flex-1 grid-cols-[1.05fr_.95fr] gap-9">
        <Card className="flex flex-col p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold uppercase tracking-[.14em] text-[#7d7391]">{c.team}</p>
              <h3 className="mt-2 text-[27px] font-semibold">PerkOS Council</h3>
            </div>
            <Status>{c.connected}</Status>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3">
            <AgentChip name="PerkOS" runtime={c.roles[0]} tone="pink" />
            <AgentChip name="Alice" runtime={c.roles[1]} tone="violet" />
            <AgentChip name="Bragi" runtime={c.roles[2]} tone="violet" />
            <AgentChip name="Athena" runtime={c.roles[3]} tone="green" />
            <AgentChip name="Mimir" runtime={c.roles[4]} tone="violet" />
            <AgentChip name="Tyr + Idunn" runtime={c.roles[5]} tone="violet" />
          </div>
          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/[.035] px-5 py-4 text-[15px] text-[#b9b1ca]">
            <Fingerprint className="h-5 w-5 text-[#ff8ab4]" />
            {c.model}
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          {c.items.map(([title, itemCopy], i) => {
            const Icon = proofIcons[i];
            return (
            <Card key={title} className="flex flex-1 items-center gap-5 p-6">
              <IconBox Icon={Icon} tone={i === 2 ? "green" : i === 1 ? "violet" : "pink"} />
              <div>
                <h3 className="text-[21px] font-semibold">{title}</h3>
                <p className="mt-2 text-[15px] leading-[1.55] text-[#a99fb9]">{itemCopy}</p>
              </div>
            </Card>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}

function SlideBusinessModel() {
  const { copy } = useDeckCopy();
  const c = copy.business;
  const phaseIcons = [Compass, Blocks, Activity, Network];
  const phases = [
    ...c.phases.map(([label, title, itemCopy], i) => ({ Icon: phaseIcons[i], label, title, copy: itemCopy })),
  ];
  return (
    <Frame index={8} section={c.section}>
      <Kicker>{c.kicker}</Kicker>
      <Title>
        {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
      </Title>
      <p className="mt-5 max-w-[1130px] text-[21px] leading-[1.55] text-[#b9b1ca]">
        {c.intro}
      </p>
      <div className="mt-12 flex flex-1 items-stretch gap-4">
        {phases.map(({ Icon, label, title, copy }, i) => (
          <div key={title} className="flex flex-1 items-center gap-4">
            <Card className="flex h-full w-full flex-col p-7">
              <div className="flex items-center justify-between">
                <IconBox Icon={Icon} tone={i === 3 ? "green" : i === 0 ? "amber" : i === 2 ? "violet" : "pink"} />
                <span className="text-[12px] font-semibold tracking-[.15em] text-[#7d7391]">{label}</span>
              </div>
              <h3 className="mt-7 text-[29px] font-semibold">{title}</h3>
              <p className="mt-4 text-[16px] leading-[1.62] text-[#a99fb9]">{copy}</p>
            </Card>
            {i < phases.length - 1 ? <ArrowRight className="h-6 w-6 shrink-0 text-[#5f526d]" /> : null}
          </div>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-3 gap-5 text-center text-[15px]">
        {c.revenues.map((itemCopy) => (
          <div key={itemCopy} className="rounded-2xl border border-[#2a2038] bg-white/[.025] px-5 py-4 text-[#b9b1ca]">{itemCopy}</div>
        ))}
      </div>
    </Frame>
  );
}

function SlideGTM() {
  const { copy } = useDeckCopy();
  const c = copy.gtm;
  const stages = [
    ...c.stages.map(([title, itemCopy], i) => ({ n: String(i + 1).padStart(2, "0"), title, copy: itemCopy })),
  ];
  return (
    <Frame index={9} section={c.section}>
      <Kicker>{c.kicker}</Kicker>
      <Title>
        {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
      </Title>
      <div className="mt-12 grid flex-1 grid-cols-[.8fr_1.2fr] gap-8">
        <Card className="relative flex flex-col overflow-hidden p-8">
          <div aria-hidden className="absolute -right-10 -top-20 h-72 w-72 rounded-full bg-[#ec1b69]/12 blur-[80px]" />
          <Target className="relative h-14 w-14 text-[#ff8ab4]" />
          <p className="relative mt-8 text-[29px] font-semibold leading-[1.3]">{c.wedgeTitle}</p>
          <p className="relative mt-5 text-[19px] leading-[1.65] text-[#b9b1ca]">
            {c.wedge}
          </p>
          <div className="relative mt-auto rounded-2xl border border-[#ec1b69]/25 bg-[#ec1b69]/8 p-5 text-[16px] leading-relaxed text-[#d8cfdf]">
            {c.grow}
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-5">
          {stages.map(({ n, title, copy }) => (
            <Card key={title} className="p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[15px] text-[#ff8ab4]">{n}</span>
                <ArrowDown className="h-5 w-5 text-[#5f526d]" />
              </div>
              <h3 className="mt-5 text-[24px] font-semibold">{title}</h3>
              <p className="mt-3 text-[16px] leading-[1.58] text-[#a99fb9]">{copy}</p>
            </Card>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function SlideMoat() {
  const { copy } = useDeckCopy();
  const c = copy.moat;
  const layerIcons = [ClipboardCheck, FileJson2, Database, Link2, Fingerprint];
  const layers = [
    ...c.layers.map(([title, itemCopy], i) => ({ Icon: layerIcons[i], title, copy: itemCopy })),
  ];
  return (
    <Frame index={10} section={c.section}>
      <Kicker>{c.kicker}</Kicker>
      <Title>
        {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
      </Title>
      <p className="mt-5 max-w-[1100px] text-[21px] leading-[1.55] text-[#b9b1ca]">
        {c.intro}
      </p>
      <div className="mt-10 flex flex-1 items-stretch gap-3">
        {layers.map(({ Icon, title, copy }, i) => (
          <div key={title} className="flex flex-1 items-center gap-3">
            <Card className="flex h-full w-full flex-col p-6">
              <IconBox Icon={Icon} tone={i === 4 ? "green" : i === 2 || i === 3 ? "violet" : "pink"} />
              <h3 className="mt-7 text-[23px] font-semibold leading-snug">{title}</h3>
              <p className="mt-4 text-[15px] leading-[1.6] text-[#a99fb9]">{copy}</p>
              <span className="mt-auto font-mono text-[13px] text-[#625870]">{c.layer} {i + 1}</span>
            </Card>
            {i < layers.length - 1 ? <span className="h-px w-4 shrink-0 bg-[#4b3c58]" /> : null}
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between rounded-2xl border border-[#9b87f5]/25 bg-[#9b87f5]/8 px-7 py-5">
        <div className="flex items-center gap-4">
          <Orbit className="h-6 w-6 text-[#b5a8ff]" />
          <span className="text-[18px]">{c.flywheel}</span>
        </div>
        <span className="text-[14px] font-semibold uppercase tracking-[.15em] text-[#b5a8ff]">{c.compound}</span>
      </div>
    </Frame>
  );
}

function SlideRoadmap() {
  const { copy, language } = useDeckCopy();
  const c = copy.roadmap;
  const horizons = {
    en: ["1 month", "3 months", "6 months", "12 months"],
    es: ["1 mes", "3 meses", "6 meses", "12 meses"],
    fr: ["1 mois", "3 mois", "6 mois", "12 mois"],
    pt: ["1 mês", "3 meses", "6 meses", "12 meses"],
    ja: ["1か月", "3か月", "6か月", "12か月"],
    ko: ["1개월", "3개월", "6개월", "12개월"],
  }[language];
  return (
    <Frame index={11} section={c.section}>
      <div className="flex items-end justify-between">
        <div>
          <Kicker>{c.kicker}</Kicker>
          <Title>
            {c.title} <span className="text-[#ff4f86]">{c.accent}</span>
          </Title>
        </div>
        <Status future>{c.badge}</Status>
      </div>
      <p className="mt-4 max-w-[1120px] text-[19px] leading-[1.55] text-[#b9b1ca]">
        {c.intro}
      </p>
      <div className="relative mt-11 grid flex-1 grid-cols-4 gap-5">
        <div aria-hidden className="absolute left-[12%] right-[12%] top-[42px] h-px bg-gradient-to-r from-[#ec1b69] via-[#9b87f5] to-[#54d6a1]" />
        {DECK_ROADMAP.map((_, i) => (
          <div key={horizons[i]} className="relative flex flex-col pt-[72px]">
            <span className={`absolute left-7 top-[29px] z-10 h-7 w-7 rounded-full border-[7px] border-[#08030d] ${i === 3 ? "bg-[#54d6a1]" : i > 0 ? "bg-[#9b87f5]" : "bg-[#ec1b69]"}`} />
            <Card className="flex h-full flex-col p-6">
              <span className="text-[14px] font-semibold uppercase tracking-[.14em] text-[#ff8ab4]">{horizons[i]}</span>
              <h3 className="mt-3 min-h-[64px] text-[23px] font-semibold leading-[1.28]">{c.focuses[i]}</h3>
              <ul className="mt-5 flex flex-col gap-3 border-t border-white/8 pt-5">
                {c.details[i].map((item) => (
                  <li key={item} className="flex gap-2.5 text-[14px] leading-[1.45] text-[#a99fb9]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#72e7b8]" /> {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function SlideClose() {
  const { copy } = useDeckCopy();
  const c = copy.close;
  return (
    <Frame index={12} hideChrome>
      <Image src="/hero/sparky-hero-poster.jpg" alt="" fill sizes="1600px" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#08030d] via-[#08030d]/95 to-[#08030d]/20" />
      <div className="relative z-10 flex h-full max-w-[970px] flex-col justify-center">
        <Image src="/perkos-header.png" alt="PerkOS" width={190} height={61} />
        <p className="mt-16 text-[17px] font-semibold uppercase tracking-[.22em] text-[#ff8ab4]">{c.kicker}</p>
        <h2 className="mt-6 text-[79px] font-semibold leading-[1.02] tracking-[-0.05em]">
          {c.title}
          <span className="block text-[#ff4f86]">{c.accent}</span>
        </h2>
        <p className="mt-8 max-w-[830px] text-[23px] leading-[1.6] text-[#d1c9de]">
          {c.copy}
        </p>
        <div className="mt-12 flex items-center gap-5">
          <a href="https://perkos.xyz" className="inline-flex items-center gap-3 rounded-full bg-[#ec1b69] px-7 py-4 text-[17px] font-semibold text-white">
            {c.explore} <ArrowRight className="h-5 w-5" />
          </a>
          <a href="mailto:julio.cruz@perkos.xyz" className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-black/20 px-7 py-4 text-[17px] font-medium text-white/80">
            julio.cruz@perkos.xyz
          </a>
        </div>
        <div className="mt-12 flex items-center gap-7 text-[15px] text-white/55">
          <span className="flex items-center gap-2"><Handshake className="h-4 w-4" /> {c.partners[0]}</span>
          <span className="flex items-center gap-2"><Globe2 className="h-4 w-4" /> {c.partners[1]}</span>
          <span className="flex items-center gap-2"><Layers3 className="h-4 w-4" /> {c.partners[2]}</span>
        </div>
      </div>
    </Frame>
  );
}

export type DeckSlide = {
  hash: string;
  title: string;
  Component: () => ReactNode;
};

export const DECK_SLIDES: DeckSlide[] = [
  { hash: "vision", title: DECK_SLIDE_TITLES[0], Component: SlideHero },
  { hash: "problem", title: DECK_SLIDE_TITLES[1], Component: SlideProblem },
  { hash: "thesis", title: DECK_SLIDE_TITLES[2], Component: SlideThesis },
  { hash: "loop", title: DECK_SLIDE_TITLES[3], Component: SlideLoop },
  { hash: "surfaces", title: DECK_SLIDE_TITLES[4], Component: SlideSurfaces },
  { hash: "live", title: DECK_SLIDE_TITLES[5], Component: SlideLive },
  { hash: "proof", title: DECK_SLIDE_TITLES[6], Component: SlideProof },
  { hash: "business-model", title: DECK_SLIDE_TITLES[7], Component: SlideBusinessModel },
  { hash: "go-to-market", title: DECK_SLIDE_TITLES[8], Component: SlideGTM },
  { hash: "moat", title: DECK_SLIDE_TITLES[9], Component: SlideMoat },
  { hash: "roadmap", title: DECK_SLIDE_TITLES[10], Component: SlideRoadmap },
  { hash: "close", title: DECK_SLIDE_TITLES[11], Component: SlideClose },
];
