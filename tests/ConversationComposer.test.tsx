import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../app/lib/useSpeechToText", () => ({
  useSpeechToText: () => ({
    supported: false,
    listening: false,
    interimText: "",
    error: null,
    toggle: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

import { ConversationComposer } from "../app/components/ConversationComposer";

describe("ConversationComposer image attach", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("hides attach until uploadFile is provided", () => {
    render(<ConversationComposer onSend={vi.fn()} autoFocus={false} />);
    expect(screen.queryByRole("button", { name: /attach image/i })).toBeNull();
  });

  it("sends image markdown so the agent gets the URL as context", async () => {
    const onSend = vi.fn();
    const uploadFile = vi.fn(async (file: File) => ({
      name: file.name,
      url: "https://cdn.example/photo.png",
      contentType: "image/png",
      isImage: true,
      size: file.size,
    }));
    render(
      <ConversationComposer
        onSend={onSend}
        uploadFile={uploadFile}
        autoFocus={false}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/*");

    const file = new File(["png"], "photo.png", { type: "image/png" });
    await userEvent.upload(input, file);
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("photo.png")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("![photo.png](https://cdn.example/photo.png)");
  });

  it("rejects non-image files", async () => {
    const uploadFile = vi.fn();
    render(
      <ConversationComposer
        onSend={vi.fn()}
        uploadFile={uploadFile}
        autoFocus={false}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["pdf"], "notes.pdf", { type: "application/pdf" });
    await userEvent.upload(input, pdf);
    expect(uploadFile).not.toHaveBeenCalled();
  });
});
