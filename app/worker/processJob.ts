/**
 * Per-job processing logic, run by the worker. This is everything
 * that used to live inline inside POST /api/agents/launch (LLM
 * gateway registration + ECS provisioning + Firestore writes back
 * to the agent doc), but with log entries written to
 * /provision_jobs/{jobId}/log/* as each step happens.
 *
 * All side effects are idempotent at the resource level:
 *   - registerLlmAgent overwrites the gateway-side key for the same
 *     agent name (we record only the last4 anyway)
 *   - provisionEcsAgent updates the existing ECS service if present
 *
 * A retry of the same job will just refresh these resources. The
 * relayApiKey on the agent doc is set by /api/agents/launch and
 * untouched here.
 */

import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../lib/firebaseAdmin";
import { provisionEcsAgent } from "../lib/ecsProvision";
import { registerLlmAgent } from "../lib/llmAgentRegistry";
import { getMetrics } from "../lib/metrics";
import {
  appendLog,
  completeJob,
  failJob,
  markRunning,
  type ProvisionJob,
} from "../lib/provisionJobs";

export async function processJob(job: ProvisionJob): Promise<void> {
  const { jobId, agentName, walletAddress, agentId, input } = job;
  const db = adminDb();
  const agentRef = db
    .collection("wallets")
    .doc(walletAddress)
    .collection("agents")
    .doc(agentId);

  try {
    await markRunning(jobId);
    await appendLog(
      jobId,
      "info",
      `Provisioning ${input.runtime} agent "${agentName}" (attempt ${job.attempts})`,
    );

    // ---- 1. LLM gateway key ---------------------------------------
    let perkosLlmApiKey: string | undefined;
    let llmKeyLast4: string | undefined;
    let byokApiKey: string | undefined;

    if (input.llmSource === "byok") {
      // Fetch the user-provided key from agent_secrets. The plaintext
      // never travels through the job doc — the launch API stores it
      // in agent_secrets and the worker reads it here with admin SDK
      // privileges.
      const secretSnap = await db
        .collection("agent_secrets")
        .doc(walletAddress)
        .collection("agents")
        .doc(agentId)
        .get();
      byokApiKey = (secretSnap.data()?.modelKey as string | undefined) ?? undefined;
      if (!byokApiKey) {
        throw new Error(
          "BYOK requested but no modelKey found in agent_secrets",
        );
      }
      await appendLog(
        jobId,
        "info",
        `LLM source: BYOK (skipping gateway registration)`,
      );
    } else {
      await appendLog(jobId, "info", `Registering with PerkOS LLM gateway…`);
      try {
        const registered = await registerLlmAgent(agentName);
        perkosLlmApiKey = registered.key;
        llmKeyLast4 = registered.last4;
        await appendLog(
          jobId,
          "ok",
          `LLM gateway key issued (last4: ${registered.last4})`,
        );
        await agentRef.set(
          {
            llmRegistration: {
              status: "ok",
              last4: registered.last4,
              registeredAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // LLM-registration failure is recoverable in principle (the
        // ECS task will start without a key and 401 on LLM calls).
        // We log it but proceed with provisioning so the user at
        // least has the runtime + transport wiring.
        await appendLog(
          jobId,
          "warn",
          `LLM gateway registration failed: ${message.slice(0, 200)}`,
        );
        await agentRef.set(
          {
            llmRegistration: {
              status: "failed",
              error: message.slice(0, 500),
              attemptedAt: FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
      }
    }

    // ---- 2. ECS provisioning --------------------------------------
    await appendLog(
      jobId,
      "info",
      `Provisioning ECS service (image tag: ${input.imageTag})…`,
    );
    const ecsResult = await provisionEcsAgent({
      walletAddress,
      agentName,
      runtime: input.runtime,
      imageTag: input.imageTag,
      llmSource: input.llmSource,
      byokApiKey,
      perkosLlmApiKey,
      agentId,
    });
    await appendLog(jobId, "ok", `ECS task definition: ${ecsResult.taskDefinitionArn}`);
    await appendLog(jobId, "ok", `ECS service: ${ecsResult.serviceArn}`);

    await agentRef.set(
      {
        ecs: {
          serviceArn: ecsResult.serviceArn,
          taskDefinitionArn: ecsResult.taskDefinitionArn,
          imageUri: ecsResult.imageUri,
          provisionedAt: FieldValue.serverTimestamp(),
        },
        status: "provisioning",
      },
      { merge: true },
    );

    // ---- 3. Done ---------------------------------------------------
    await appendLog(jobId, "ok", `Provisioning complete`);
    await completeJob(jobId, {
      serviceArn: ecsResult.serviceArn,
      taskDefinitionArn: ecsResult.taskDefinitionArn,
      imageUri: ecsResult.imageUri,
      llmKeyLast4,
    });
    getMetrics().agentProvisionedTotal.inc({
      runtime: input.runtime,
      result: "success",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await appendLog(jobId, "error", `Provisioning failed: ${message.slice(0, 200)}`);
    await failJob(jobId, message);
    await agentRef.set(
      {
        ecs: {
          lastError: message.slice(0, 500),
          lastErrorAt: FieldValue.serverTimestamp(),
        },
        status: "provision-failed",
      },
      { merge: true },
    );
    getMetrics().agentProvisionedTotal.inc({
      runtime: input.runtime,
      result: "error",
    });
  }
}
