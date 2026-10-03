import { firebaseAuth } from "./firebase";

/**
 * Raw balance (base units) of one mint for the signed-in Solana account,
 * read through /api/solana/balances because the public Solana RPC rejects
 * browser requests.
 */
export async function fetchOwnSolanaTokenBalance(
  mint: string,
  signal?: AbortSignal,
): Promise<bigint> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("SOLANA_BALANCE_SIGNED_OUT");
  const idToken = await user.getIdToken();
  const res = await fetch(
    `/api/solana/balances?mint=${encodeURIComponent(mint)}`,
    { headers: { authorization: `Bearer ${idToken}` }, cache: "no-store", signal },
  );
  if (!res.ok) throw new Error(`SOLANA_BALANCE_${res.status}`);
  const { amount } = (await res.json()) as { amount?: string };
  if (typeof amount !== "string" || !/^\d+$/.test(amount)) {
    throw new Error("SOLANA_BALANCE_INVALID");
  }
  return BigInt(amount);
}
