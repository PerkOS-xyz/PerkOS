import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFor, buildMeta, detectOs, RUNTIME_BUILDS, type RuntimeBuild } from "@/app/runtime/downloads";
import { PlatformRack, PrimaryDownload } from "@/app/runtime/RuntimeDownloads";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const UBUNTU = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const CHROMEBOOK = "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const SOON: RuntimeBuild[] = [
  { os: "macos", name: "macOS", url: "" },
  { os: "ubuntu", name: "Ubuntu", url: "" },
  { os: "windows", name: "Windows", url: "" },
];
const MAC_OUT: RuntimeBuild[] = [
  { os: "macos", name: "macOS", url: "https://downloads.example.com/PerkOS-Runtime.dmg", detail: "Apple Silicon · .dmg" },
  ...SOON.slice(1),
];

function visitWith(userAgent: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("detectOs", () => {
  it("names the three desktop systems from the user agent", () => {
    expect(detectOs({ userAgent: MAC })).toBe("macos");
    expect(detectOs({ userAgent: WINDOWS })).toBe("windows");
    expect(detectOs({ userAgent: UBUNTU })).toBe("ubuntu");
  });

  it("prefers the client hint when the browser sends one", () => {
    expect(detectOs({ userAgent: "Mozilla/5.0", platform: "Windows" })).toBe("windows");
    expect(detectOs({ userAgent: "Mozilla/5.0", platform: "macOS" })).toBe("macos");
    expect(detectOs({ userAgent: "Mozilla/5.0", platform: "Linux" })).toBe("ubuntu");
  });

  it("offers no build to phones, tablets and ChromeOS", () => {
    expect(detectOs({ userAgent: ANDROID })).toBe("mobile");
    expect(detectOs({ userAgent: IPHONE })).toBe("mobile");
    expect(detectOs({ userAgent: MAC, touchPoints: 5 })).toBe("mobile");
    expect(detectOs({ userAgent: WINDOWS, mobile: true })).toBe("mobile");
    expect(detectOs({ userAgent: CHROMEBOOK })).toBe("unknown");
    expect(detectOs({ userAgent: "" })).toBe("unknown");
  });
});

describe("Runtime builds", () => {
  it("lists macOS, Ubuntu and Windows, each link empty or https", () => {
    expect(RUNTIME_BUILDS.map((build) => build.os)).toEqual(["macos", "ubuntu", "windows"]);
    for (const build of RUNTIME_BUILDS) expect(build.url === "" || build.url.startsWith("https://")).toBe(true);
    expect(buildFor("unknown")).toBeUndefined();
  });

  it("describes a published build by its version and detail", () => {
    expect(buildMeta(MAC_OUT[0]!, "0.1.0")).toBe("Version 0.1.0 · Apple Silicon · .dmg");
    expect(buildMeta(SOON[1]!, "")).toBe("");
  });
});

describe("PrimaryDownload", () => {
  it("says the visitor's build is coming soon while it has no link, and offers nothing to download", () => {
    visitWith(MAC);
    render(<PrimaryDownload builds={SOON} version="" />);
    expect(screen.getByText(/macOS build coming soon/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Download for/ })).toBeNull();
    expect(screen.getByRole("link", { name: "All platforms" })).toHaveAttribute("href", "#download");
  });

  it("downloads the visitor's build once it has a link", () => {
    visitWith(MAC);
    render(<PrimaryDownload builds={MAC_OUT} version="0.1.0" />);
    expect(screen.getByRole("link", { name: /Download for macOS/ })).toHaveAttribute("href", MAC_OUT[0]!.url);
    expect(screen.getByText("Version 0.1.0 · Apple Silicon · .dmg")).toBeInTheDocument();
  });

  it("points a phone and an unknown system at the list", () => {
    visitWith(IPHONE);
    const { unmount } = render(<PrimaryDownload builds={MAC_OUT} version="" />);
    expect(screen.getByRole("link", { name: /See the platforms/ })).toHaveAttribute("href", "#download");
    expect(screen.getByText(/Runtime is a desktop app/)).toBeInTheDocument();
    unmount();

    visitWith(CHROMEBOOK);
    render(<PrimaryDownload builds={MAC_OUT} version="" />);
    expect(screen.getByRole("link", { name: /Choose your platform/ })).toHaveAttribute("href", "#download");
  });
});

describe("PlatformRack", () => {
  it("shows every system, marks the visitor's own and links only the published build", () => {
    visitWith(UBUNTU);
    render(<PlatformRack builds={MAC_OUT} version="" />);
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);

    const [mac, ubuntu, windows] = cards;
    expect(within(mac!).getByRole("link", { name: "Download for macOS" })).toHaveAttribute("href", MAC_OUT[0]!.url);
    expect(within(mac!).getByText("Available")).toBeInTheDocument();
    expect(within(ubuntu!).getByText("Your system")).toBeInTheDocument();
    expect(within(ubuntu!).queryByRole("link")).toBeNull();
    expect(within(windows!).getAllByText("Coming soon")).toHaveLength(2);
    expect(within(windows!).queryByText("Your system")).toBeNull();
  });
});
