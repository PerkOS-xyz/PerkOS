/**
 * The PerkOS Runtime builds that /runtime offers, and which one fits the
 * visitor's computer.
 *
 * A release only needs its link filled in here. A build without a url shows as
 * coming soon, on its card and on the main button when it is the visitor's own
 * system, so the page never offers a download that does not exist yet.
 */

export type RuntimeOs = "macos" | "ubuntu" | "windows";

/** What the visitor is on: one of the three, a phone or tablet, or a system with no build. */
export type VisitorOs = RuntimeOs | "mobile" | "unknown";

export type RuntimeBuild = {
  os: RuntimeOs;
  /** The system, as the card and the button name it. */
  name: string;
  /** The installer itself. Empty until the build is published. */
  url: string;
  /** One line under the name once the build is out, for example "Apple Silicon · .dmg · 140 MB". */
  detail?: string;
};

/** Shown next to the download once set, for example "0.1.0". */
export const RUNTIME_VERSION = "";

export const RUNTIME_BUILDS: readonly RuntimeBuild[] = [
  { os: "macos", name: "macOS", url: "" },
  { os: "ubuntu", name: "Ubuntu", url: "" },
  { os: "windows", name: "Windows", url: "" },
];

export const RUNTIME_SOURCE = "https://github.com/PerkOS-xyz/PerkOS-Runtime";

type Signals = {
  userAgent?: string;
  /** `navigator.userAgentData.platform`, where the browser offers client hints. */
  platform?: string;
  /** `navigator.userAgentData.mobile`. */
  mobile?: boolean;
  /** `navigator.maxTouchPoints`. */
  touchPoints?: number;
};

/**
 * The visitor's system, from the user agent and, where the browser offers
 * them, its client hints. Phones and tablets get no build: Runtime is a
 * desktop app. Any other Linux is offered the Ubuntu build, and ChromeOS none.
 */
export function detectOs({ userAgent = "", platform = "", mobile = false, touchPoints = 0 }: Signals): VisitorOs {
  const ua = userAgent.toLowerCase();
  const hint = platform.toLowerCase();
  if (mobile || /android|iphone|ipad|ipod|mobile/.test(ua)) return "mobile";
  if (/cros|chrome os|chromium os/.test(`${ua} ${hint}`)) return "unknown";
  if (hint.includes("mac") || ua.includes("macintosh")) {
    // iPadOS asks for the desktop site with a Mac user agent; only the touch screen gives it away.
    return touchPoints > 1 ? "mobile" : "macos";
  }
  if (hint.includes("win") || ua.includes("windows")) return "windows";
  if (hint.includes("linux") || ua.includes("linux") || ua.includes("x11")) return "ubuntu";
  return "unknown";
}

export function buildFor(os: VisitorOs, builds: readonly RuntimeBuild[] = RUNTIME_BUILDS): RuntimeBuild | undefined {
  return builds.find((build) => build.os === os);
}

/** The line under a published build: its version and its detail, when set. */
export function buildMeta(build: RuntimeBuild, version: string = RUNTIME_VERSION): string {
  return [version && `Version ${version}`, build.detail].filter(Boolean).join(" · ");
}
