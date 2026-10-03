import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatbotPanel } from "../app/components/ChatbotPanel";

const mocks = vi.hoisted(() => ({
  pathname: "/dashboard",
  setOpen: vi.fn(),
  speechStart: vi.fn(),
  speechStop: vi.fn(),
  speechToggle: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

vi.mock("../app/lib/useAppAccount", () => ({
  useAppAccount: () => ({ address: "wallet-1", isConnected: true }),
}));

vi.mock("../app/components/ChatbotProvider", () => ({
  useChatbot: () => ({
    open: true,
    setOpen: mocks.setOpen,
    messages: [],
    appendMessage: vi.fn(),
    prependMessages: vi.fn(),
    resetConversation: vi.fn(),
    convId: "assistant-conv",
    loadingConv: false,
    convError: null,
  }),
}));

vi.mock("../app/lib/useChatPerkosClient", () => ({
  useChatPerkosClient: () => ({
    send: vi.fn(() => "message-1"),
    requestHistory: vi.fn(),
    authed: true,
    error: null,
  }),
}));

vi.mock("../app/lib/useSpeechToText", () => ({
  useSpeechToText: () => ({
    supported: true,
    listening: false,
    interimText: "",
    error: null,
    start: mocks.speechStart,
    stop: mocks.speechStop,
    toggle: mocks.speechToggle,
  }),
}));

describe("Sparky voice dashboard", () => {
  beforeEach(() => {
    mocks.pathname = "/dashboard";
    mocks.setOpen.mockClear();
    mocks.speechStart.mockClear();
    mocks.speechStop.mockClear();
    mocks.speechToggle.mockClear();
    window.localStorage.clear();
  });

  it("renders one embedded Sparky conversation with voice controls", () => {
    render(<ChatbotPanel embedded />);
    expect(screen.getByRole("img", { name: "Sparky" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message or talk to Sparky")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start microphone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn on continuous conversation" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("dialog", { name: "PerkOS" })).not.toBeInTheDocument();
  });

  it("persists explicit continuous voice opt-in and starts listening", () => {
    render(<ChatbotPanel embedded />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on continuous conversation" }));
    expect(window.localStorage.getItem("perkos:sparky:continuous-voice")).toBe("true");
    expect(mocks.speechStart).toHaveBeenCalled();
  });

  it("suppresses the floating panel on the dashboard", () => {
    const { container } = render(<ChatbotPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
