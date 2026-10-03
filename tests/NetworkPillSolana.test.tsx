import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NetworkPill } from "../app/components/NetworkPill";
import {
  BrowserWalletContext,
  type BrowserWalletState,
} from "../app/lib/browserWallet";
import {
  SOLANA_PERKOS,
  SOLANA_STABLECOIN,
} from "../app/lib/solanaBalances";
import "../app/lib/i18n";

const SOLANA_ADDRESS = "EsXvSde4oFup8d2QdbEMrA2YWjCod52SbECQ9dgJ6SLA";

function wallet(address: string): BrowserWalletState {
  return {
    loading: false,
    address,
    isConnected: true,
    signMessage: vi.fn(),
    logout: vi.fn(),
  };
}

function renderPill(address: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BrowserWalletContext.Provider value={wallet(address)}>
        <NetworkPill />
      </BrowserWalletContext.Provider>
    </QueryClientProvider>,
  );
}

function rpcReturning(amounts: Record<string, string>) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { params } = JSON.parse(String(init.body));
    const amount = amounts[params[1].mint];
    const value = amount
      ? [{ account: { data: { parsed: { info: { tokenAmount: { amount } } } } } }]
      : [];
    return new Response(JSON.stringify({ result: { value } }));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("NetworkPill for a Solana account", () => {
  it("shows Solana with USDC and PERKOS balances instead of Base", async () => {
    const fetchMock = rpcReturning({
      [SOLANA_STABLECOIN.mint]: "12500000",
      [SOLANA_PERKOS.mint]: "7929136530516",
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPill(SOLANA_ADDRESS);

    const pill = await screen.findByRole("status", { name: /Solana/ });
    await waitFor(() => expect(pill.textContent).toContain("$12.50"));
    expect(pill.textContent).toContain("7.9M");
    expect(pill.querySelector("img")?.getAttribute("src")).toContain("solana.svg");
    expect(pill.textContent).not.toContain("Base");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("marks a balance unavailable when the RPC fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 429 })),
    );

    renderPill(SOLANA_ADDRESS);

    const pill = await screen.findByRole("status", { name: /Solana/ });
    // The balance hook retries once (about one second) before giving up.
    await waitFor(() => expect(pill.textContent).toContain("—"), {
      timeout: 4000,
    });
  });
});
