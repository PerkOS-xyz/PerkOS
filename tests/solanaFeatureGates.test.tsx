import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "../app/lib/conversationsApi";

const { account, evmHook, query, serverWallet } = vi.hoisted(() => ({
  account: { address: "So11111111111111111111111111111111111111112", isConnected: true },
  evmHook: vi.fn(() => { throw new Error("EVM hooks must not mount for Solana"); }),
  query: vi.fn(), serverWallet: vi.fn(),
}));
vi.mock("wagmi", () => ({
  useAccount: evmHook, useWalletClient: evmHook, useSwitchChain: evmHook,
  useSignMessage: evmHook, useWaitForTransactionReceipt: evmHook, useWriteContract: evmHook,
}));
vi.mock("../app/lib/useAppAccount", () => ({ useAppAccount: () => account }));
vi.mock("@tanstack/react-query", () => ({ useQuery: query }));
vi.mock("../app/lib/serverWallet", () => ({ ensureServerWallet: serverWallet, fetchWalletBalances: vi.fn(), chainLabel: vi.fn() }));
import WalletPage from "../app/(app)/wallet/page";
import { DepositDialog } from "../app/components/DepositDialog";
import { ReceiptDialog } from "../app/components/ReceiptDialog";
import { BillingCard } from "../app/components/BillingCard";

describe("Solana feature boundaries", () => {
  it("does not mount EVM balance, server wallet or payment flows", () => {
    render(<WalletPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Payments and managed infrastructure are not available");
    expect(evmHook).not.toHaveBeenCalled();
    expect(serverWallet).not.toHaveBeenCalled();
  });
  it("does not mount deposit signing or chain-switch hooks", () => {
    render(<DepositDialog address={account.address} />);
    expect(screen.getByRole("status")).toHaveTextContent("separate account");
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(evmHook).not.toHaveBeenCalled();
  });
  it("explains receipts without requesting history, EVM signatures or transactions", () => {
    render(<ReceiptDialog open onOpenChange={() => {}} walletAddress={account.address} conversation={{ id: "fixture" } as Conversation} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("currently require an EVM account");
    expect(screen.queryByRole("button", { name: /generate|anchor/i })).toBeNull();
    expect(evmHook).not.toHaveBeenCalled();
  });
  it("shows usage without claiming that adding credits unlocks Solana compute", () => {
    query.mockReturnValueOnce({ data: { month: "2026-10", usage: { activeHours: 0, agentCount: 0, llmTokens: 0 }, exempt: false, creditsUsd: 0, enrolled: false }, isLoading: false });
    render(<BillingCard address={account.address} showBlockchain />);
    expect(screen.getByRole("status")).toHaveTextContent("not available for Solana");
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByText(/payment required/i)).toBeNull();
  });
  it("shows a sponsored Solana account as sponsored without payment actions", () => {
    query.mockReturnValueOnce({ data: { month: "2026-10", usage: { activeHours: 0, agentCount: 0, llmTokens: 0 }, exempt: true, creditsUsd: 0, enrolled: true, infra: { hoursRemaining: null } }, isLoading: false });
    render(<BillingCard address={account.address} showBlockchain />);
    expect(screen.getAllByText(/Sponsored/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/not available for Solana/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(evmHook).not.toHaveBeenCalled();
  });
});
