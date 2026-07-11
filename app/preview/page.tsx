import type { Metadata } from "next";

import { LandingContentV2 } from "../components/landing/v2/LandingContentV2";

// ============================================================================
// /preview — the "landing with life" exploration (branch dex/landing).
//
// Server Component: owns metadata only; the animated body is the client
// LandingContentV2. Deliberately no LandingAutoRoute so the preview is always
// viewable regardless of wallet/connection state. noindex: this is a work-in-
// progress surface, not for search engines.
// ============================================================================

export const metadata: Metadata = {
  title: "PerkOS — Landing preview",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return <LandingContentV2 />;
}
