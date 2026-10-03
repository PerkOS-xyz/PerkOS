import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));

vi.mock("../app/lib/firebaseAdmin", () => ({
  adminAuth: () => ({ verifyIdToken }),
}));

import { SOLANA_PERKOS, SOLANA_STABLECOIN } from "../app/lib/solanaBalances";

const SOLANA_WALLET = "EsXvSde4oFup8d2QdbEMrA2YWjCod52SbECQ9dgJ6SLA";

function request(mint: string, token: string | null = "id-token") {
  return new Request(
    `https://perkos.test/api/solana/balances?mint=${encodeURIComponent(mint)}`,
    { headers: token ? { authorization: `Bearer ${token}` } : {} },
  );
}

function rpcReturning(amount: string, status = 200) {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        result: {
          value: [
            { account: { data: { parsed: { info: { tokenAmount: { amount } } } } } },
          ],
        },
      }),
      { status },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let GET: typeof import("../app/api/solana/balances/route").GET;

beforeEach(async () => {
  // Fresh module per test so the route's short balance cache starts empty.
  vi.resetModules();
  ({ GET } = await import("../app/api/solana/balances/route"));
  verifyIdToken.mockReset();
  verifyIdToken.mockResolvedValue({ uid: SOLANA_WALLET });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/solana/balances", () => {
  it("requires a session token", async () => {
    const res = await GET(request(SOLANA_PERKOS.mint, null));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid session token", async () => {
    verifyIdToken.mockRejectedValue(new Error("bad token"));
    const res = await GET(request(SOLANA_PERKOS.mint));
    expect(res.status).toBe(401);
  });

  it("only serves Solana accounts", async () => {
    verifyIdToken.mockResolvedValue({
      uid: "0x83990f7b43a2d34061af0551785bf9f072062d19",
    });
    const res = await GET(request(SOLANA_PERKOS.mint));
    expect(res.status).toBe(400);
  });

  it("only serves the mints the header shows", async () => {
    const res = await GET(request("So11111111111111111111111111111111111111112"));
    expect(res.status).toBe(400);
  });

  it("reads the caller's own balance from the RPC", async () => {
    const fetchMock = rpcReturning("7929136530516");

    const res = await GET(request(SOLANA_PERKOS.mint));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ amount: "7929136530516" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.params[0]).toBe(SOLANA_WALLET);
    expect(body.params[1]).toEqual({ mint: SOLANA_PERKOS.mint });
  });

  it("caches a balance briefly so repeated reads skip the RPC", async () => {
    const fetchMock = rpcReturning("12500000");

    const first = await GET(request(SOLANA_STABLECOIN.mint));
    const second = await GET(request(SOLANA_STABLECOIN.mint));

    await expect(first.json()).resolves.toEqual({ amount: "12500000" });
    await expect(second.json()).resolves.toEqual({ amount: "12500000" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an RPC failure as unavailable", async () => {
    rpcReturning("0", 403);
    const res = await GET(request(SOLANA_PERKOS.mint));
    expect(res.status).toBe(502);
  });
});
