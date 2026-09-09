"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { authedFetch } from "../lib/apiClient";
import { useAppAccount } from "../lib/useAppAccount";
import { ArtizenCreatorWorkflow } from "./ArtizenCreatorWorkflow";
import {
  type ProjectTemplate,
  templateText,
  templateAnswerText,
} from "../lib/projectTemplateTypes";

export function ProjectTemplateConfiguration({
  projectId,
}: {
  projectId: string;
}) {
  const { address } = useAppAccount();
  const { i18n } = useTranslation();
  const [result, setResult] = useState<{
    key: string;
    template: ProjectTemplate;
    answers: Record<string, string>;
    revision: number;
  } | null>(null);
  const [errorKey, setErrorKey] = useState("");
  const key = `${address}:${projectId}`;
  useEffect(() => {
    if (!address || !projectId.startsWith("template-")) return;
    const controller = new AbortController();
    void authedFetch(
      `/project-template-instances/${encodeURIComponent(projectId)}`,
      { signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) throw Error();
        const data = await res.json();
        if (!controller.signal.aborted) setResult({ ...data, key });
      })
      .catch(() => {
        if (!controller.signal.aborted) setErrorKey(key);
      });
    return () => controller.abort();
  }, [address, projectId, key]);
  const es = i18n.language.startsWith("es");
  if (!projectId.startsWith("template-")) return null;
  if (errorKey === key)
    return (
      <p role="alert">
        {es
          ? "No se pudo cargar la configuración del template."
          : "Could not load template configuration."}
      </p>
    );
  if (!result || result.key !== key) return null;
  return (
    <section className="rounded-xl border border-primary/30 p-5">
      <h2 className="font-semibold">
        {templateText(result.template.name, i18n.language)} · r{result.revision}
      </h2>
      <p className="my-3 text-sm text-muted-foreground">
        {es
          ? "Configuración guardada. Las tareas recurrentes no están activadas."
          : "Configuration saved. Recurring tasks are not enabled."}
      </p>
      <details>
        <summary>
          {es ? "Ver respuestas del proyecto" : "View project answers"}
        </summary>
        <dl className="mt-3 space-y-3">
          {result.template.steps
            .flatMap((s) => s.questions)
            .map((q) => (
              <div key={q.id}>
                <dt className="text-sm text-muted-foreground">
                  {templateText(q.label, i18n.language)}
                </dt>
                <dd className="whitespace-pre-wrap break-words">
                  {templateAnswerText(q, result.answers[q.id], i18n.language)}
                </dd>
              </div>
            ))}
        </dl>
      </details>
      {result.template.id === "artizen-creator-update" && <ArtizenCreatorWorkflow key={key} projectId={projectId} />}
    </section>
  );
}
