import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";

import { RUNTIME_BUILDS, RUNTIME_SOURCE, RUNTIME_VERSION } from "./downloads";
import { PlatformRack, PrimaryDownload } from "./RuntimeDownloads";
import styles from "./runtime.module.css";

/**
 * /runtime: download page for PerkOS Runtime, the desktop app where desks run.
 *
 * It wears the app's own look (night studio, ember light, Sparky) instead of
 * the shell of the other public pages, so the page and the app someone
 * downloads from it look like one thing. The links live in downloads.ts, and a
 * system without one says coming soon.
 */

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--rt-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--rt-mono" });

const DESCRIPTION =
  "Download PerkOS Runtime for macOS, Ubuntu and Windows. Sparky answers your questions and opens the right desk, each desk brings its own team of agents, and your wallet signs.";

export const metadata: Metadata = {
  title: "PerkOS Runtime",
  description: DESCRIPTION,
  alternates: { canonical: "/runtime" },
  openGraph: {
    type: "website",
    siteName: "PerkOS AI",
    title: "PerkOS Runtime",
    description: DESCRIPTION,
    url: "/runtime",
    images: [{ url: "/runtime/og.jpg", width: 1200, height: 600, alt: "Sparky with the agents of a desk" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@perk_os",
    creator: "@perk_os",
    title: "PerkOS Runtime",
    description: DESCRIPTION,
    images: ["/runtime/og.jpg"],
  },
};

const CHECKS = ["Your wallet signs, nobody else", "Your model: Grok, Claude, ChatGPT or local", "They draft. You approve."];

const FEATURES = [
  {
    title: "Sparky, first",
    body: "Ask anything. Sparky answers, explains what each desk does and opens the one that fits what you want.",
  },
  {
    title: "Your wallet signs",
    body: "Sign in with the wallet you already use. The signature proves it is yours and spends nothing. Desks draft, you approve, and a desk acts on its own only from a wallet you delegate, inside limits you set.",
  },
  {
    title: "Your model, your call",
    body: "Grok, Claude or ChatGPT, a model on your own machine with Ollama or LM Studio, or PerkOS LLM when your wallet has access.",
  },
  {
    title: "Memory that stays home",
    body: "Sparky's notes are encrypted on your computer, under a key that comes from your wallet's signature.",
  },
];

const STEPS = [
  { title: "Download and open", body: "Get Runtime for your system and open it like any other app." },
  { title: "Connect your wallet", body: "Pick your wallet and sign once. It proves the wallet is yours; nothing is spent." },
  { title: "Choose a model, meet Sparky", body: "Pick the model Sparky thinks with, then say what you want to do. Sparky opens the right desk." },
];

/** Order in the opening reveal. */
const step = (i: number) => ({ "--i": i }) as CSSProperties;

export default function RuntimePage() {
  return (
    <div className={`${styles.page} ${display.variable} ${mono.variable}`}>
      <div className={styles.wrap}>
        <header className={styles.bar}>
          <Link href="/" aria-label="PerkOS home" className={styles.logo}>
            <Image src="/perkos-header.png" alt="PerkOS" width={120} height={41} loading="eager" />
          </Link>
          <nav className={styles.barLinks} aria-label="PerkOS Runtime">
            <a className={`${styles.ghost} ${styles.ghostSource}`} href={RUNTIME_SOURCE}>
              Source code <ArrowUpRight aria-hidden className={styles.icon} />
            </a>
            <a className={`${styles.ghost} ${styles.ghostLit}`} href="#download">
              Download
            </a>
          </nav>
        </header>

        <main>
          <section className={styles.hero}>
            <div>
              <p className={`${styles.kicker} ${styles.rise}`} style={step(0)}>
                PerkOS Runtime <span>macOS · Ubuntu · Windows</span>
              </p>
              <h1 className={`${styles.title} ${styles.rise}`} style={step(1)}>
                Your desks,
                <span>on your desktop.</span>
              </h1>
              <p className={`${styles.lede} ${styles.rise}`} style={step(2)}>
                Runtime is the PerkOS app where desks run. Sparky answers your questions and opens the right desk.
                Each desk brings its own team of agents, its own market and its own screens.
              </p>
              <div className={`${styles.cta} ${styles.rise}`} style={step(3)}>
                <PrimaryDownload builds={RUNTIME_BUILDS} version={RUNTIME_VERSION} />
              </div>
              <ul className={`${styles.checks} ${styles.rise}`} style={step(4)}>
                {CHECKS.map((check) => (
                  <li key={check}>
                    <Check aria-hidden className={styles.icon} />
                    {check}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.stage}>
              <div className={styles.glow} aria-hidden />
              <div className={styles.rings} aria-hidden />
              <Image
                className={styles.sparky}
                src="/runtime/sparky-samurai.webp"
                alt="Sparky, who welcomes you in PerkOS Runtime"
                width={720}
                height={1092}
                sizes="(max-width: 960px) 64vw, 440px"
                loading="eager"
                fetchPriority="high"
              />
              <p className={styles.bubble}>
                Hi, I&rsquo;m Sparky. <span>Let&rsquo;s find your desk.</span>
              </p>
            </div>
          </section>

          <section id="download" className={styles.section}>
            <div className={styles.head}>
              <p className={styles.kicker}>Download</p>
              <h2 className={styles.h2}>Pick your platform.</h2>
              <p className={styles.sub}>One app for macOS, Ubuntu and Windows, with the same desks and the same Sparky on each.</p>
            </div>
            <PlatformRack builds={RUNTIME_BUILDS} version={RUNTIME_VERSION} />
          </section>

          <section className={`${styles.section} ${styles.team}`}>
            <Image
              className={styles.teamArt}
              src="/runtime/sparky-team.webp"
              alt="Sparky with the agents of a desk"
              width={1600}
              height={800}
              sizes="(max-width: 1180px) 100vw, 1180px"
            />
            <div className={styles.teamCopy}>
              <p className={styles.kicker}>Desks</p>
              <h2 className={styles.h2}>Every desk brings its own team.</h2>
              <p className={styles.sub}>
                Scout reads the market, Risk sizes the order and can stop it, Trader drafts it and Auditor keeps the
                record. Sparky tells you what they found, and you decide what happens next.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.head}>
              <p className={styles.kicker}>Inside</p>
              <h2 className={styles.h2}>Yours, end to end.</h2>
            </div>
            <div className={styles.features}>
              {FEATURES.map((feature, i) => (
                <article key={feature.title} className={styles.feature}>
                  <span className={styles.index}>0{i + 1}</span>
                  <h3 className={styles.featureTitle}>{feature.title}</h3>
                  <p className={styles.featureBody}>{feature.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.head}>
              <p className={styles.kicker}>Start</p>
              <h2 className={styles.h2}>Up and running in three steps.</h2>
            </div>
            <ol className={styles.steps}>
              {STEPS.map((item) => (
                <li key={item.title} className={styles.step}>
                  <h3 className={styles.stepTitle}>{item.title}</h3>
                  <p className={styles.stepBody}>{item.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.final}>
            <Image className={styles.face} src="/runtime/sparky-head.webp" alt="" width={256} height={256} />
            <h2 className={styles.h2}>Sparky is ready when you are.</h2>
            <div className={styles.cta}>
              <PrimaryDownload builds={RUNTIME_BUILDS} version={RUNTIME_VERSION} />
            </div>
          </section>
        </main>

        <footer className={styles.foot}>
          <p>© {new Date().getFullYear()} PerkOS AI. The Runtime code is open source under the MIT license.</p>
          <nav aria-label="Footer">
            <Link href="/">Home</Link>
            <Link href="/floor">Floor</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={RUNTIME_SOURCE}>GitHub</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
