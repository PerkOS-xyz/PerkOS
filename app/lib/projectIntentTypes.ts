export type ProjectIntentStatus = "draft" | "confirmed" | "consumed";
export type IntentFactProvenance = "user" | "sparky";
export type IntentFactConfirmation = "confirmed" | "proposed" | "rejected";

export type IntentFact = {
  id: string;
  text: string;
  provenance: IntentFactProvenance;
  confirmation: IntentFactConfirmation;
};

export type ProjectIntent = {
  id: string;
  owner: string;
  orgId: string | null;
  status: ProjectIntentStatus;
  revision: number;
  goal: string;
  successCriteria: string[];
  businessContext: string;
  constraints: string[];
  deadline: string | null;
  budget: string | null;
  proposedKnowledgeSources: string[];
  confirmedFacts: IntentFact[];
  assumptions: IntentFact[];
  recommendedTemplateId: string | null;
  recommendationReason: string;
  createdAt: string;
  updatedAt: string;
};
