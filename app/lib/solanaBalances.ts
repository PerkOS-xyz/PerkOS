/**
 * Solana token balances for the header NetworkPill when the signed-in
 * account is a Solana wallet.
 *
 * Sources:
 *   - USDC Solana mainnet: https://developers.circle.com/stablecoins/usdc-on-main-networks
 *   - PERKOS Solana mint (Token-2022, 6 decimals) provided by the team, 2026-10-03.
 */

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() ||
  "https://api.mainnet-beta.solana.com";

export type SolanaTokenInfo = {
  mint: string;
  symbol: string;
  decimals: number;
};

export const SOLANA_STABLECOIN: SolanaTokenInfo = {
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  symbol: "USDC",
  decimals: 6,
};

export const SOLANA_PERKOS: SolanaTokenInfo = {
  mint: "GvZ9UXZm8U14uZNi7hBN5cY2iUta7stArZE486yHe2nA",
  symbol: "PERKOS",
  decimals: 6,
};

type TokenAccountsResponse = {
  result?: {
    value?: Array<{
      account?: {
        data?: { parsed?: { info?: { tokenAmount?: { amount?: string } } } };
      };
    }>;
  };
  error?: { message?: string };
};

/**
 * Raw balance (base units) of one mint held by `owner`, summed across all of
 * the owner's token accounts for that mint. Works for both the SPL Token and
 * Token-2022 programs because the RPC resolves the program from the mint.
 */
export async function fetchSolanaTokenBalance(
  owner: string,
  mint: string,
  signal?: AbortSignal,
  rpcUrl: string = SOLANA_RPC_URL,
): Promise<bigint> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [owner, { mint }, { encoding: "jsonParsed" }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`SOLANA_RPC_${res.status}`);
  const payload = (await res.json()) as TokenAccountsResponse;
  if (payload.error || !payload.result) throw new Error("SOLANA_RPC_ERROR");
  return (payload.result.value ?? []).reduce((total, entry) => {
    const amount = entry.account?.data?.parsed?.info?.tokenAmount?.amount;
    return amount && /^\d+$/.test(amount) ? total + BigInt(amount) : total;
  }, BigInt(0));
}
