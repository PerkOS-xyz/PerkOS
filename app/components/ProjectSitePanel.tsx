"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe2, Loader2, Rocket, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { firebaseAuth } from "@/app/lib/firebase";
import type { Project } from "@/app/lib/perkosApi";

type Site = NonNullable<Project["site"]>;

async function request(path: string, init: RequestInit = {}) {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("Connect your wallet first.");
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Site request failed.");
  return body as { site: Site | null };
}

export function ProjectSitePanel({
  projectId,
  project,
  ownerWallet,
}: {
  projectId: string;
  project: Project;
  ownerWallet: string;
}) {
  const endpoint = useMemo(
    () => `/api/agentwired/projects/${encodeURIComponent(projectId)}?ownerWallet=${encodeURIComponent(ownerWallet)}`,
    [projectId, ownerWallet],
  );
  const [site, setSite] = useState<Site | null>(project.site ?? null);
  const [loading, setLoading] = useState(Boolean(project.site));
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(project.name);
  const [vertical, setVertical] = useState("other");
  const [description, setDescription] = useState(project.goal ?? "");
  const [itemName, setItemName] = useState("Featured service");
  const [itemDescription, setItemDescription] = useState(`A featured product or service from ${project.name}.`);
  const [itemPrice, setItemPrice] = useState("25");

  useEffect(() => {
    if (!project.site) return;
    let active = true;
    request(endpoint)
      .then((result) => { if (active) setSite(result.site); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, project.site]);

  async function createDraft() {
    const price = Number(itemPrice);
    if (!itemName.trim() || itemDescription.trim().length < 20 || !Number.isFinite(price) || price < 0) {
      toast.error("Add a name, a useful description, and a valid price for the first item.");
      return;
    }
    setSaving(true);
    try {
      const result = await request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          ownerWallet,
          name,
          vertical,
          description,
          items: [{ name: itemName, price, description: itemDescription.trim() }],
        }),
      });
      setSite(result.site);
      toast.success("Site draft created. Review it before publishing.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create site.");
    } finally { setSaving(false); }
  }

  async function publish() {
    if (!confirm("Publish this site now? It will become publicly accessible.")) return;
    setSaving(true);
    try {
      const result = await request(endpoint, {
        method: "POST",
        body: JSON.stringify({ action: "publish", ownerWallet }),
      });
      setSite(result.site);
      toast.success("Site published.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish site.");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex min-h-40 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Refreshing site…</div>;

  if (site) {
    const publicUrl = site.status === "published" ? site.storeUrl : site.previewUrl;
    return (
      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" /><h3 className="font-semibold">Project site</h3></div>
            <p className="mt-1 text-sm text-muted-foreground">This site is linked to this organization and project.</p>
          </div>
          <span className={site.status === "published" ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400" : "rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300"}>
            {site.status === "published" ? "Live" : "Draft"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-primary/60">
            {site.status === "published" ? "Open live site" : "Preview draft"}<ExternalLink className="h-4 w-4" />
          </a>
          <a href={site.adminUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-primary/60">
            Edit content and design<ExternalLink className="h-4 w-4" />
          </a>
        </div>
        {site.status === "draft" ? <Button onClick={publish} disabled={saving} className="w-full sm:w-auto"><Rocket className="mr-2 h-4 w-4" />{saving ? "Publishing…" : "Approve and publish"}</Button> : null}
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-4">
      <div>
        <div className="flex items-center gap-2"><Store className="h-5 w-5 text-primary" /><h3 className="font-semibold">Create a site for this project</h3></div>
        <p className="mt-1 text-sm text-muted-foreground">AgentWired creates a private draft first. Nothing goes live until you review and approve it.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Site name</span><input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3" /></label>
        <label className="space-y-1 text-sm"><span>Business type</span><select value={vertical} onChange={(e) => setVertical(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3"><option value="other">Business</option><option value="restaurant">Restaurant</option><option value="barbershop">Barbershop</option><option value="retail">Retail</option></select></label>
      </div>
      <label className="block space-y-1 text-sm"><span>Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-border bg-background p-3" /></label>
      <div className="rounded-lg border border-border/70 p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">First catalog item</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]"><input aria-label="Item name" value={itemName} onChange={(e) => setItemName(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" /><input aria-label="Price in USD" type="number" min="0" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" /></div>
        <textarea aria-label="Item description" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} rows={2} minLength={20} className="mt-3 w-full rounded-lg border border-border bg-background p-3" />
      </div>
      <Button onClick={createDraft} disabled={saving || !name.trim()} className="w-full sm:w-auto">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe2 className="mr-2 h-4 w-4" />}{saving ? "Creating draft…" : "Create private draft"}</Button>
    </section>
  );
}
