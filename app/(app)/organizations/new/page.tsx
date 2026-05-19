"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useConnection } from "wagmi";
import { ArrowLeft, Copy, Check, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAddress } from "../../../lib/format";
import { useFormDraft } from "../../../lib/useFormDraft";
import { memberSchema, organizationSchema } from "../../../lib/validators";

const STORAGE_KEY = "swarm.organization.saved.v1";

type Persisted = {
  name: string;
  description: string;
  members: string[];
};

function memberKind(value: string): "email" | "wallet" | "unknown" {
  if (/@/.test(value) && /\./.test(value)) return "email";
  if (/^0x[a-fA-F0-9]{40}$/.test(value) || value.length >= 32) return "wallet";
  return "unknown";
}

function formatWallet(value: string): string {
  if (memberKind(value) !== "wallet") return value;
  return formatAddress(value);
}

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { address } = useConnection();

  const [draft, setDraft, clearDraft] = useFormDraft<{
    name: string;
    description: string;
    members: string[];
  }>("organization.new.v1", { name: "", description: "", members: [] });
  const { name, description, members } = draft;
  const setName = (v: string) => setDraft((d) => ({ ...d, name: v }));
  const setDescription = (v: string) =>
    setDraft((d) => ({ ...d, description: v }));
  const setMembers = (next: string[] | ((prev: string[]) => string[])) =>
    setDraft((d) => ({
      ...d,
      members: typeof next === "function" ? next(d.members) : next,
    }));

  const [memberInput, setMemberInput] = useState("");
  const [memberInputError, setMemberInputError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const nameError = useMemo(() => {
    const parsed = organizationSchema.shape.name.safeParse(name);
    return parsed.success ? undefined : parsed.error.issues[0]?.message;
  }, [name]);

  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-") || "untitled";
    return `${base}/organizations/invite/${slug}`;
  }, [name]);

  const canSubmit = !submitting && !nameError;

  function addMember() {
    const trimmed = memberInput.trim();
    if (!trimmed) {
      setMemberInput("");
      setMemberInputError(null);
      return;
    }
    if (members.includes(trimmed)) {
      setMemberInput("");
      setMemberInputError("Already added.");
      return;
    }
    const parsed = memberSchema.safeParse(trimmed);
    if (!parsed.success) {
      setMemberInputError(parsed.error.issues[0]?.message ?? "Invalid entry.");
      return;
    }
    setMembers([...members, trimmed]);
    setMemberInput("");
    setMemberInputError(null);
  }

  function removeMember(value: string) {
    setMembers(members.filter((m) => m !== value));
  }

  function onMemberKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addMember();
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      // Clipboard might be blocked. Stay silent for now.
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (!canSubmit) return;
    setSubmitting(true);
    const payload: Persisted = {
      name: name.trim(),
      description: description.trim(),
      members,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Organization created", {
        description: `"${payload.name}" is ready.`,
      });
      clearDraft();
      router.replace("/dashboard");
    }, 400);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back to dashboard
        </Link>

        <Card className="border-border bg-card shadow-[0_0_24px_rgba(236,27,105,0.08)]">
          <CardHeader>
            <CardTitle className="text-2xl">New organization</CardTitle>
            <CardDescription>
              Group your projects, agents and teammates under a shared umbrella.
              The wallet you&apos;re signed in with becomes the owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Write a name"
                  aria-invalid={attempted && Boolean(nameError)}
                  aria-describedby={
                    attempted && nameError ? "org-name-error" : undefined
                  }
                />
                {attempted && nameError ? (
                  <p id="org-name-error" className="text-xs text-destructive">
                    {nameError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="org-description">Description</Label>
                <Textarea
                  id="org-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are your organization's goals and mission?"
                  rows={4}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="org-members">Add members</Label>
                <div
                  className={`flex items-center gap-2 rounded-md border bg-card px-3 py-2 focus-within:ring-1 ${
                    memberInputError
                      ? "border-destructive focus-within:border-destructive focus-within:ring-destructive"
                      : "border-input focus-within:border-primary focus-within:ring-primary"
                  }`}
                >
                  <Input
                    id="org-members"
                    value={memberInput}
                    onChange={(e) => {
                      setMemberInput(e.target.value);
                      if (memberInputError) setMemberInputError(null);
                    }}
                    onKeyDown={onMemberKey}
                    onBlur={addMember}
                    placeholder="Email address or wallet address"
                    aria-invalid={Boolean(memberInputError)}
                    aria-describedby={
                      memberInputError ? "org-members-error" : undefined
                    }
                    className="border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={addMember}
                    disabled={memberInput.trim().length === 0}
                    className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-primary"
                    aria-label="Add member"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {memberInputError ? (
                  <p id="org-members-error" className="text-xs text-destructive">
                    {memberInputError}
                  </p>
                ) : null}

                {members.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => {
                      const kind = memberKind(m);
                      return (
                        <Badge
                          key={m}
                          variant="secondary"
                          className={cn(
                            "gap-1 border-border bg-muted",
                            kind === "wallet" && "font-mono"
                          )}
                          title={m}
                        >
                          {formatWallet(m)}
                          <button
                            type="button"
                            onClick={() => removeMember(m)}
                            className="opacity-70 hover:opacity-100"
                            aria-label={`Remove ${m}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Invite members to this organization with a link.
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyInviteLink}
                    className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {linkCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-primary" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy invite link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {address ? (
                <p className="text-xs text-muted-foreground">
                  Owner: <span className="font-mono">{formatWallet(address)}</span>
                </p>
              ) : null}

              <div className="flex pt-1">
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {submitting ? "Creating…" : "Create organization"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
