import { useChainId } from "wagmi";
import { base, celo } from "wagmi/chains";
import { useTranslation } from "react-i18next";
import { Cloud, Loader2, UserPlus } from "lucide-react";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

import type { LaunchMethod, StepProps } from "../types";
import { methodToDeployMode } from "../types";
import { StepHeader } from "../ui/StepHeader";
import { SelectableCard } from "../ui/SelectableCard";

// The root fork. Picking a method also seeds the managed deploy mode so the
// downstream launch mutation keeps reading `deployMode` unchanged; the
// external method clears it (that branch invites instead of launching).
export function StepMethod({
  state,
  onChange,
  ecsAllowed,
  ecsAccessLoading,
}: StepProps & {
  ecsAllowed: boolean;
  ecsAccessLoading: boolean;
  vpsAllowed: boolean;
  vpsAccessLoading: boolean;
}) {
  const { t } = useTranslation();
  const chainId = useChainId();
  const networkName =
    chainId === base.id ? "Base" : chainId === celo.id ? "Celo" : null;
  const onNetwork = networkName
    ? t("wizard.method.perkos.onNetwork", { network: networkName })
    : "";

  const pick = (method: LaunchMethod) =>
    onChange({ method, deployMode: methodToDeployMode(method) });

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title={t("wizard.method.title")}
        description={t("wizard.method.description")}
      />
      <RadioGroup
        value={state.method ?? ""}
        onValueChange={(v) => {
          if (v === "perkos" && !ecsAllowed) return;
          pick(v as LaunchMethod);
        }}
        className="flex flex-col gap-3"
      >
        <SelectableCard
          selected={state.method === "perkos"}
          onClick={() => ecsAllowed && pick("perkos")}
          disabled={ecsAccessLoading || !ecsAllowed}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  {t("wizard.method.perkos.title")}
                </span>
                {ecsAccessLoading ? (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking access
                  </Badge>
                ) : !ecsAllowed ? (
                  <Badge
                    variant="secondary"
                    className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    {t("wizard.method.comingSoon")}
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                  {t("wizard.method.recommended")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("wizard.method.perkos.descLead")}{" "}
                <span className="font-medium text-foreground">$29/mo</span>{" "}
                {t("wizard.method.perkos.descTail", { onNetwork })}
              </p>
              {!ecsAccessLoading && !ecsAllowed ? (
                <p className="text-xs text-muted-foreground">
                  {t("wizard.method.perkos.inviteOnly")}
                </p>
              ) : null}
            </div>
            <RadioGroupItem value="perkos" id="method-perkos" disabled={ecsAccessLoading || !ecsAllowed} />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.method === "external"}
          onClick={() => pick("external")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  {t("wizard.method.external.title")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("wizard.method.external.description")}
              </p>
            </div>
            <RadioGroupItem value="external" id="method-external" />
          </div>
        </SelectableCard>
      </RadioGroup>
    </div>
  );
}
