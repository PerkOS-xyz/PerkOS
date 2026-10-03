import type { TemplateRolePolicy } from "../lib/projectTemplateTypes";

const labels = {
  en: {
    access: "Knowledge access",
    actions: "Allowed work",
    escalation: "Asks before",
    scopes: {
      personal: "personal knowledge",
      organization: "organization knowledge",
      project: "this project",
      task: "assigned tasks",
    },
    action: {
      read: "read context",
      "propose-knowledge": "propose knowledge",
      "create-task": "create tasks",
      "update-task": "update tasks",
      "create-artifact": "create deliverables",
      "request-approval": "request approval",
    },
    escalations: {
      "sensitive-data": "sensitive information",
      "external-write": "publishing or external changes",
      "financial-commitment": "financial commitments",
      "policy-exception": "work outside its role",
      "human-decision": "decisions reserved for you",
    },
  },
  es: {
    access: "Acceso al conocimiento",
    actions: "Trabajo permitido",
    escalation: "Pregunta antes de",
    scopes: {
      personal: "conocimiento personal",
      organization: "conocimiento de la organización",
      project: "este proyecto",
      task: "tareas asignadas",
    },
    action: {
      read: "leer contexto",
      "propose-knowledge": "proponer conocimiento",
      "create-task": "crear tareas",
      "update-task": "actualizar tareas",
      "create-artifact": "crear entregables",
      "request-approval": "pedir aprobación",
    },
    escalations: {
      "sensitive-data": "usar información sensible",
      "external-write": "publicar o hacer cambios externos",
      "financial-commitment": "asumir compromisos financieros",
      "policy-exception": "trabajar fuera de su rol",
      "human-decision": "tomar decisiones reservadas para ti",
    },
  },
} as const;

export function RoleAccessSummary({
  policy,
  language,
}: {
  policy: TemplateRolePolicy;
  language: string;
}) {
  const copy = language.startsWith("es") ? labels.es : labels.en;
  return (
    <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
      <div>
        <dt className="font-medium text-foreground">{copy.access}</dt>
        <dd>{policy.readScopes.map((scope) => copy.scopes[scope]).join(", ")}</dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">{copy.actions}</dt>
        <dd>{policy.actions.map((action) => copy.action[action]).join(", ")}</dd>
      </div>
      <div>
        <dt className="font-medium text-foreground">{copy.escalation}</dt>
        <dd>{policy.escalation.map((item) => copy.escalations[item]).join(", ")}</dd>
      </div>
    </dl>
  );
}
