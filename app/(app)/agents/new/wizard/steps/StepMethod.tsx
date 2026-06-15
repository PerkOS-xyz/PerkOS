import { useChainId } from "wagmi";
import { base, celo } from "wagmi/chains";
import { Cloud, Server, UserPlus } from "lucide-react";

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
}: StepProps & { ecsAllowed: boolean }) {
  const chainId = useChainId();
  const networkName =
    chainId === base.id ? "Base" : chainId === celo.id ? "Celo" : null;

  const pick = (method: LaunchMethod) =>
    onChange({ method, deployMode: methodToDeployMode(method) });

  return (
    <div className="flex flex-col gap-4">
      <StepHeader
        title="How do you want to run this agent?"
        description="This is the one choice that shapes the rest. The bridge always dials OUT to PerkOS — no inbound ports needed for any option."
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
          disabled={!ecsAllowed}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  PerkOS infra
                </span>
                {!ecsAllowed ? (
                  <Badge
                    variant="secondary"
                    className="border-amber-500/40 bg-amber-500/15 text-amber-300"
                  >
                    Coming soon
                  </Badge>
                ) : null}
                <Badge variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                  Recommended
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                PerkOS provisions a managed container for your agent. From{" "}
                <span className="font-medium text-foreground">$29/mo</span> billed
                via x402{networkName ? ` on ${networkName}` : ""}. Status flips to
                &ldquo;ready&rdquo; once the container is healthy (~30s).
              </p>
              {!ecsAllowed ? (
                <p className="text-xs text-muted-foreground">
                  Currently invite-only while we test. Pick your VPS or
                  &ldquo;I already have one&rdquo; for now, or contact an admin to
                  be added to the early access list.
                </p>
              ) : null}
            </div>
            <RadioGroupItem value="perkos" id="method-perkos" disabled={!ecsAllowed} />
          </div>
        </SelectableCard>

        <SelectableCard
          selected={state.method === "vps"}
          onClick={() => pick("vps")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-base font-medium text-foreground">
                  Your VPS (self-hosted)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                We generate a docker-compose bundle (runtime + bridge sidecar).
                Run <code className="rounded bg-muted px-1 font-mono text-[11px]">docker compose up -d</code>{" "}
                on any host with Docker — the bridge dials OUT, no inbound ports
                or SSH access needed.
              </p>
            </div>
            <RadioGroupItem value="vps" id="method-vps" />
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
                  I already have an agent
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Already running your own Hermes / OpenClaw / custom agent — with
                its own knowledge? Invite it. PerkOS provisions nothing; you get
                a prompt to hand to your agent so it joins your org and works the
                board with parity to native agents.
              </p>
            </div>
            <RadioGroupItem value="external" id="method-external" />
          </div>
        </SelectableCard>
      </RadioGroup>
    </div>
  );
}
