"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MembersPanel } from "../../../../components/MembersPanel";
import { useActiveOrg } from "../../../../lib/useActiveOrg";
import { updateOrgName } from "../../../../lib/perkosApi";

export default function OrgSettingsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;
  const { address } = useConnection();
  const { orgs, refresh } = useActiveOrg();
  const org = orgs.find((o) => o.id === orgId) ?? null;
  const isOwner = org?.role === "owner" || (!org?.shared && Boolean(org));

  const [name, setName] = useState("");
  useEffect(() => {
    if (org) setName(org.name);
  }, [org]);

  const renameMut = useMutation({
    mutationFn: () =>
      updateOrgName({ walletAddress: address!, orgId, name: name.trim() }),
    onSuccess: async () => {
      await refresh();
      toast.success("Organization renamed");
    },
    onError: (e: Error) =>
      toast.error("Couldn't rename", { description: e.message }),
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/organizations"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to organizations
      </Link>

      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {org?.name ?? "Organization"} settings
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Rename the org and manage who can access it + its projects."
              : "You're a member of this organization."}
          </p>
        </div>
      </div>

      {isOwner ? (
        <section className="flex max-w-lg flex-col gap-2">
          <Label htmlFor="org-name">Name</Label>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) renameMut.mutate();
            }}
          >
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <Button
              type="submit"
              disabled={renameMut.isPending || !name.trim() || name === org?.name}
            >
              Save
            </Button>
          </form>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground">Members</h2>
        <p className="-mt-1 text-xs text-muted-foreground">
          Members can see this organization and all its projects. Editors can
          also create + edit projects and tasks; viewers are read-only.
        </p>
        <MembersPanel kind="org" id={orgId} canManage={isOwner} />
      </section>
    </div>
  );
}
