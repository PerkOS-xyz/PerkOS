/** Never send rules-test setup or bypass writes to a remote host. */
export function localEmulator(value: string | undefined): { host: string; port: number } {
  const match = /^(127\.0\.0\.1|localhost):(\d+)$/.exec(value ?? "");
  const port = Number(match?.[2]);
  if (!match || port < 1 || port > 65535) {
    throw new Error("Rules tests require an explicit loopback emulator host and port.");
  }
  return { host: match[1], port };
}
