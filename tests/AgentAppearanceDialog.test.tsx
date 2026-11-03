import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { AgentAppearanceDialog } from "../app/components/AgentAppearanceDialog";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const agent = { id: "fixture-agent", name: "atlas", displayName: "Atlas" };
const file = () => screen.getByLabelText("agentAppearance.upload");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("agent appearance editor", () => {
  it("previews a catalog choice and surfaces save failures without closing", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    const onOpenChange = vi.fn();
    const { baseElement } = render(<AgentAppearanceDialog agent={agent} open onOpenChange={onOpenChange} onSave={onSave} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "agentAppearance.style" }));
    await user.click(screen.getByRole("option", { name: "Operations Specialist" }));
    expect(baseElement.querySelector("[data-avatar-archetype]")).toHaveAttribute("data-avatar-archetype", "8");
    fireEvent.click(screen.getByRole("button", { name: "agentAppearance.save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("agentAppearance.saveError");
    expect(onSave).toHaveBeenCalledWith(8);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("re-encodes an explicit local raster selection and only persists on Save", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 128, height: 256, close }));
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage, fillRect: vi.fn() } as unknown as CanvasRenderingContext2D);
    const jpeg = "data:image/jpeg;base64,/9j/AA==";
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(jpeg);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const { baseElement } = render(<AgentAppearanceDialog agent={agent} open onOpenChange={onOpenChange} onSave={onSave} />);
    fireEvent.change(file(), { target: { files: [new File(["fixture"], "portrait.webp", { type: "image/webp" })] } });
    await waitFor(() => expect(baseElement.querySelector("img")).toHaveAttribute("src", jpeg));
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "agentAppearance.save" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSave).toHaveBeenCalledWith(jpeg);
  });

  it("rejects SVG before any decoding or upload", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const onSave = vi.fn();
    render(<AgentAppearanceDialog agent={agent} open onOpenChange={vi.fn()} onSave={onSave} />);
    fireEvent.change(file(), { target: { files: [new File(["<svg />"], "bad.svg", { type: "image/svg+xml" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("agentAppearance.invalidPhoto");
    expect(decode).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
