/** One account-bound flight across every consumer of useWalletSession. */
export class WalletSignInCoordinator {
  private wallet: string | null = null;
  private controller = new AbortController();
  private pending: { signal: AbortSignal; promise: Promise<unknown> } | null = null;
  private blockedWallet: string | null = null;
  private loggingOut = false;
  private failure: { wallet: string; error: unknown } | null = null;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getBlockedWallet = (): string | null => this.blockedWallet;
  getLoggingOut = (): boolean => this.loggingOut;
  getFailure = (): { wallet: string; error: unknown } | null => this.failure;

  private clearFailure(): void {
    if (!this.failure) return;
    this.failure = null;
    this.listeners.forEach(listener => listener());
  }

  /** Only an explicit retry may reopen a failed attempt for this account. */
  retry(wallet: string): void {
    if (wallet !== this.wallet || this.failure?.wallet !== wallet) return;
    this.invalidate(wallet);
    this.clearFailure();
  }

  setLoggingOut(value: boolean): void {
    if (value === this.loggingOut) return;
    this.loggingOut = value;
    this.listeners.forEach(listener => listener());
  }

  private block(wallet: string | null): void {
    if (wallet === this.blockedWallet) return;
    this.blockedWallet = wallet;
    this.listeners.forEach(listener => listener());
  }

  suspend(wallet: string | null): void {
    this.block(wallet);
    this.invalidate();
  }

  resume(wallet: string): void {
    this.block(null);
    this.select(wallet);
    this.retry(wallet);
  }

  select(wallet: string | null): void {
    // A failed provider logout must not reopen its signature prompt on render.
    if (wallet && wallet === this.blockedWallet) return;
    this.block(null);
    if (this.failure && wallet !== this.failure.wallet) this.clearFailure();
    if (wallet === this.wallet) return;
    this.invalidate(wallet);
  }

  /** Also invalidates A -> logout -> A, not just changes of address. */
  invalidate(wallet: string | null = null): void {
    this.controller.abort();
    this.wallet = wallet;
    this.controller = new AbortController();
  }

  run(wallet: string | null, operation: (signal: AbortSignal) => Promise<unknown>): Promise<unknown> {
    if (wallet !== this.wallet) return Promise.reject(new DOMException("Wallet session changed.", "AbortError"));
    if (wallet && this.failure?.wallet === wallet) return Promise.reject(this.failure.error);
    const signal = this.controller.signal;
    if (this.pending?.signal === signal) return this.pending.promise;

    // Firebase commits are not cancellable. A replacement must wait until the
    // old operation has completed and removed any stale Firebase session.
    const previous = this.pending?.promise.catch(() => {});
    const attempt = { signal, promise: Promise.resolve() as Promise<unknown> };
    attempt.promise = Promise.resolve(previous).then(() => {
      signal.throwIfAborted();
      return operation(signal);
    }).catch(error => {
      // Keep terminal results across route remounts. Cancellation and stale
      // completions must never poison the newly selected account.
      if (wallet && signal === this.controller.signal && !signal.aborted) {
        this.failure = { wallet, error };
        this.listeners.forEach(listener => listener());
      }
      throw error;
    }).finally(() => {
      if (this.pending === attempt) this.pending = null;
    });
    this.pending = attempt;
    return attempt.promise;
  }
}

/** Detach from a wallet prompt that the provider itself cannot cancel. */
export function abortableWalletPrompt<T>(prompt: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return prompt;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Wallet session changed.", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    // Always consume late provider rejections, including an already aborted signal.
    prompt.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}
