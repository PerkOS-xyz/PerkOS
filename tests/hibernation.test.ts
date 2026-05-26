import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AWS SDK before the lib imports it. The mock variable name must
// start with `mock` for vitest's hoisting to allow factory references.
// (`server-only` is aliased to a stub in vitest.config.ts.)
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-ecs", () => ({
  // Class-style mock — vi.fn() chained with mockImplementation can lose
  // its `new`-ability when reset between tests; a plain class always
  // works as a constructor regardless of test order.
  ECSClient: class {
    send = mockSend;
  },
  DescribeServicesCommand: class {
    constructor(public input: unknown) {}
  },
  UpdateServiceCommand: class {
    constructor(public input: unknown) {}
  },
}));

// Firestore admin stub — record writes so we can assert state transitions.
const writes: Array<{ path: string; data: unknown }> = [];
const fakeDoc = (path: string) => ({
  set: vi.fn(async (data: unknown) => {
    writes.push({ path, data });
  }),
  get: vi.fn(async () => ({ data: () => ({ hibernation: undefined }) })),
});
const adminDbMock = {
  collection: (c1: string) => ({
    doc: (d1: string) => ({
      collection: (c2: string) => ({
        doc: (d2: string) => fakeDoc(`${c1}/${d1}/${c2}/${d2}`),
      }),
      ...fakeDoc(`${c1}/${d1}`),
    }),
  }),
};
vi.mock("../app/lib/firebaseAdmin", () => ({
  adminDb: () => adminDbMock,
}));

import {
  hibernateAgent,
  wakeAgent,
  serviceNameFor,
  snapshotPrefix,
  HibernationError,
} from "../app/lib/hibernation";

const WALLET = "0xABCDEF1234567890";
const AGENT_ID = "agent-123";
const AGENT_NAME = "MyBot";

beforeEach(() => {
  writes.length = 0;
  // mockClear keeps `.mockImplementation`/`.mockResolvedValue` chains
  // intact; mockReset would also wipe the ECSClient constructor's impl
  // since vi tracks all mocks together.
  mockSend.mockClear();
  mockSend.mockReset();
  // Re-prime is per-test via .mockResolvedValueOnce(); nothing global.
});

describe("serviceNameFor", () => {
  it("matches the ecsProvision.ts convention", () => {
    expect(serviceNameFor(WALLET, AGENT_NAME)).toBe("agent-abcdef12-mybot");
  });
});

describe("snapshotPrefix", () => {
  it("returns lowercased wallet/agent with trailing slash", () => {
    expect(snapshotPrefix(WALLET, AGENT_NAME)).toBe(
      `${WALLET.toLowerCase()}/${AGENT_NAME.toLowerCase()}/`,
    );
  });
});

describe("hibernateAgent", () => {
  it("scales running service from 1 → 0 and writes 'hibernating' state", async () => {
    // First send: DescribeServices → returns ACTIVE w/ desiredCount=1
    // Second send: UpdateServices → returns updated service ARN
    mockSend
      .mockResolvedValueOnce({
        services: [
          {
            status: "ACTIVE",
            serviceName: "agent-abcdef12-mybot",
            desiredCount: 1,
            serviceArn: "arn:svc:1",
          },
        ],
      })
      .mockResolvedValueOnce({
        service: { serviceArn: "arn:svc:1" },
      });

    const result = await hibernateAgent({
      walletAddress: WALLET,
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
    });

    expect(result.previousDesiredCount).toBe(1);
    expect(result.newDesiredCount).toBe(0);
    expect(result.state).toBe("hibernating");
    expect(result.serviceArn).toBe("arn:svc:1");
    // Firestore got the "hibernating" patch on BOTH paths (per-wallet + global)
    expect(writes).toHaveLength(2);
    for (const w of writes) {
      expect((w.data as { hibernation: { state: string } }).hibernation.state).toBe(
        "hibernating",
      );
    }
  });

  it("is a no-op when service is already at 0 and writes 'hibernated' state", async () => {
    mockSend.mockResolvedValueOnce({
      services: [
        {
          status: "ACTIVE",
          serviceName: "agent-abcdef12-mybot",
          desiredCount: 0,
          serviceArn: "arn:svc:1",
        },
      ],
    });

    const result = await hibernateAgent({
      walletAddress: WALLET,
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
    });

    expect(result.previousDesiredCount).toBe(0);
    expect(result.state).toBe("hibernated");
    // No UpdateService call should have been made.
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(2);
    for (const w of writes) {
      expect((w.data as { hibernation: { state: string } }).hibernation.state).toBe(
        "hibernated",
      );
    }
  });

  it("throws SERVICE_NOT_FOUND if the ECS service is missing", async () => {
    mockSend.mockResolvedValueOnce({ services: [] });

    await expect(
      hibernateAgent({
        walletAddress: WALLET,
        agentId: AGENT_ID,
        agentName: AGENT_NAME,
      }),
    ).rejects.toMatchObject({
      errorClass: "SERVICE_NOT_FOUND",
    });
    expect(writes).toHaveLength(0);
  });
});

describe("wakeAgent", () => {
  it("scales service from 0 → 1 and writes 'waking' state", async () => {
    mockSend
      .mockResolvedValueOnce({
        services: [
          {
            status: "ACTIVE",
            serviceName: "agent-abcdef12-mybot",
            desiredCount: 0,
            serviceArn: "arn:svc:1",
          },
        ],
      })
      .mockResolvedValueOnce({
        service: { serviceArn: "arn:svc:1" },
      });

    const result = await wakeAgent({
      walletAddress: WALLET,
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
    });

    expect(result.previousDesiredCount).toBe(0);
    expect(result.newDesiredCount).toBe(1);
    expect(result.state).toBe("waking");
    expect(writes.every(
      (w) => (w.data as { hibernation: { state: string } }).hibernation.state === "waking",
    )).toBe(true);
  });

  it("is a no-op when service is already running and writes 'active' state", async () => {
    mockSend.mockResolvedValueOnce({
      services: [
        {
          status: "ACTIVE",
          serviceName: "agent-abcdef12-mybot",
          desiredCount: 1,
          serviceArn: "arn:svc:1",
        },
      ],
    });

    const result = await wakeAgent({
      walletAddress: WALLET,
      agentId: AGENT_ID,
      agentName: AGENT_NAME,
    });

    expect(result.state).toBe("active");
    expect(result.previousDesiredCount).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

describe("HibernationError", () => {
  it("preserves the errorClass tag", () => {
    const e = new HibernationError("NOT_FOUND", "x");
    expect(e.errorClass).toBe("NOT_FOUND");
    expect(e.message).toBe("x");
  });
});
