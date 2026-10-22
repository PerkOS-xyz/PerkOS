import { NextResponse } from "next/server";
import { normalizeWalletAddress, walletChain } from "@perkos/shared-types";

import { adminAuth, adminDb } from "@/app/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

type SiteRecord = {
  externalId: string;
  tenantId: string;
  status: "draft" | "published";
  storeUrl: string;
  adminUrl: string;
  previewUrl: string;
  updatedAt: string;
};

const agentWiredUrl = () => (process.env.AGENTWIRED_URL ?? "https://agentwired.ai").replace(/\/$/, "");

async function identity(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  try {
    const uid = (await adminAuth().verifyIdToken(header.slice(7).trim())).uid;
    return walletChain(uid) ? normalizeWalletAddress(uid) : null;
  } catch {
    return null;
  }
}

async function projectFor(wallet: string, projectId: string, requestedOwner: string | null) {
  const candidate = requestedOwner || wallet;
  if (!walletChain(candidate)) return null;
  const owner = normalizeWalletAddress(candidate);
  const ref = adminDb().collection("wallets").doc(owner).collection("projects").doc(projectId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  if (owner !== wallet) {
    const data = snapshot.data() ?? {};
    const projectMember = await ref.collection("members").doc(wallet).get();
    const orgMember = data.orgId
      ? await adminDb().collection("wallets").doc(owner).collection("organizations")
        .doc(String(data.orgId)).collection("members").doc(wallet).get()
      : null;
    const member = projectMember.exists ? projectMember.data() : orgMember?.exists ? orgMember.data() : null;
    const active = member && String(member.status ?? "active").toLowerCase() === "active";
    const role = String(member?.role ?? "viewer").toLowerCase();
    if (!active || !["owner", "editor"].includes(role)) return null;
  }
  return { owner, ref, data: snapshot.data() ?? {} };
}

async function serviceFetch(path: string, init?: RequestInit) {
  const token = process.env.PERKOS_SERVICE_TOKEN?.trim();
  if (!token) throw new Error("AgentWired service integration is not configured.");
  return fetch(`${agentWiredUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
}

function errorMessage(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : fallback;
}

export async function GET(request: Request, { params }: RouteContext) {
  const wallet = await identity(request);
  if (!wallet) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { projectId } = await params;
  const ownerWallet = new URL(request.url).searchParams.get("ownerWallet");
  const project = await projectFor(wallet, projectId, ownerWallet);
  if (!project) return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });

  const site = project.data.site as SiteRecord | undefined;
  if (!site?.externalId) return NextResponse.json({ site: null });
  const response = await serviceFetch(`/api/integrations/perkos/stores/${encodeURIComponent(site.externalId)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ site, warning: errorMessage(body, "Could not refresh site status.") });
  const fresh = { ...(body.store as SiteRecord), updatedAt: new Date().toISOString() };
  await project.ref.set({ site: fresh, updatedAt: new Date().toISOString() }, { merge: true });
  return NextResponse.json({ site: fresh });
}

export async function POST(request: Request, { params }: RouteContext) {
  const wallet = await identity(request);
  if (!wallet) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { projectId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Body must be JSON." }, { status: 400 }); }

  const project = await projectFor(wallet, projectId, typeof body.ownerWallet === "string" ? body.ownerWallet : null);
  if (!project) return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });
  const action = String(body.action ?? "create");
  const existing = project.data.site as SiteRecord | undefined;

  if (action === "publish") {
    if (!existing?.externalId) return NextResponse.json({ error: "Create a draft before publishing." }, { status: 409 });
    const response = await serviceFetch(`/api/integrations/perkos/stores/${encodeURIComponent(existing.externalId)}`, {
      method: "POST",
      body: JSON.stringify({ action: "publish" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: errorMessage(result, "Could not publish site.") }, { status: response.status });
    const site = { ...(result.store as SiteRecord), updatedAt: new Date().toISOString() };
    await project.ref.set({ site, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ site });
  }

  if (existing?.externalId) return NextResponse.json({ error: "This project already has a site." }, { status: 409 });
  const name = String(body.name ?? project.data.name ?? "Untitled site").trim().slice(0, 200);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!name || rawItems.length === 0) return NextResponse.json({ error: "A name and at least one item are required." }, { status: 400 });
  const externalId = `perkos:${project.owner}:${projectId}`;
  const response = await serviceFetch("/api/integrations/perkos/stores", {
    method: "POST",
    body: JSON.stringify({
      externalId,
      ownerUserId: project.owner,
      ownerWallet: project.owner,
      orgId: String(project.data.orgId ?? ""),
      projectId,
      name,
      description: String(body.description ?? project.data.goal ?? "").slice(0, 4000),
      vertical: String(body.vertical ?? "other").slice(0, 100),
      templateId: typeof body.templateId === "string" ? body.templateId : undefined,
      styleId: typeof body.styleId === "string" ? body.styleId : undefined,
      items: rawItems,
      paymentMethods: [],
      publish: false,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: errorMessage(result, "Could not create site draft.") }, { status: response.status });
  const site = { ...(result.store as SiteRecord), updatedAt: new Date().toISOString() };
  await project.ref.set({ site, updatedAt: new Date().toISOString() }, { merge: true });
  return NextResponse.json({ site }, { status: response.status });
}
