import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
}));

// Default mock: speech not supported, so the send button is always visible.
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

import { ChatComposer } from "../app/components/ChatComposer";

function setup(overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}) {
  const onChange = vi.fn();
  const onSend = vi.fn();
  const onClear = vi.fn();
  const props = {
    value: "",
    onChange,
    onSend,
    onClear,
    ...overrides,
  };
  const utils = render(<ChatComposer {...props} />);
  return { ...utils, onChange, onSend, onClear, props };
}

describe("ChatComposer slash menu", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("hides the slash menu when input doesn't start with /", () => {
    setup({ value: "hello" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows all commands when input is just /", () => {
    setup({ value: "/" });
    const listbox = screen.getByRole("listbox", { name: /slash commands/i });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByText("/task")).toBeInTheDocument();
    expect(screen.getByText("/project")).toBeInTheDocument();
    expect(screen.getByText("/agent")).toBeInTheDocument();
    expect(screen.getByText("/perkos")).toBeInTheDocument();
    expect(screen.getByText("/clear")).toBeInTheDocument();
  });

  it("filters commands by prefix", () => {
    setup({ value: "/p" });
    expect(screen.getByText("/project")).toBeInTheDocument();
    expect(screen.getByText("/perkos")).toBeInTheDocument();
    expect(screen.queryByText("/task")).toBeNull();
    expect(screen.queryByText("/agent")).toBeNull();
    expect(screen.queryByText("/clear")).toBeNull();
  });

  it("invokes router.push on a navigable command click", async () => {
    const { onChange } = setup({ value: "/task" });
    await userEvent.click(screen.getByRole("option", { name: /\/task/i }));
    expect(pushMock).toHaveBeenCalledWith("/tasks/new");
    // The composer also clears the input after navigating away.
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("calls onClear and resets the input when /clear runs", async () => {
    const { onChange, onClear } = setup({ value: "/clear" });
    await userEvent.click(screen.getByRole("option", { name: /\/clear/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("");
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("ChatComposer send behavior", () => {
  it("calls onSend with the trimmed value when the send button is clicked", async () => {
    const { onSend } = setup({ value: "  hello world  " });
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("hello world");
  });

  it("does not call onSend on empty or whitespace-only input", async () => {
    const { onSend } = setup({ value: "   " });
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not call onSend while sending is true", async () => {
    const { onSend } = setup({ value: "hello", sending: true });
    const sendBtn = screen.getByRole("button", { name: /send/i });
    expect(sendBtn).toBeDisabled();
    await userEvent.click(sendBtn);
    expect(onSend).not.toHaveBeenCalled();
  });
});
