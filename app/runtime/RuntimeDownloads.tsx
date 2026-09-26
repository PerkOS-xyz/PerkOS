"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { useSyncExternalStore } from "react";

import { buildFor, buildMeta, detectOs, type RuntimeBuild, type VisitorOs } from "./downloads";
import { PlatformGlyph } from "./PlatformGlyph";
import styles from "./RuntimeDownloads.module.css";

type Props = { builds: readonly RuntimeBuild[]; version: string };

type HintedNavigator = Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };

const subscribe = () => () => {};

function readOs(): VisitorOs {
  const nav = navigator as HintedNavigator;
  return detectOs({
    userAgent: nav.userAgent,
    platform: nav.userAgentData?.platform,
    mobile: nav.userAgentData?.mobile,
    touchPoints: nav.maxTouchPoints,
  });
}

/** The visitor's system. The server cannot know it, so the first paint treats it as unknown. */
function useVisitorOs(): VisitorOs {
  return useSyncExternalStore(subscribe, readOs, () => "unknown");
}

/** The main button: this computer's build when it is out, otherwise the way to all three. */
export function PrimaryDownload({ builds, version }: Props) {
  const os = useVisitorOs();
  const build = buildFor(os, builds);

  if (os === "mobile") {
    return (
      <>
        <a className={styles.pill} href="#download">
          See the platforms <ArrowDown aria-hidden className={`${styles.arrow} ${styles.arrowDown}`} />
        </a>
        <p className={styles.meta}>Runtime is a desktop app. Open this page on your computer to get it.</p>
      </>
    );
  }
  if (!build) {
    return (
      <a className={styles.pill} href="#download">
        Choose your platform <ArrowDown aria-hidden className={`${styles.arrow} ${styles.arrowDown}`} />
      </a>
    );
  }
  if (!build.url) {
    return (
      <>
        <span className={`${styles.pill} ${styles.pillSoon}`}>
          <span className={styles.dot} aria-hidden /> {build.name} build coming soon
        </span>
        <a className={styles.textLink} href="#download">
          All platforms
        </a>
      </>
    );
  }
  const meta = buildMeta(build, version);
  return (
    <>
      <a className={styles.pill} href={build.url}>
        Download for {build.name} <ArrowRight aria-hidden className={styles.arrow} />
      </a>
      <a className={styles.textLink} href="#download">
        Other platforms
      </a>
      {meta ? <p className={styles.meta}>{meta}</p> : null}
    </>
  );
}

/** One card per system, the visitor's own marked. */
export function PlatformRack({ builds, version }: Props) {
  const os = useVisitorOs();
  return (
    <div className={styles.rack}>
      {builds.map((build) => {
        const mine = build.os === os;
        const meta = build.url ? buildMeta(build, version) : "";
        return (
          <article key={build.os} className={mine ? `${styles.card} ${styles.cardMine}` : styles.card}>
            {mine ? <span className={styles.mine}>Your system</span> : null}
            <span className={styles.glyph}>
              <PlatformGlyph os={build.os} />
            </span>
            <div>
              <h3 className={styles.cardName}>{build.name}</h3>
              <p className={styles.status}>
                <span className={build.url ? `${styles.dot} ${styles.dotLive}` : styles.dot} aria-hidden />
                {build.url ? "Available" : "Coming soon"}
              </p>
            </div>
            {meta ? <p className={styles.detail}>{meta}</p> : null}
            <div className={styles.cardAction}>
              {build.url ? (
                <a className={styles.pill} href={build.url}>
                  Download for {build.name}
                </a>
              ) : (
                <span className={styles.soon}>Coming soon</span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
