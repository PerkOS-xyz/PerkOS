import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentView } from "../app/components/DocumentView";
import "../app/lib/i18n";

const deliverable = [
  "## Week one posts",
  "",
  "### D1 Mon 10/5 · Teaser",
  "",
  "- **Instagram Reel**: cold brew pour in Seongsu",
  "- Hashtags: #서울카페 #ColdBrew",
  "",
  "| Day | Channel | Post |",
  "| --- | --- | --- |",
  "| Mon | Instagram | Teaser reel |",
  "| Tue | TikTok | Drip timelapse |",
].join("\n");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DocumentView", () => {
  it("renders an agent deliverable as a structured document", async () => {
    render(<DocumentView title="Agent result">{deliverable}</DocumentView>);
    expect(await screen.findByRole("heading", { level: 2, name: "Week one posts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: /D1 Mon/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(/#서울카페/)).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBeGreaterThanOrEqual(3);
  });

  it("copies the Markdown source", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<DocumentView title="Agent result">{deliverable}</DocumentView>);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(deliverable));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("downloads the source as a Markdown file named after the title", () => {
    const createObjectURL = vi.fn(() => "blob:doc");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<DocumentView title="Seoul Cold Brew Launch">{deliverable}</DocumentView>);
    fireEvent.click(screen.getByRole("button", { name: "Download .md" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("seoul-cold-brew-launch.md");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:doc");
    click.mockRestore();
  });

  it("opens a full-screen reading view with the same document", async () => {
    render(<DocumentView title="Agent result">{deliverable}</DocumentView>);
    fireEvent.click(screen.getByRole("button", { name: "Full screen" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Agent result");
    expect(dialog).toHaveTextContent("Week one posts");
  });

  it("can hide the toolbar for inline use", () => {
    render(<DocumentView title="Note" toolbar={false}>{deliverable}</DocumentView>);
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });
});
