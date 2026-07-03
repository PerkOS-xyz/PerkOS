"use client";

/**
 * Settings → Profile picture. Lets the user pick which avatar they show
 * (ENS / Basename — auto-resolved on login — / a custom upload / the generated
 * default) and upload a custom image. Writes go straight to the owner-only
 * profile doc, mirroring UsernameCard's client-write pattern.
 */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useWalletSession } from "../lib/useWalletSession";
import { useUserProfile } from "../lib/useUserProfile";
import {
  availableAvatarSources,
  clearCustomAvatar,
  effectiveAvatarUrl,
  setAvatarSource,
  setCustomAvatar,
  type AvatarSource,
} from "../lib/perkosApi";
import { uploadAvatar } from "../lib/uploadAvatar";
import { UserAvatar } from "./UserAvatar";

const SOURCE_LABEL: Record<AvatarSource, string> = {
  ens: "settings.avatar.sourceEns",
  basename: "settings.avatar.sourceBasename",
  custom: "settings.avatar.sourceCustom",
  default: "settings.avatar.sourceDefault",
};

export function ProfileAvatarCard() {
  const { t } = useTranslation();
  const session = useWalletSession();
  const address = session.address;
  const qc = useQueryClient();
  const { data: profile } = useUserProfile(address);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const sources = availableAvatarSources(profile);
  const current: AvatarSource = profile?.avatarSource ?? "default";
  const previewUrl = effectiveAvatarUrl(profile);
  const hasOnchain = !!profile?.ensAvatarUrl || !!profile?.basenameAvatarUrl;

  function invalidate() {
    if (!address) return;
    qc.invalidateQueries({ queryKey: ["user-profile", address.toLowerCase()] });
    qc.invalidateQueries({ queryKey: ["user-profiles"] });
  }

  async function pick(source: AvatarSource) {
    if (!address || source === current) return;
    setBusy(true);
    try {
      await setAvatarSource({ walletAddress: address, source });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !address) return;
    setBusy(true);
    try {
      const url = await uploadAvatar({ file, walletAddress: address });
      await setCustomAvatar({ walletAddress: address, url });
      invalidate();
      toast.success(t("settings.avatar.updated"));
    } catch (e) {
      toast.error(t("settings.avatar.uploadFailed"), {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeCustom() {
    if (!address) return;
    setBusy(true);
    try {
      await clearCustomAvatar({ walletAddress: address, profile });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <UserAvatar address={address} avatarUrl={previewUrl} size={56} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onFile}
              className="hidden"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy || !address}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {t("settings.avatar.upload")}
            </Button>
            {profile?.avatarCustomUrl ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                disabled={busy}
                onClick={removeCustom}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("settings.avatar.remove")}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.avatar.hint")}
          </p>
        </div>
      </div>

      {/* Source picker */}
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => pick(s)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              s === current
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/40"
            )}
          >
            {t(SOURCE_LABEL[s])}
          </button>
        ))}
      </div>

      {!hasOnchain ? (
        <p className="text-xs text-muted-foreground">
          {t("settings.avatar.noOnchain")}
        </p>
      ) : null}
    </div>
  );
}
