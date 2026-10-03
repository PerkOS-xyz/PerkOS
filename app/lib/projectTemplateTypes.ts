export type LocalizedText = {
  en: string;
  es: string;
  [language: string]: string;
};
export type TemplateQuestion = {
  id: string;
  label: LocalizedText;
  help?: LocalizedText;
  type: "text" | "textarea" | "url" | "select";
  required: boolean;
  maxLength: number;
  validation: "none" | "artizen-url";
  options: { value: string; label: LocalizedText }[];
};

export type KnowledgeScope = "personal" | "organization" | "project" | "task";
export type KnowledgeNodeType =
  | "user-profile"
  | "organization-policy"
  | "project-brief"
  | "source"
  | "fact"
  | "assumption"
  | "decision"
  | "approval"
  | "task"
  | "artifact"
  | "result"
  | "conversation-summary";
export type RoleAction =
  | "read"
  | "propose-knowledge"
  | "create-task"
  | "update-task"
  | "create-artifact"
  | "request-approval";
export type EscalationCondition =
  | "sensitive-data"
  | "external-write"
  | "financial-commitment"
  | "policy-exception"
  | "human-decision";

export type TemplateRolePolicy = {
  readScopes: KnowledgeScope[];
  readNodeTypes: KnowledgeNodeType[];
  actions: RoleAction[];
  escalation: EscalationCondition[];
};

export type TemplateTeamRole = {
  roleId: string;
  name: LocalizedText;
  responsibility: LocalizedText;
  presetId?: string;
  isLead: boolean;
  order: number;
  policy: TemplateRolePolicy;
  avatarSeed: string;
};

export type ProjectTemplate = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  steps: { id: string; title: LocalizedText; questions: TemplateQuestion[] }[];
  agent: {
    runtime: "Hermes";
    name: string;
    soul: string;
    instructions: string;
    skill: string;
  };
  actions: ["prepare-update", "revise-update", "save-approved-update"];
  delivery: "draft-only";
  team: TemplateTeamRole[];
};
export type PublishedTemplate = {
  template: ProjectTemplate;
  revision: number;
  activation: "configuration-only";
};
export function templateText(text: LocalizedText, language: string) {
  return text[language.split("-")[0]] ?? text.en;
}

/** Display an answer without changing its canonical stored value. */
export function templateAnswerText(
  question: TemplateQuestion,
  value: string | undefined,
  language: string,
) {
  if (!value) return "—";
  const option = question.type === "select"
    ? question.options.find((entry) => entry.value === value)
    : undefined;
  return option ? templateText(option.label, language) : value;
}
