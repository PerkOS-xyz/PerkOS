/**
 * One human-readable label for the active org / workspace.
 * Wallet addresses never win — the dashboard used to put a truncated
 * 0x… next to "Welcome back" while the breadcrumb said something else.
 */
export function orgDisplayName(input: {
  orgName?: string | null;
  workspaceName?: string | null;
  fallback: string;
}): string {
  const org = input.orgName?.trim();
  if (org) return org;
  const workspace = input.workspaceName?.trim();
  if (workspace) return workspace;
  return input.fallback;
}
