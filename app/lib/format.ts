/**
 * Shortens a wallet address to first 3 + last 4 characters separated by ellipsis.
 * E.g. `0x9F02b48c…2e2a` becomes `0x9…2e2a`.
 */
export function formatAddress(address?: string | null): string {
  if (!address) return "";
  if (address.length <= 7) return address;
  return `${address.slice(0, 3)}…${address.slice(-4)}`;
}
