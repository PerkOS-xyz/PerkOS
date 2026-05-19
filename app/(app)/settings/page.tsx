"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useDisconnect } from "wagmi";
import { toast } from "sonner";
import {
  Wallet,
  Copy,
  Check,
  Briefcase,
  KeyRound,
  Network,
  Trash2,
  LogOut,
  AlertTriangle,
  RotateCcw,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { useOnboarding } from "../../lib/onboardingState";
import { formatAddress } from "../../lib/format";
import { perkosApiBaseUrl } from "../../lib/perkosApi";
import { ConfirmDialog } from "../../components/ConfirmDialog";

const ORG_DRAFT_KEY = "swarm.organization.draft.v1";

export default function SettingsPage() {
  const router = useRouter();
  const { address } = useConnection();
  const { disconnect } = useDisconnect();
  const { workspaceName, setWorkspaceName, reset: resetOnboarding } =
    useOnboarding();

  const [draftName, setDraftName] = useState(workspaceName);
  const [walletCopied, setWalletCopied] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const dirty = draftName.trim() !== workspaceName.trim();
  const canSave = dirty && draftName.trim().length > 0;

  function copyWallet() {
    if (!address) return;
    navigator.clipboard
      .writeText(address)
      .then(() => {
        setWalletCopied(true);
        setTimeout(() => setWalletCopied(false), 1500);
      })
      .catch(() => {});
  }

  function onSaveWorkspace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSave) return;
    setWorkspaceName(draftName.trim());
    toast.success("Workspace name updated");
  }

  function clearOrgDraft() {
    try {
      window.localStorage.removeItem(ORG_DRAFT_KEY);
      toast.success("Organization draft cleared");
    } catch {
      toast.error("Couldn't clear draft");
    }
  }

  function confirmResetWorkspace() {
    resetOnboarding();
    setDraftName("");
    setResetOpen(false);
    toast.success("Workspace state reset");
  }

  function handleDisconnect() {
    disconnect();
    router.replace("/sign-in");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your wallet, workspace and integrations.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" />
              Account
            </CardTitle>
            <CardDescription>
              You signed in with this Base / Solana wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Connected wallet
              </Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                <span className="flex-1 truncate font-mono text-sm text-foreground">
                  {address ? formatAddress(address) : "Not connected"}
                </span>
                {address ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyWallet}
                    className="gap-1"
                  >
                    {walletCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy full
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                We never request private keys or seed phrases.
              </p>
            </div>

            <Separator />

            <Button
              type="button"
              variant="outline"
              onClick={handleDisconnect}
              className="w-fit gap-2"
            >
              <LogOut className="h-4 w-4" />
              Disconnect wallet
            </Button>
          </CardContent>
        </Card>

        {/* Workspace */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" />
              Workspace
            </CardTitle>
            <CardDescription>
              Display name shown across the dashboard and onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={onSaveWorkspace}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="workspace-name">Workspace name</Label>
                <Input
                  id="workspace-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Software Workspace"
                />
                <p className="text-xs text-muted-foreground">
                  Stored locally until PerkOS adds workspace persistence on
                  the backend.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={!canSave} size="sm">
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* LLM providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            LLM provider keys
          </CardTitle>
          <CardDescription>
            API keys are currently configured per agent inside the launcher
            (Step 3 → BYOK). Global key storage is on the roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <span>
                For now, each agent ships with its own BYOK setup. Use the{" "}
                <a
                  href="/agents/new"
                  className="text-primary hover:underline"
                >
                  agent launcher
                </a>{" "}
                to attach OpenAI, Anthropic or OpenRouter credentials.
              </span>
              <span className="text-xs">
                A unified key vault scoped to your wallet is planned for a
                future release.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4 text-primary" />
            Network
          </CardTitle>
          <CardDescription>
            Backend and on-chain endpoints this app talks to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ReadOnlyRow
            label="PerkOS API"
            value={perkosApiBaseUrl}
          />
          <ReadOnlyRow
            label="Default chain"
            value="Base Sepolia"
            badge="Testnet"
          />
          <ReadOnlyRow
            label="Solana cluster"
            value="testnet"
            badge="Testnet"
          />
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Local-only actions. Nothing here touches the PerkOS backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DangerRow
            title="Clear organization draft"
            description="Wipes the in-progress organization form stored on this device."
            actionLabel="Clear draft"
            Icon={Trash2}
            onAction={clearOrgDraft}
          />
          <Separator />
          <DangerRow
            title="Reset onboarding state"
            description="Forgets the locally saved workspace name, project marker and agent marker."
            actionLabel="Reset"
            Icon={RotateCcw}
            onAction={() => setResetOpen(true)}
          />
          <Separator />
          <DangerRow
            title="Disconnect wallet"
            description="Signs you out of this device. Your agents and projects on the backend stay intact."
            actionLabel="Disconnect"
            Icon={LogOut}
            onAction={handleDisconnect}
            destructive
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset onboarding state?"
        description="This clears your local workspace name, project draft, and agent setup markers. Your data on the backend is untouched."
        confirmLabel="Reset state"
        destructive
        onConfirm={confirmResetWorkspace}
      />
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="break-all font-mono text-xs text-foreground">
          {value}
        </span>
      </div>
      {badge ? (
        <Badge variant="secondary" className="border-0 bg-muted">
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}

function DangerRow({
  title,
  description,
  actionLabel,
  Icon,
  onAction,
  destructive,
}: {
  title: string;
  description: string;
  actionLabel: string;
  Icon: typeof Trash2;
  onAction: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <Button
        type="button"
        variant={destructive ? "destructive" : "outline"}
        size="sm"
        onClick={onAction}
        className={cn("shrink-0 gap-1.5")}
      >
        <Icon className="h-3.5 w-3.5" />
        {actionLabel}
      </Button>
    </div>
  );
}
