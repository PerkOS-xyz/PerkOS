"use client";

/**
 * Read a wallet's profile (username + avatar fields) for display, cached by
 * react-query so the header chip, member list and mentions share one fetch.
 */
import { useQuery } from "@tanstack/react-query";

import { getUserProfile, type UserProfile } from "./perkosApi";

export function useUserProfile(address?: string | null) {
  const wallet = address ? address.toLowerCase() : null;
  return useQuery<UserProfile | null>({
    queryKey: ["user-profile", wallet],
    queryFn: () => (wallet ? getUserProfile(wallet) : Promise.resolve(null)),
    enabled: !!wallet,
    staleTime: 60_000,
  });
}
