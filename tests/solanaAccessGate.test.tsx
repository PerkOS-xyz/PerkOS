import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../app/lib/useWalletSession", () => ({ useWalletSession: () => ({ logout: vi.fn() }) }));
vi.mock("../app/lib/useIsInMiniApp", () => ({ useIsInMiniApp: () => false }));
vi.mock("../app/lib/dynamicBrowser", () => ({ dynamicBrowserEnabled: () => false }));
vi.mock("../app/lib/redeemSolanaAccessCode", () => ({ redeemSolanaAccessCode: vi.fn() }));
import { AccessGate } from "../app/components/AccessGate";

afterEach(() => vi.unstubAllGlobals());

it("requires a code for Solana even when the no-code request fields are complete", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { container } = render(<AccessGate address="So11111111111111111111111111111111111111112" />);
  for (const [id, value] of [["access-email", "fixture@example.com"], ["access-username", "fixture_user"], ["access-company", "Fixture"]]) {
    fireEvent.change(container.querySelector(`#${id}`)!, { target: { value } });
  }
  expect(screen.getByText(/Solana access currently requires an invitation code/)).toBeVisible();
  expect(screen.getByLabelText("Invitation code (required)")).toBeRequired();
  expect(container.querySelector('button[type="submit"]')).toBeDisabled();
  fireEvent.submit(container.querySelector("form")!);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(container.querySelector("#access-code")!, { target: { value: "FIXTURE_ONLY" } });
  expect(container.querySelector('button[type="submit"]')).toBeEnabled();
});

it("keeps the EVM no-code request available", () => {
  const { container } = render(<AccessGate address="0x1111111111111111111111111111111111111111" />);
  for (const [id, value] of [["access-email", "fixture@example.com"], ["access-username", "fixture_user"], ["access-company", "Fixture"]]) {
    fireEvent.change(container.querySelector(`#${id}`)!, { target: { value } });
  }
  expect(container.querySelector('button[type="submit"]')).toBeEnabled();
});
