import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WalletBalances } from "../app/lib/serverWallet";
import i18n from "../app/lib/i18n";

let balanceData: WalletBalances;

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1111111111111111111111111111111111111111",
    isConnected: true,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === "server-wallet"
      ? {
          data: {
            walletId: "wallet-1",
            address: "0x83990f7b43A2d34061aF0551785bF9F072062d19",
            walletType: "EVM",
            createdAt: null,
          },
          isLoading: false,
          isError: false,
        }
      : {
          data: balanceData,
          isLoading: false,
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
        },
}));

vi.mock("../app/(app)/wallet/SendForm", () => ({
  SendForm: () => <div>Send form</div>,
}));

import WalletPage from "../app/(app)/wallet/page";

const zero = (symbol: string) => ({
  symbol,
  address: null,
  decimals: 18,
  raw: "0",
  formatted: "0",
});

describe("WalletPage balances", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    balanceData = {
      address: "0x83990f7b43A2d34061aF0551785bF9F072062d19",
      chains: [
        { chain: "base", chainId: 8453, available: true, balances: [zero("ETH")] },
        { chain: "celo", chainId: 42220, available: true, balances: [zero("CELO")] },
        {
          chain: "robinhood",
          chainId: 4663,
          available: true,
          balances: [zero("ETH"), zero("USDG"), zero("PERKOS")],
        },
      ],
    };
  });

  it("shows Robinhood Chain and explains a real all-zero wallet", () => {
    render(<WalletPage />);

    expect(
      screen.getByRole("combobox", { name: "Choose wallet" }),
    ).toHaveTextContent("My connected wallet");
    expect(screen.getAllByText("Robinhood Chain").length).toBeGreaterThan(0);
    expect(screen.getByText("USDG")).toBeVisible();
    expect(
      screen.getByText(
        "Your PerkOS wallet has no funds yet. Deposit tokens to the address above, then refresh.",
      ),
    ).toBeVisible();
  });

  it("distinguishes an unavailable RPC from a zero balance", () => {
    balanceData.chains[2] = {
      chain: "robinhood",
      chainId: 4663,
      available: false,
      balances: [],
    };

    render(<WalletPage />);

    expect(
      screen.getByText(
        "Robinhood Chain is temporarily unavailable. Try refreshing.",
      ),
    ).toBeVisible();
  });

  it("groups the same asset across networks and reveals exact per-network details", () => {
    balanceData.chains[0]!.balances = [
      {
        symbol: "ETH",
        address: null,
        decimals: 18,
        raw: "4756825000000000",
        formatted: "0.004756825",
      },
    ];
    balanceData.chains[2]!.balances = [
      {
        symbol: "ETH",
        address: null,
        decimals: 18,
        raw: "5821606000000000",
        formatted: "0.005821606",
      },
      {
        symbol: "PERKOS",
        address: null,
        decimals: 18,
        raw: "220567985609118027764504614",
        formatted: "220567985.609118027764504614",
      },
    ];

    render(<WalletPage />);

    expect(screen.getByText("Assets")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Show ETH details" }),
    ).toHaveTextContent("0.010578");
    expect(
      screen.getByRole("button", { name: "Show ETH details" }),
    ).toHaveTextContent("Base");
    expect(
      screen.getByRole("button", { name: "Show ETH details" }),
    ).toHaveTextContent("Robinhood Chain");

    fireEvent.click(screen.getByRole("button", { name: "Show ETH details" }));

    expect(
      screen.getByRole("button", { name: "Hide ETH details" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTitle("0.004756825")).toHaveTextContent("0.004757");
    expect(screen.getByTitle("0.005821606")).toHaveTextContent("0.005822");

    expect(
      screen.getByRole("button", { name: "Show $PERKOS details" }),
    ).toHaveTextContent("220.6M");

    fireEvent.click(
      screen.getByRole("button", { name: "Show $PERKOS details" }),
    );
    expect(
      screen.getByTitle("220567985.609118027764504614"),
    ).toBeVisible();
  });

  it("updates the assets heading when the language changes", async () => {
    await i18n.changeLanguage("es");
    render(<WalletPage />);
    expect(screen.getByText("Activos")).toBeVisible();

    await i18n.changeLanguage("en");
    await waitFor(() => expect(screen.getByText("Assets")).toBeVisible());
  });
});
