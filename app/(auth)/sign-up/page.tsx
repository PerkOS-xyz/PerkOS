"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sign-up was merged into sign-in. There is no separate sign-up step:
 *
 *   - In a browser tab, Privy's modal ("Log in or sign up") creates the
 *     account on first connect.
 *   - In a Mini App host (Farcaster / Base App), the wallet is already
 *     connected, so the user just signs in.
 *
 * This route stays as a redirect so old links / bookmarks land on the single
 * unified entry at /sign-in.
 */
export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return null;
}
