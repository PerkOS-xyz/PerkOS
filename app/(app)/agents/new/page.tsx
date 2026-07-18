"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2, Rocket, UserPlus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { AgentKeyRevealDialog } from "@/app/components/AgentKeyRevealDialog";
import { DeployBundleScreen } from "@/app/components/DeployBundleScreen";

import { useAgentWizard } from "./wizard/useAgentWizard";
import { Stepper } from "./wizard/ui/Stepper";
import { StepMethod } from "./wizard/steps/StepMethod";
import { StepTemplate } from "./wizard/steps/StepTemplate";
import { StepLLM } from "./wizard/steps/StepLLM";
import { StepCapabilities } from "./wizard/steps/StepCapabilities";
import { StepChannels } from "./wizard/steps/StepChannels";
import { StepReview } from "./wizard/steps/StepReview";
import { StepExternal } from "./wizard/steps/StepExternal";

// Thin orchestrator. All state + submit logic lives in useAgentWizard; every
// screen is its own module under ./wizard/steps. The wizard's root fork
// (method) drives which steps render — see stepsForMethod in ./wizard/types.
export default function AddAgentPage() {
  const { t } = useTranslation();
  const w = useAgentWizard();
  const {
    state,
    update,
    visiblePresets,
    ecsAllowed,
    ecsAccessLoading,
    llmAllowed,
    llmAccessLoading,
    vpsAllowed,
    vpsAccessLoading,
    apiKeyError,
    steps,
    stepIndex,
    currentStepKey,
    isFirstStep,
    canAdvance,
    goNext,
    goBack,
    launchMutation,
    inviteMutation,
    inviteResult,
    issuedCredentials,
    issuedBundle,
    closeOverlay,
  } = w;

  const launching = launchMutation.isPending;
  const inviting = inviteMutation.isPending;
  const externalDone = currentStepKey === "external" && inviteResult !== null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/agents"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("wizard.common.goBack")}
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-medium text-foreground">{t("wizard.common.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {state.method
            ? t("wizard.common.stepOf", { current: stepIndex + 1, total: steps.length })
            : t("wizard.common.chooseMethod")}
        </p>
      </div>

      {steps.length > 1 ? <Stepper current={stepIndex + 1} total={steps.length} /> : null}

      <div className="mt-2">
        {currentStepKey === "method" && (
          <StepMethod
            state={state}
            onChange={update}
            ecsAllowed={ecsAllowed}
            ecsAccessLoading={ecsAccessLoading}
            vpsAllowed={vpsAllowed}
            vpsAccessLoading={vpsAccessLoading}
          />
        )}
        {currentStepKey === "template" && (
          <StepTemplate state={state} onChange={update} presets={visiblePresets} />
        )}
        {currentStepKey === "llm" && (
          <StepLLM
            state={state}
            onChange={update}
            apiKeyError={apiKeyError}
            llmAllowed={llmAllowed}
            llmAccessLoading={llmAccessLoading}
          />
        )}
        {currentStepKey === "capabilities" && (
          <StepCapabilities state={state} onChange={update} />
        )}
        {currentStepKey === "channels" && (
          <StepChannels state={state} onChange={update} />
        )}
        {currentStepKey === "review" && <StepReview state={state} onChange={update} />}
        {currentStepKey === "external" && (
          <StepExternal state={state} onChange={update} result={inviteResult} />
        )}
      </div>

      <Separator />

      {externalDone ? (
        <div className="flex items-center justify-end">
          <Link href="/agents" className={buttonVariants()}>
            {t("wizard.common.doneBackToAgents")}
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={isFirstStep || launching || inviting}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("wizard.common.back")}
          </Button>

          {currentStepKey === "review" ? (
            <Button onClick={() => launchMutation.mutate()} disabled={!canAdvance} className="gap-2">
              {launching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {launching ? t("wizard.common.launching") : t("wizard.common.launch")}
            </Button>
          ) : currentStepKey === "external" ? (
            <Button onClick={() => inviteMutation.mutate()} disabled={!canAdvance} className="gap-2">
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {inviting
                ? t("wizard.common.creatingInvitation")
                : t("wizard.common.generateInvitation")}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!canAdvance}>
              {t("wizard.common.continue")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <AgentKeyRevealDialog
        open={!!issuedCredentials}
        credentials={issuedCredentials}
        onClose={closeOverlay}
      />

      {issuedBundle ? (
        <DeployBundleScreen
          bundle={issuedBundle.bundle}
          agentId={issuedBundle.agentId}
          agentName={issuedBundle.agentName}
          deployMode={issuedBundle.deployMode}
          relayApiKey={issuedBundle.relayApiKey}
          installCommand={issuedBundle.installCommand}
          onDone={closeOverlay}
        />
      ) : null}
    </div>
  );
}
