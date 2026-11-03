// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/agentwired/projects/[projectId]/route";

const owner = "0x1234567890123456789012345678901234567890";
vi.mock("@/app/lib/firebaseAdmin", () => ({
  adminAuth: () => ({ verifyIdToken: async () => ({ uid: owner }) }),
  adminDb: () => {
    const ref = {
      collection: () => ref, doc: () => ref,
      get: async () => ({ exists: true, data: () => ({ name: "Test storefront" }) }),
      set: async () => undefined,
    };
    return ref;
  },
}));

function request(body: object) {
  return new Request("http://localhost/api/agentwired/projects/project-1", {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
    body: JSON.stringify(body),
  });
}
const context = { params: Promise.resolve({ projectId: "project-1" }) };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("project storefront handoff", () => {
  it("never forwards a publish request with the service credential", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request({ action: "publish" }), context);
    expect(response.status).toBe(409);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("requests a private simulation draft even if the caller asks for real checkout", async () => {
    vi.stubEnv("PERKOS_SERVICE_TOKEN", "test-service-token");
    const upstream = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ store: { status: "draft" } }, { status: 201 }));
    vi.stubGlobal("fetch", upstream);
    const response = await POST(request({
      action: "create", name: "Test shop", items: [{ name: "Item" }], checkoutMode: "live", publish: true,
    }), context);
    expect(response.status).toBe(201);
    expect(JSON.parse(String(upstream.mock.calls[0]?.[1].body))).toMatchObject({
      checkoutMode: "test", publish: false, paymentMethods: [],
    });
  });
});
