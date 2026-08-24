"use client";

import { useCallback, useEffect, useState } from "react";

import { authedFetch } from "../../../lib/apiClient";
import { useAppAccount } from "../../../lib/useAppAccount";

/**
 * Adopting an agent that registered itself.
 *
 * An agent with no wallet registers for free and gets a link to hand to a
 * person. Opening it here and approving makes the agent yours: it can then
 * read and create, and the work it does is billed to you the same way your own
 * agents are. That is the whole reason approval is a human step rather than
 * something the agent can do for itself.
 *
 * ## Why the token lives in the URL fragment
 *
 * `claim_url` puts the token after `#`, which browsers never send to a server.
 * It therefore stays out of request lines, access logs, proxy logs and
 * `Referer` headers on the way here. It is read in the browser and sent once,
 * deliberately, in a request body.
 */
type ClaimState =
  | { status: "reading" }
  | { status: "missing" }
  | { status: "ready"; token: string; label?: string }
  | { status: "working"; token: string; label?: string }
  | { status: "done"; label?: string; alreadyYours: boolean }
  | { status: "failed"; message: string };

/** Read the label without trusting it: it is shown, never acted on. */
function labelFromToken(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { label?: unknown };
    const label = typeof json.label === "string" ? json.label.trim() : "";
    // The server re-reads the token and verifies its signature; this is only
    // to show the person which agent they are being asked to adopt.
    return label ? label.slice(0, 60) : undefined;
  } catch {
    return undefined;
  }
}

export default function ClaimAgentPage() {
  const { address, isConnected } = useAppAccount();
  const [state, setState] = useState<ClaimState>({ status: "reading" });

  useEffect(() => {
    const token = window.location.hash.replace(/^#/, "").trim();
    if (!token) {
      setState({ status: "missing" });
      return;
    }
    setState({ status: "ready", token, label: labelFromToken(token) });
  }, []);

  const approve = useCallback(async () => {
    if (state.status !== "ready") return;
    setState({ status: "working", token: state.token, label: state.label });

    try {
      const response = await authedFetch("/api/agent-registrations/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ claimToken: state.token }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        data?: { alreadyYours?: boolean; label?: string | null };
        error?: { message?: string };
      };

      if (!response.ok) {
        setState({
          status: "failed",
          // The server's message distinguishes an expired link from one
          // already claimed by someone else, and the person needs to know
          // which: one is worth asking for a new link, the other is not.
          message: body.error?.message ?? "This claim could not be completed.",
        });
        return;
      }

      setState({
        status: "done",
        label: body.data?.label ?? state.label,
        alreadyYours: Boolean(body.data?.alreadyYours),
      });
    } catch {
      setState({ status: "failed", message: "The network request failed. Try again." });
    }
  }, [state]);

  const name = "label" in state && state.label ? state.label : "An agent";

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold">Adopt an agent</h1>

      {state.status === "reading" && (
        <p className="mt-4 text-muted-foreground">Reading the invitation…</p>
      )}

      {state.status === "missing" && (
        <p className="mt-4 text-muted-foreground">
          This page needs a claim link. Ask the agent for the{" "}
          <code>claim_url</code> it received when it registered.
        </p>
      )}

      {(state.status === "ready" || state.status === "working") && (
        <>
          <p className="mt-4">
            <strong>{name}</strong> registered itself and is asking you to take
            it on.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Approving lets it read and create in your workspace. The work it
            does is billed to you, exactly like the agents you launch yourself.
            You can only adopt it once, and it cannot adopt itself.
          </p>
          {!isConnected && (
            <p className="mt-4 text-sm">Sign in first, then come back to this link.</p>
          )}
          <button
            type="button"
            onClick={approve}
            disabled={state.status === "working" || !isConnected || !address}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {state.status === "working" ? "Adopting…" : "Adopt this agent"}
          </button>
        </>
      )}

      {state.status === "done" && (
        <p className="mt-4">
          {state.alreadyYours
            ? `${name} was already yours. Nothing changed.`
            : `${name} is yours now. It can start working.`}
        </p>
      )}

      {state.status === "failed" && (
        <p className="mt-4 text-destructive">{state.message}</p>
      )}
    </main>
  );
}
