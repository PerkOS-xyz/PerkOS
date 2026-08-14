import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GET,
  POST,
} from "../app/api/platform/[...path]/route";

const originalApiUrl = process.env.PERKOS_API_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiUrl === undefined) delete process.env.PERKOS_API_URL;
  else process.env.PERKOS_API_URL = originalApiUrl;
});

describe("platform API same-origin proxy", () => {
  it("forwards authenticated requests, query strings, and response metadata", async () => {
    process.env.PERKOS_API_URL = "https://platform.example.test/base";
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reply: "ok" }), {
        status: 201,
        headers: {
          "content-type": "application/json",
          "x-payment-response": "paid",
        },
      }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await POST(
      new Request("http://localhost/api/platform/assistant/chat?trace=1", {
        method: "POST",
        headers: {
          authorization: "Bearer firebase-token",
          "content-type": "application/json",
          cookie: "must-not-leave-the-app=1",
          origin: "http://localhost:3000",
          "user-agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
          "x-forwarded-for": "203.0.113.9",
          "x-real-ip": "203.0.113.9",
        },
        body: JSON.stringify({ message: "hello" }),
      }),
      { params: Promise.resolve({ path: ["assistant", "chat"] }) },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("x-payment-response")).toBe("paid");
    await expect(response.json()).resolves.toEqual({ reply: "ok" });

    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    const [url, init] = upstreamFetch.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://platform.example.test/base/assistant/chat?trace=1",
    );
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer firebase-token");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("user-agent")).toBe(
      "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36",
    );
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.9");
    expect(headers.get("x-real-ip")).toBe("203.0.113.9");
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("origin")).toBe(false);
    expect(Buffer.from(init.body as ArrayBuffer).toString("utf8")).toBe(
      JSON.stringify({ message: "hello" }),
    );
  });

  it("forwards GET requests without a body", async () => {
    process.env.PERKOS_API_URL = "https://api.perkos.xyz";
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response("ok", { status: 200 }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    await GET(
      new Request("http://localhost/api/platform/agents"),
      { params: Promise.resolve({ path: ["agents"] }) },
    );

    const [, init] = upstreamFetch.mock.calls[0] as [URL, RequestInit];
    expect(init.body).toBeUndefined();
  });
});
