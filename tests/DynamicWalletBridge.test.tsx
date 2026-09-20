import { useContext, useEffect } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserWalletContext, type BrowserWalletState } from "../app/lib/browserWallet";
import { DynamicWalletBridge } from "../app/components/DynamicWalletBridge";
import { DynamicSignInButton } from "../app/components/DynamicSignInButton";

const mock = vi.hoisted(() => ({ context: {} as Record<string, unknown> }));
vi.mock("@dynamic-labs/sdk-react-core", () => ({ useDynamicContext: () => mock.context }));
vi.mock("@dynamic-labs/ethereum", () => ({ isEthereumWallet: (w: { chain?: string }) => w.chain === "EVM" }));
vi.mock("next/image", () => ({ default: () => null }));
let state: BrowserWalletState;
function Consumer() {
  const value = useContext(BrowserWalletContext)!;
  useEffect(() => { state = value; }, [value]);
  return null;
}
const wallet = () => ({ chain: "EVM", address: `0x${"1".repeat(40)}`, signMessage: vi.fn().mockResolvedValue("0xsigned") });

describe("Dynamic browser wallet bridge", () => {
  beforeEach(() => {
    mock.context = { sdkHasLoaded: true, primaryWallet: wallet(), user: { email: "test@example.com" }, handleLogOut: vi.fn().mockResolvedValue(undefined), setShowAuthFlow: vi.fn() };
  });
  it("exposes the active EVM wallet and signs the PerkOS challenge", async () => {
    render(<DynamicWalletBridge><Consumer /></DynamicWalletBridge>);
    expect(state.isConnected).toBe(true);
    expect(state.identityLabel).toBe("test@example.com");
    expect(await state.signMessage("PerkOS nonce")).toBe("0xsigned");
    expect((mock.context.primaryWallet as ReturnType<typeof wallet>).signMessage).toHaveBeenCalledWith("PerkOS nonce");
    await state.logout();
    expect(mock.context.handleLogOut).toHaveBeenCalledOnce();
  });
  it("waits for hydration and does not expose a stale wallet", () => {
    mock.context.sdkHasLoaded = false;
    render(<DynamicWalletBridge><Consumer /></DynamicWalletBridge>);
    expect(state.loading).toBe(true);
    expect(state.address).toBeUndefined();
    expect(state.isConnected).toBe(false);
  });
  it("does not confuse a social login without a wallet with a connected wallet", async () => {
    mock.context.primaryWallet = null;
    render(<DynamicWalletBridge><Consumer /></DynamicWalletBridge>);
    expect(state.isConnected).toBe(false);
    expect(state.loading).toBe(false);
    await expect(state.signMessage("nonce")).rejects.toThrow("No EVM");
  });
  it("rejects non-EVM wallets", () => {
    mock.context.primaryWallet = { ...wallet(), chain: "SOL" };
    render(<DynamicWalletBridge><Consumer /></DynamicWalletBridge>);
    expect(state.isConnected).toBe(false);
  });
  it("updates the account on wallet switch and disconnect", () => {
    const { rerender } = render(<DynamicWalletBridge><Consumer /></DynamicWalletBridge>);
    mock.context.primaryWallet = { ...wallet(), address: `0x${"2".repeat(40)}` };
    rerender(<DynamicWalletBridge><Consumer /></DynamicWalletBridge>);
    expect(state.address).toBe(`0x${"2".repeat(40)}`);
    mock.context.primaryWallet = null;
    rerender(<DynamicWalletBridge><Consumer /></DynamicWalletBridge>);
    expect(state.address).toBeUndefined();
  });
  it("opens login only on click and disables it until ready", () => {
    mock.context.sdkHasLoaded = false;
    const { rerender } = render(<DynamicSignInButton />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(mock.context.setShowAuthFlow).not.toHaveBeenCalled();
    mock.context.sdkHasLoaded = true;
    rerender(<DynamicSignInButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(mock.context.setShowAuthFlow).toHaveBeenCalledWith(true);
  });
});
