"use client";

import { useEffect, useState } from "react";

// Returns false during SSR + the first client render, then true after mount.
// Used to gate framer-motion enhancements (TiltCard, ParallaxLayer, tornado
// ring) so the server and first-client render emit identical static markup —
// motion computes transforms that differ between server and client, which
// otherwise triggers a hydration mismatch that silently breaks the whole
// subtree's client render. setTimeout (not rAF) keeps the setState out of the
// synchronous effect body AND still fires in hidden/background tabs, where
// rAF is paused indefinitely.
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);
  return mounted;
}
