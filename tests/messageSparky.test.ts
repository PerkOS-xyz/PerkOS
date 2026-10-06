import { afterEach, describe, expect, it, vi } from "vitest";

const authedFetch = vi.fn();
vi.mock("../app/lib/apiClient", () => ({ authedFetch }));

import { messageSparky } from "../app/lib/perkosApi";

afterEach(() => authedFetch.mockReset());

describe("messageSparky", () => {
  it("posts the owner's message and reports that Sparky answers", async () => {
    authedFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, handled: true }), { status: 202 }));
    await expect(messageSparky({ projectId: "p1", text: "How is it going?", convId: "c1" })).resolves.toBe(true);
    expect(authedFetch).toHaveBeenCalledWith("/api/projects/p1/sparky/messages", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(authedFetch.mock.calls[0]![1].body)).toEqual({ text: "How is it going?", convId: "c1" });
  });

  it("falls back to the team lead when Sparky does not answer here", async () => {
    authedFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, handled: false }), { status: 200 }));
    await expect(messageSparky({ projectId: "p1", text: "Hi" })).resolves.toBe(false);
    authedFetch.mockResolvedValue(new Response("", { status: 404 }));
    await expect(messageSparky({ projectId: "p1", text: "Hi" })).resolves.toBe(false);
    authedFetch.mockRejectedValue(new Error("offline"));
    await expect(messageSparky({ projectId: "p1", text: "Hi" })).resolves.toBe(false);
  });
});
