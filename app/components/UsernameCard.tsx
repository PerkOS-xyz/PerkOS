"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AtSign, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  getUserProfile,
  getUsernameOwner,
  isValidUsername,
  normalizeUsername,
  setUsername,
} from "../lib/perkosApi";
import { formatAddress } from "../lib/format";

type Avail = "idle" | "checking" | "available" | "taken" | "mine" | "invalid";

/**
 * Claim / change your @username — the human-readable handle others type to
 * @-mention you in chats. Collision-free: the registry rejects a taken
 * handle. Falls back to your wallet address when unset. (ENS / Base name
 * auto-resolution is a future enhancement; you can set a basename as your
 * username here meanwhile.)
 */
export function UsernameCard({
  address,
  onSaved,
}: {
  address?: string;
  onSaved?: (username: string) => void;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [avail, setAvail] = useState<Avail>("idle");
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!address) return;
    getUserProfile(address)
      .then((p) => {
        setCurrent(p?.username ?? null);
        setValue(p?.username ?? "");
      })
      .catch(() => {});
  }, [address]);

  useEffect(() => {
    const v = normalizeUsername(value);
    if (!v || v === current) {
      setAvail("idle");
      return;
    }
    if (!isValidUsername(v)) {
      setAvail("invalid");
      return;
    }
    const my = ++seq.current;
    setAvail("checking");
    const t = setTimeout(() => {
      getUsernameOwner(v)
        .then((owner) => {
          if (my !== seq.current) return;
          if (!owner) setAvail("available");
          else if (address && owner.toLowerCase() === address.toLowerCase())
            setAvail("mine");
          else setAvail("taken");
        })
        .catch(() => my === seq.current && setAvail("idle"));
    }, 350);
    return () => clearTimeout(t);
  }, [value, current, address]);

  const canSave =
    !!address &&
    normalizeUsername(value) !== (current ?? "") &&
    (avail === "available" || avail === "mine");

  async function save() {
    if (!address) return;
    setSaving(true);
    try {
      const uname = normalizeUsername(value);
      await setUsername({ walletAddress: address, username: uname });
      setCurrent(uname);
      setAvail("idle");
      toast.success(`You're now @${uname}`);
      onSaved?.(uname);
    } catch (e) {
      toast.error("Couldn't set username", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center rounded-md border border-[#1b1833] bg-[#0a0511] focus-within:border-[#ec1b69]/50">
        <span className="pl-2.5 text-[#7975a8]">
          <AtSign className="h-4 w-4" />
        </span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="username"
          className="border-0 bg-transparent focus-visible:ring-0"
          maxLength={20}
        />
        <div className="pr-2">
          {avail === "checking" ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#7975a8]" />
          ) : avail === "available" || avail === "mine" ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#7975a8]">
          {avail === "taken"
            ? "That handle is taken."
            : avail === "invalid"
              ? "3–20 chars: letters, numbers, _ or -."
              : current
                ? `Current: @${current}`
                : address
                  ? `No username — others see ${formatAddress(address)}.`
                  : "Connect a wallet."}
        </span>
        <Button size="sm" onClick={save} disabled={!canSave || saving}>
          {saving ? "Saving…" : current ? "Update" : "Claim"}
        </Button>
      </div>
    </div>
  );
}
