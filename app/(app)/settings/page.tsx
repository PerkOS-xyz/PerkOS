"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useDisconnect } from "wagmi";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
  AtSign,
  UserCircle,
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
import { UsernameCard } from "../../components/UsernameCard";
import { ProfileAvatarCard } from "../../components/ProfileAvatarCard";

const ORG_DRAFT_KEY = "swarm.organization.draft.v1";

export default function SettingsPage() {
  const { t } = useTranslation();
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
    toast.success(t("settings.workspace.toastUpdated"));
  }

  function clearOrgDraft() {
    try {
      window.localStorage.removeItem(ORG_DRAFT_KEY);
      toast.success(t("settings.toast.draftCleared"));
    } catch {
      toast.error(t("settings.toast.draftClearFailed"));
    }
  }

  function confirmResetWorkspace() {
    resetOnboarding();
    setDraftName("");
    setResetOpen(false);
    toast.success(t("settings.toast.stateReset"));
  }

  function handleDisconnect() {
    disconnect();
    router.replace("/sign-in");
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">{t("settings.header.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.header.subtitle")}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" />
              {t("settings.account.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.account.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("settings.account.connectedWallet")}
              </Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                <span className="flex-1 truncate font-mono text-sm text-foreground">
                  {address ? formatAddress(address) : t("settings.account.notConnected")}
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
                        {t("settings.account.copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        {t("settings.account.copyFull")}
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.account.noKeys")}
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
              {t("settings.account.disconnect")}
            </Button>
          </CardContent>
        </Card>

        {/* Username */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AtSign className="h-4 w-4 text-primary" />
              {t("settings.username.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.username.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsernameCard address={address} />
          </CardContent>
        </Card>

        {/* Profile picture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle className="h-4 w-4 text-primary" />
              {t("settings.avatar.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.avatar.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileAvatarCard />
          </CardContent>
        </Card>

        {/* Workspace */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" />
              {t("settings.workspace.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.workspace.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={onSaveWorkspace}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="workspace-name">{t("settings.workspace.nameLabel")}</Label>
                <Input
                  id="workspace-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={t("settings.workspace.namePlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.workspace.storedLocally")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={!canSave} size="sm">
                  {t("settings.workspace.save")}
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
            {t("settings.llm.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.llm.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <span>
                {t("settings.llm.infoBefore")}{" "}
                <a
                  href="/agents/new"
                  className="text-primary hover:underline"
                >
                  {t("settings.llm.infoLink")}
                </a>{" "}
                {t("settings.llm.infoAfter")}
              </span>
              <span className="text-xs">
                {t("settings.llm.infoNote")}
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
            {t("settings.network.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.network.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ReadOnlyRow
            label={t("settings.network.perkosApi")}
            value={perkosApiBaseUrl}
          />
          <ReadOnlyRow
            label={t("settings.network.defaultChain")}
            value="Base Sepolia"
            badge={t("settings.network.testnet")}
          />
          <ReadOnlyRow
            label={t("settings.network.solanaCluster")}
            value="testnet"
            badge={t("settings.network.testnet")}
          />
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {t("settings.danger.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.danger.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DangerRow
            title={t("settings.danger.clearDraft.title")}
            description={t("settings.danger.clearDraft.description")}
            actionLabel={t("settings.danger.clearDraft.action")}
            Icon={Trash2}
            onAction={clearOrgDraft}
          />
          <Separator />
          <DangerRow
            title={t("settings.danger.reset.title")}
            description={t("settings.danger.reset.description")}
            actionLabel={t("settings.danger.reset.action")}
            Icon={RotateCcw}
            onAction={() => setResetOpen(true)}
          />
          <Separator />
          <DangerRow
            title={t("settings.danger.disconnect.title")}
            description={t("settings.danger.disconnect.description")}
            actionLabel={t("settings.danger.disconnect.action")}
            Icon={LogOut}
            onAction={handleDisconnect}
            destructive
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t("settings.resetDialog.title")}
        description={t("settings.resetDialog.description")}
        confirmLabel={t("settings.resetDialog.confirmLabel")}
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
