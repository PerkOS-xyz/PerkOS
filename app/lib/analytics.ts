export type AnalyticsParams = Record<
  string,
  string | number | boolean | undefined
>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined" || !window.gtag) return;

  window.gtag("event", name, params);
}

export function trackPageView(path: string) {
  const measurementId = process.env.NEXT_PUBLIC_GA_ID;
  if (!measurementId || typeof window === "undefined" || !window.gtag) return;

  window.gtag("config", measurementId, {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
