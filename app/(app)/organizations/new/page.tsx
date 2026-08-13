"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAppAccount } from "../../../lib/useAppAccount";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrg } from "../../../lib/perkosApi";
import { useActiveOrg } from "../../../lib/useActiveOrg";

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { address, isConnected } = useAppAccount();
  const { refresh, setActiveOrgId } = useActiveOrg();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet before creating an organization.");
      }
      return createOrg({ walletAddress: address, name: name.trim() });
    },
    onSuccess: async (org) => {
      await refresh();
      if (org.id) setActiveOrgId(org.id);
      toast.success("Organization created", {
        description: `"${org.name}" is now active.`,
      });
      router.replace("/projects");
    },
    onError: (err: Error) =>
      toast.error("Couldn't create organization", { description: err.message }),
  });

  const canSubmit = name.trim().length > 0 && !mutation.isPending;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (canSubmit) mutation.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/organizations"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to organizations
      </Link>

      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold text-foreground">
          New organization
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organizations group your projects and the agents that work on them.
          New projects are created inside the active organization.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Labs"
              maxLength={60}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? "Creating…" : "Create organization"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              render={<Link href="/organizations" />}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
