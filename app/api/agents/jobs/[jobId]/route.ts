/**
 * GET /api/agents/jobs/{jobId}
 *
 * Fallback for clients that can't or won't use the Firestore realtime
 * listener — they can poll this endpoint to read the current job
 * status + the most recent log entries.
 *
 * The wizard normally subscribes to the Firestore doc + log
 * subcollection directly via the web SDK, which is cheaper and gives
 * instant updates. This route exists for:
 *   - server-rendered consumers (admin tools)
 *   - browsers without Firebase auth wired up
 *   - debug shell calls
 *
 * Auth: any signed-in caller — the response is scoped to the caller's
 * own wallet address (must match the job's walletAddress).
 */

import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";

async function requireAuth(request: Request): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Missing Authorization bearer token.");
  const decoded = await adminAuth().verifyIdToken(token);
  return decoded.uid.toLowerCase();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  let callerUid: string;
  try {
    callerUid = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("provision_jobs").doc(jobId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }
  const data = snap.data() as Record<string, unknown>;
  if (String(data.walletAddress).toLowerCase() !== callerUid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Last 100 log entries, ordered chronologically.
  const logSnap = await ref.collection("log").orderBy("ts", "asc").limit(100).get();
  const log = logSnap.docs.map((d) => {
    const e = d.data() as { ts?: FirebaseFirestore.Timestamp; level?: string; message?: string };
    return {
      ts: e.ts?.toDate().toISOString() ?? null,
      level: e.level ?? "info",
      message: e.message ?? "",
    };
  });

  return NextResponse.json({
    jobId,
    status: data.status,
    agentName: data.agentName,
    agentId: data.agentId,
    attempts: data.attempts ?? 0,
    result: data.result ?? null,
    error: data.error ?? null,
    log,
  });
}
