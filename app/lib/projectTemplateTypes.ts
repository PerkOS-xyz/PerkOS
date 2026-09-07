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
