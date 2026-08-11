import type { Metadata } from "next";
import { Check } from "lucide-react";

import { ContentSection, PublicPageShell } from "../components/marketing/PublicPageShell";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare PerkOS AI plans with included PerkOS Infra hours, optional prepaid Managed AI, BYOK support, and no surprise bills.",
  alternates: { canonical: "/pricing" },
};

const PLANS = [
  { name: "Free", price: "$0", detail: "7 days with the AI agents you already run" },
  { name: "Starter", price: "$29.97", detail: "50 PerkOS Infra hours; bring your own AI provider" },
  { name: "Pro", price: "$89.97", detail: "150 PerkOS Infra hours; prepaid Managed AI available" },
  { name: "Scale", price: "$239.97", detail: "500 PerkOS Infra hours; prepaid Managed AI available" },
];

export default function PricingPage() {
  return (
    <PublicPageShell
      eyebrow="PerkOS AI pricing"
      title="Start free. Add capacity when the work proves its value."
      intro="Choose a monthly PerkOS Infra allowance, then use prepaid Managed AI credits or connect your own provider. Usage pauses at zero, so there are no surprise bills."
      ctaId="pricing"
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Pricing", path: "/pricing" },
      ]}
    >
      <ContentSection title="Plans for each stage of your business">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <article key={plan.name} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground">{plan.name}</h3>
              <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{plan.price}</p>
              <p className="text-xs text-muted-foreground">{plan.name === "Free" ? "one time" : "per month"}</p>
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{plan.detail}</p>
            </article>
          ))}
        </div>
      </ContentSection>
      <ContentSection title="Simple by design">
        <div className="grid gap-4 md:grid-cols-3">
          {["No setup fees", "No long-term contracts", "Separate prepaid usage limits"].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-foreground">
              <Check className="h-5 w-5 shrink-0 text-primary" />
              <span className="font-medium">{item}</span>
            </div>
          ))}
        </div>
      </ContentSection>
    </PublicPageShell>
  );
}
