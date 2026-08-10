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

// True on md+ viewports (Tailwind's 768px breakpoint), false during SSR and
// on mobile. Lets motion params (parallax speeds, travel) adapt per device
// the same way responsive classes do.
export function useMdUp() {
  const [mdUp, setMdUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setMdUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mdUp;
}

// True only on wide desktop viewports (Tailwind's 1536px `2xl` breakpoint).
// Large kinetic typography needs this extra horizontal room; tablets and
// compact laptops use the wrapped, stationary treatment instead.
export function use2xlUp() {
  const [twoXlUp, setTwoXlUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1536px)");
    const update = () => setTwoXlUp(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return twoXlUp;
}
