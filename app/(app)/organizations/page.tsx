"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import { Briefcase, Plus, Trash2, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { formatAddress } from "../../lib/format";

const STORAGE_KEY = "swarm.organization.saved.v1";

type SavedOrg = {
  name: string;
  description: string;
  members: string[];
};

function readOrg(): SavedOrg | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedOrg>;
    if (typeof parsed.name !== "string") return null;
    return {
      name: parsed.name,
      description: parsed.description ?? "",
      members: Array.isArray(parsed.members) ? parsed.members : [],
    };
  } catch {
    return null;
  }
}

function writeOrg(value: SavedOrg | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    }
  } catch {
    // ignore
  }
}

function memberKind(value: string): "email" | "wallet" | "unknown" {
  if (/@/.test(value) && /\./.test(value)) return "email";
  if (/^0x[a-fA-F0-9]{40}$/.test(value) || value.length >= 32) return "wallet";
  return "unknown";
}

function formatWallet(value: string): string {
  if (memberKind(value) !== "wallet") return value;
  return formatAddress(value);
}

export default function OrganizationsPage() {
  const { address } = useConnection();
  const [org, setOrg] = useState<SavedOrg | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setOrg(readOrg());
    setHydrated(true);
  }, []);

  const removeMember = useCallback(
    (value: string) => {
      if (!org) return;
      const next = { ...org, members: org.members.filter((m) => m !== value) };
      setOrg(next);
      writeOrg(next);
      toast.success("Member removed");
    },
    [org]
  );

  const deleteOrg = useCallback(() => {
    writeOrg(null);
    setOrg(null);
    setDeleteOpen(false);
    toast.success("Organization deleted");
  }, []);

  if (!hydrated) {
    return <Skeleton />;
  }

  if (!org) {
    return (
      <div className="flex flex-col gap-6">
        <Header />
        <EmptyState
          icon={Briefcase}
          title="No organization yet"
          description="Group your projects, agents and teammates under a shared umbrella."
          actions={[
            { label: "Create organization", href: "/organizations/new", icon: Plus },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Header />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl">{org.name}</CardTitle>
              {org.description ? (
                <CardDescription>{org.description}</CardDescription>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/organizations/new"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1.5"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Edit details
              </Link>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {address ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Owner
              </span>
              <span className="font-mono text-xs text-foreground" title={address}>
                {formatAddress(address)}
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">
                Members{" "}
                <span className="text-muted-foreground">
                  ({org.members.length})
                </span>
              </h2>
            </div>

            {org.members.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No members yet. Add some from the create flow.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
                {org.members.map((m) => {
                  const kind = memberKind(m);
                  return (
                    <li
                      key={m}
                      className="flex items-center justify-between gap-2 px-4 py-2.5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-sm text-foreground",
                            kind === "wallet" && "font-mono"
                          )}
                          title={m}
                        >
                          {formatWallet(m)}
                        </span>
                        <Badge
                          variant="secondary"
                          className="border-0 bg-muted text-[10px] uppercase tracking-wider"
                        >
                          {kind === "unknown" ? "member" : kind}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeMember(m)}
                        aria-label={`Remove ${m}`}
                        title="Remove member"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${org.name}"?`}
        description="This removes the organization from your device. Backend persistence isn't wired up yet."
        confirmLabel="Delete organization"
        destructive
        onConfirm={deleteOrg}
      />
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">Organization</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace and its members. Persistence is local until the
          backend lands.
        </p>
      </div>
    </header>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Header />
      <div className="h-48 animate-pulse rounded-md border border-border bg-card" />
    </div>
  );
}
