import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WalletBalances } from "../app/lib/serverWallet";

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
  beforeEach(() => {
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
    expect(screen.getByText("Robinhood Chain")).toBeVisible();
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
      screen.getByText("This network is temporarily unavailable. Try refreshing."),
    ).toBeVisible();
  });

  it("keeps real balances readable without losing the exact value", () => {
    balanceData.chains[0]!.balances = [
      {
        symbol: "USDC",
        address: null,
        decimals: 6,
        raw: "3093347",
        formatted: "3.093347",
      },
    ];
    balanceData.chains[2]!.balances = [
      {
        symbol: "PERKOS",
        address: null,
        decimals: 18,
        raw: "220567985609118027764504614",
        formatted: "220567985.609118027764504614",
      },
    ];

    render(<WalletPage />);

    expect(screen.getByTitle("3.093347")).toHaveTextContent("3.09");
    expect(
      screen.getByTitle("220567985.609118027764504614"),
    ).toHaveTextContent("220.6M");
  });
});
