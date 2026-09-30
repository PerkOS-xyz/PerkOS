import { describe, expect, it, vi } from "vitest";
import { abortableWalletPrompt, WalletSignInCoordinator } from "../app/lib/walletSignInCoordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

describe("shared wallet sign-in coordinator", () => {
  it("shares one operation across consumers of the same account generation", async () => {
    const coordinator = new WalletSignInCoordinator();
    coordinator.select("A");
    const op = vi.fn(async () => "done");
    const first = coordinator.run("A", op);
    expect(coordinator.run("A", op)).toBe(first);
    await first;
    expect(op).toHaveBeenCalledOnce();
  });

  it("starts a replacement without waiting for the old provider prompt", async () => {
    const coordinator = new WalletSignInCoordinator();
    const prompt = deferred<string>();
    coordinator.select("A");
    const first = coordinator.run("A", signal => abortableWalletPrompt(prompt.promise, signal));
    const rejection = expect(first).rejects.toHaveProperty("name", "AbortError");
    await Promise.resolve();
    coordinator.select("B");
    await expect(coordinator.run("B", async () => "new account")).resolves.toBe("new account");
    await rejection;
    prompt.resolve("late signature");
  });

  it("serializes a replacement behind cleanup of a non-cancellable commit", async () => {
    const coordinator = new WalletSignInCoordinator();
    const commit = deferred<void>();
    const cleanup = deferred<void>();
    const order: string[] = [];
    coordinator.select("A");
    const first = coordinator.run("A", async signal => {
      await commit.promise;
      if (signal.aborted) { await cleanup.promise; order.push("clean A"); signal.throwIfAborted(); }
    });
    const rejection = expect(first).rejects.toHaveProperty("name", "AbortError");
    await Promise.resolve();
    coordinator.select("B");
    const next = coordinator.run("B", async () => { order.push("commit B"); });
    commit.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);
    cleanup.resolve();
    await next;
    await rejection;
    expect(order).toEqual(["clean A", "commit B"]);
  });

  it("does not reuse the first A attempt after A -> B -> A", async () => {
    const coordinator = new WalletSignInCoordinator();
    coordinator.select("A");
    const old = coordinator.run("A", async () => "old");
    const oldRejection = expect(old).rejects.toHaveProperty("name", "AbortError");
    coordinator.select("B");
    const middle = coordinator.run("B", async () => "middle");
    const middleRejection = expect(middle).rejects.toHaveProperty("name", "AbortError");
    coordinator.select("A");
    await expect(coordinator.run("A", async () => "new")).resolves.toBe("new");
    await oldRejection;
    await middleRejection;
  });

  it("blocks automatic reconnect after logout until explicit retry or account change", async () => {
    const coordinator = new WalletSignInCoordinator();
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribe(listener);
    coordinator.select("A");
    coordinator.suspend("A");
    coordinator.select("A");
    await expect(coordinator.run("A", async () => "unexpected")).rejects.toHaveProperty("name", "AbortError");
    expect(coordinator.getBlockedWallet()).toBe("A");
    await coordinator.run(null, async () => "sign out");
    coordinator.resume("A");
    await expect(coordinator.run("A", async () => "retry")).resolves.toBe("retry");
    coordinator.suspend("A");
    coordinator.select("B");
    expect(coordinator.getBlockedWallet()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });

  it("allows retry after a rejected flight", async () => {
    const coordinator = new WalletSignInCoordinator();
    coordinator.select("A");
    await expect(coordinator.run("A", async () => { throw new Error("denied"); })).rejects.toThrow("denied");
    await expect(coordinator.run("A", async () => "retry")).resolves.toBe("retry");
  });
});
