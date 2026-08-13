import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectAsync: vi.fn(),
  reconnectAsync: vi.fn(),
  isInMiniApp: vi.fn(),
  connectors: [
    { id: "farcasterMiniApp" },
    { id: "baseAccount" },
    { id: "com.coinbase.wallet", rdns: "com.coinbase.wallet" },
  ],
  clientFid: 309857,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
  }),
  useConnect: () => ({ connectAsync: mocks.connectAsync }),
  useConnectors: () => mocks.connectors,
  useReconnect: () => ({ reconnectAsync: mocks.reconnectAsync }),
}));

vi.mock("@farcaster/miniapp-sdk", () => ({
  sdk: {
    isInMiniApp: mocks.isInMiniApp,
    get context() {
      return Promise.resolve({ client: { clientFid: mocks.clientFid } });
    },
  },
}));

import { AutoConnect } from "../app/components/AutoConnect";

describe("AutoConnect", () => {
  beforeEach(() => {
    mocks.connectAsync.mockReset();
    mocks.reconnectAsync.mockReset();
    mocks.isInMiniApp.mockReset();
    mocks.clientFid = 309857;
  });

  it("never requests wallet access in a regular browser", async () => {
    mocks.isInMiniApp.mockResolvedValue(false);

    render(<AutoConnect />);

    await waitFor(() => expect(mocks.isInMiniApp).toHaveBeenCalledOnce());
    expect(mocks.connectAsync).not.toHaveBeenCalled();
    expect(mocks.reconnectAsync).not.toHaveBeenCalled();
  });

  it("still connects the host wallet inside a verified Base Mini App", async () => {
    mocks.isInMiniApp.mockResolvedValue(true);

    render(<AutoConnect />);

    await waitFor(() =>
      expect(mocks.connectAsync).toHaveBeenCalledWith({
        connector: mocks.connectors[1],
      }),
    );
  });
});
