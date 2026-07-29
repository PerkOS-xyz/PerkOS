import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChainBalances } from "../app/lib/serverWallet";
import i18n from "../app/lib/i18n";

const { transferOut } = vi.hoisted(() => ({ transferOut: vi.fn() }));

vi.mock("../app/lib/serverWallet", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../app/lib/serverWallet")>();
  return { ...original, transferOut };
});

import { SendForm } from "../app/(app)/wallet/SendForm";

const address = "0x83990f7b43A2d34061aF0551785bF9F072062d19";

const fundedChains: ChainBalances[] = [
  {
    chain: "base",
    chainId: 8453,
    available: true,
    balances: [
      {
        symbol: "USDC",
        address: "0x1111111111111111111111111111111111111111",
        decimals: 6,
        raw: "3090000",
        formatted: "3.09",
      },
      {
        symbol: "ETH",
        address: null,
        decimals: 18,
        raw: "1000000000000000",
        formatted: "0.001",
      },
    ],
  },
  {
    chain: "robinhood",
    chainId: 4663,
    available: true,
    balances: [
      {
        symbol: "USDG",
        address: "0x2222222222222222222222222222222222222222",
        decimals: 6,
        raw: "0",
        formatted: "0",
      },
    ],
  },
];

function renderSendForm(chains = fundedChains) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SendForm address={address} chains={chains} />
    </QueryClientProvider>,
  );
}

describe("SendForm", () => {
  beforeEach(async () => {
    transferOut.mockReset();
    await i18n.changeLanguage("en");
  });

  it("shows a compact deposit state instead of an unusable form when empty", () => {
    const empty = fundedChains.map((chain) => ({
      ...chain,
      balances: chain.balances.map((balance) => ({
        ...balance,
        raw: "0",
        formatted: "0",
      })),
    }));

    renderSendForm(empty);

    expect(screen.getByText("Your PerkOS wallet is empty")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy wallet address" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Send" }),
    ).not.toBeInTheDocument();
  });

  it("opens a focused transfer dialog with the funded asset selected", async () => {
    renderSendForm();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByRole("dialog", { name: "Send assets" }),
    ).toBeVisible();
    expect(screen.getByText("Available: 3.09 USDC")).toBeVisible();
    expect(
      screen.getByText(
        "This transfer uses your PerkOS wallet, not your connected wallet.",
      ),
    ).toBeVisible();
  });

  it("blocks overspending and self-transfers before the review step", async () => {
    renderSendForm();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    fireEvent.change(await screen.findByLabelText("Amount"), {
      target: { value: "4" },
    });
    fireEvent.blur(screen.getByLabelText("Amount"));
    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: address },
    });
    fireEvent.blur(screen.getByLabelText("Recipient address"));

    expect(screen.getByText("Insufficient USDC on Base.")).toBeVisible();
    expect(
      screen.getByText("You cannot send to this same wallet."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Review transfer" }));
    expect(
      screen.queryByText("Check every detail before confirming."),
    ).not.toBeInTheDocument();
  });

  it("requires review before confirming the onchain transfer", async () => {
    transferOut.mockResolvedValue({
      hash: `0x${"a".repeat(64)}`,
      chain: "base",
      chainId: 8453,
      token: "USDC",
      to: "0x1111111111111111111111111111111111111111",
      amount: "2",
    });
    renderSendForm();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    fireEvent.change(await screen.findByLabelText("Amount"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Recipient address"), {
      target: { value: "0x1111111111111111111111111111111111111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review transfer" }));

    expect(
      screen.getByText("Check every detail before confirming."),
    ).toBeVisible();
    expect(transferOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm and send" }));

    await waitFor(() =>
      expect(transferOut).toHaveBeenCalledWith({
        chain: "base",
        token: "USDC",
        to: "0x1111111111111111111111111111111111111111",
        amount: "2",
      }, expect.anything()),
    );
    expect(await screen.findByText("Sent")).toBeVisible();
  });
});
