"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { trackPageView } from "../lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const CONSENT_KEY = "perkos-analytics-consent";
type Consent = "granted" | "denied" | null;

export function GoogleAnalytics() {
  const pathname = usePathname();
  const initialPageViewSent = useRef(false);
  const [consent, setConsent] = useState<Consent>(null);
  const [consentResolved, setConsentResolved] = useState(false);

  useEffect(() => {
    if (!GA_ID) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(CONSENT_KEY);
        setConsent(saved === "granted" || saved === "denied" ? saved : null);
      } catch {
        setConsent(null);
      }
      setConsentResolved(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!GA_ID || consent !== "granted") return;

    // The inline config sends the initial page view. This effect handles only
    // subsequent App Router navigations, avoiding a duplicate first hit.
    if (!initialPageViewSent.current) {
      initialPageViewSent.current = true;
      return;
    }

    const query = window.location.search;
    trackPageView(`${pathname}${query}`);
  }, [pathname, consent]);

  if (!GA_ID) return null;

  function chooseConsent(next: Exclude<Consent, null>) {
    try {
      window.localStorage.setItem(CONSENT_KEY, next);
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
    setConsent(next);
  }

  return (
    <>
      {consent === "granted" ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="perkos-google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}

      {consentResolved && consent === null ? (
        <aside className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:p-5" aria-label="Analytics preferences">
          <p className="text-sm font-medium text-foreground">Help us improve PerkOS AI</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            We use Google Analytics to understand which pages and signup steps are useful. No analytics loads until you accept. Read our{" "}
            <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">privacy notice</Link>.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => chooseConsent("granted")} className="brand-gradient rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground">Accept analytics</button>
            <button type="button" onClick={() => chooseConsent("denied")} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Decline</button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
