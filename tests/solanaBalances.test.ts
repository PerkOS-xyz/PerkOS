import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SOLANA_PERKOS,
  SOLANA_STABLECOIN,
  fetchSolanaTokenBalance,
} from "../app/lib/solanaBalances";

const OWNER = "EsXvSde4oFup8d2QdbEMrA2YWjCod52SbECQ9dgJ6SLA";
const RPC = "https://rpc.example.test";

function tokenAccount(amount: string) {
  return {
    account: { data: { parsed: { info: { tokenAmount: { amount } } } } },
  };
}

function mockRpc(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Solana token configuration", () => {
  it("uses the PERKOS Token-2022 mint", () => {
    expect(SOLANA_PERKOS).toEqual({
      mint: "GvZ9UXZm8U14uZNi7hBN5cY2iUta7stArZE486yHe2nA",
      symbol: "PERKOS",
      decimals: 6,
    });
  });

  it("uses native USDC on Solana", () => {
    expect(SOLANA_STABLECOIN).toEqual({
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      symbol: "USDC",
      decimals: 6,
    });
  });
});

describe("fetchSolanaTokenBalance", () => {
  it("asks the RPC for the owner's token accounts of one mint", async () => {
    const fetchMock = mockRpc({ result: { value: [] } });
    await fetchSolanaTokenBalance(OWNER, SOLANA_PERKOS.mint, undefined, RPC);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(RPC);
    expect(JSON.parse(init.body)).toMatchObject({
      method: "getTokenAccountsByOwner",
      params: [OWNER, { mint: SOLANA_PERKOS.mint }, { encoding: "jsonParsed" }],
    });
  });

  it("sums the raw amount across token accounts", async () => {
    mockRpc({
      result: { value: [tokenAccount("7929136530516"), tokenAccount("1000000")] },
    });
    await expect(
      fetchSolanaTokenBalance(OWNER, SOLANA_PERKOS.mint, undefined, RPC),
    ).resolves.toBe(BigInt("7929137530516"));
  });

  it("returns zero when the owner holds no token account", async () => {
    mockRpc({ result: { value: [] } });
    await expect(
      fetchSolanaTokenBalance(OWNER, SOLANA_STABLECOIN.mint, undefined, RPC),
    ).resolves.toBe(BigInt(0));
  });

  it("rejects on an RPC error so the pill shows the unavailable state", async () => {
    mockRpc({ error: { message: "Invalid param" } });
    await expect(
      fetchSolanaTokenBalance(OWNER, SOLANA_PERKOS.mint, undefined, RPC),
    ).rejects.toThrow("SOLANA_RPC_ERROR");
  });

  it("rejects on an HTTP failure", async () => {
    mockRpc({}, 429);
    await expect(
      fetchSolanaTokenBalance(OWNER, SOLANA_PERKOS.mint, undefined, RPC),
    ).rejects.toThrow("SOLANA_RPC_429");
  });
});
