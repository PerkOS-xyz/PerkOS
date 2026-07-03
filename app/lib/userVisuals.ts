/**
 * User visual identity — the address-hashed gradient + wallet initials shown
 * when a user has no ENS / basename / custom avatar. The human counterpart to
 * agentVisuals (AgentOrb): a colored disc with two letters, never a face.
 *
 * Reuses the roster hue hash so a user's fallback color is stable across the
 * whole app (header chip, member list, mentions).
 */
import { nameHue } from "./agentVisuals";

/** Two-letter initials for a wallet: the first two hex chars after `0x`. */
export function userInitials(address?: string | null): string {
  if (!address) return "?";
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  return (hex.slice(0, 2) || "?").toUpperCase();
}

/** Stable hue [0,360) derived from the address. */
export function userHue(address?: string | null): number {
  return nameHue((address ?? "").toLowerCase());
}
