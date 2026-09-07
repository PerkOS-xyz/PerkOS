"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authedFetch } from "../lib/apiClient";
import { useAppAccount } from "../lib/useAppAccount";
import { useActiveOrg } from "../lib/useActiveOrg";
import {
  type PublishedTemplate,
  type LocalizedText,
  templateText,
  templateAnswerText,
} from "../lib/projectTemplateTypes";

const text = (es: boolean) =>
  es
    ? {
        title: "Templates de proyecto",
        choose: "Configurar proyecto",
        loading: "Cargando…",
        error:
          "No se pudo completar la operación. Revisa los campos o recarga si cambió la versión.",
        retry: "Recargar",
        next: "Continuar",
        back: "Atrás",
        review: "Revisar configuración",
        create: "Crear proyecto configurado",
        saving: "Guardando…",
        optional: "Opcional",
        guard:
          "Configuración inicial: se guardará el proyecto, pero no se creará ni activará un agente. La ejecución Hermes estará disponible después de validar el piloto.",
        language: "Idioma del formulario",
        done: "Configuración guardada",
        open: "Abrir proyecto",
        placeholder: "Selecciona una opción",
      }
    : {
        title: "Project templates",
        choose: "Configure project",
        loading: "Loading…",
        error:
          "Could not complete the request. Check the fields or reload if the revision changed.",
        retry: "Reload",
        next: "Continue",
        back: "Back",
        review: "Review setup",
        create: "Create configured project",
        saving: "Saving…",
        optional: "Optional",
        guard:
          "Initial configuration: the project will be saved, but no agent will be created or activated. Hermes execution will be available after pilot validation.",
        language: "Form language",
        done: "Configuration saved",
        open: "Open project",
        placeholder: "Choose an option",
      };

export function ProjectTemplateGallery() {
  const { address } = useAppAccount();
  const { i18n } = useTranslation();
  const copy = text(i18n.language.startsWith("es"));
  const [catalog, setCatalog] = useState<{
    owner: string;
    templates: {
      id: string;
      name: LocalizedText;
      description: LocalizedText;
    }[];
  } | null>(null);
  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    void authedFetch("/project-templates", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!controller.signal.aborted)
          setCatalog({ owner: address, templates: data.templates });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [address]);
  if (catalog?.owner !== address || !catalog?.templates.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {catalog.templates.map((item) => (
          <article
            className="flex flex-col gap-3 rounded-lg border border-primary/30 p-5"
            key={item.id}
          >
            <h3 className="font-semibold">
              {templateText(item.name, i18n.language)}
            </h3>
            <p className="text-sm text-muted-foreground">
              {templateText(item.description, i18n.language)}
            </p>
            <Link
              className="text-primary underline"
              href={`/projects/templates/${item.id}`}
            >
              {copy.choose}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
export function ProjectTemplateWizard({ templateId }: { templateId: string }) {
  const { address } = useAppAccount();
  return address ? (
    <Wizard key={`${address}:${templateId}`} templateId={templateId} />
  ) : null;
}
function Wizard({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { activeOrgId } = useActiveOrg();
  const [orgId] = useState(activeOrgId);
  // Explicit form-language switch; untranslated questions are not silently mixed into the selected form.
  const [locale, setLocale] = useState(
    i18n.language.startsWith("es") ? "es" : "en",
  );
  const copy = text(locale === "es");
  const [data, setData] = useState<PublishedTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({
    "content-language": i18n.language.split("-")[0],
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [createdId, setCreatedId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void authedFetch(`/project-templates/${encodeURIComponent(templateId)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw Error();
        const next = await res.json();
        if (!controller.signal.aborted) setData(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [templateId]);
  const input =
    "w-full min-w-0 rounded-md border border-border bg-background p-3";
  async function create() {
    if (!data || busy || createdId) return;
    setBusy(true);
    setError(false);
    try {
      const res = await authedFetch(
        `/project-templates/${encodeURIComponent(templateId)}/projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: data.revision,
            answers,
            requestId,
            ...(orgId ? { orgId } : {}),
          }),
        },
      );
      if (!res.ok) throw Error();
      const result = await res.json();
      setCreatedId(result.projectId);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-xl border p-5 sm:p-8">
      <Link href="/projects/new" className="text-sm text-muted-foreground">
        ← {copy.back}
      </Link>
      <label>
        {copy.language}
        <select
          className={input}
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {copy.error}{" "}
          <Button variant="outline" onClick={() => window.location.reload()}>
            {copy.retry}
          </Button>
        </p>
      )}
      {!data && !error && <p role="status">{copy.loading}</p>}
      {data && (
        <>
          <header>
            <h1 className="text-2xl font-semibold">
              {templateText(data.template.name, locale)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {templateText(data.template.description, locale)}
            </p>
          </header>
          <p className="rounded-lg border border-amber-500/30 p-3 text-sm">
            {copy.guard}
          </p>
          {createdId ? (
            <div role="status">
              <p>{copy.done}</p>
              <Button onClick={() => router.push(`/projects/${createdId}`)}>
                {copy.open}
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (step < data.template.steps.length) setStep(step + 1);
                else void create();
              }}
            >
              <p className="text-sm text-muted-foreground">
                {step + 1} / {data.template.steps.length + 1}
              </p>
              {step < data.template.steps.length ? (
                <fieldset
                  disabled={busy}
                  className="flex min-w-0 flex-col gap-4"
                >
                  <legend className="mb-3 font-semibold">
                    {templateText(data.template.steps[step].title, locale)}
                  </legend>
                  {data.template.steps[step].questions.map((q) => {
                    const props = {
                      value: answers[q.id] ?? "",
                      onChange: (
                        e: React.ChangeEvent<
                          | HTMLInputElement
                          | HTMLSelectElement
                          | HTMLTextAreaElement
                        >,
                      ) =>
                        setAnswers((old) => ({
                          ...old,
                          [q.id]: e.target.value,
                        })),
                      required: q.required,
                      className: input,
                    };
                    return (
                      <label className="flex flex-col gap-2" key={q.id}>
                        {templateText(q.label, locale)}
                        {!q.required && (
                          <span className="text-xs">{copy.optional}</span>
                        )}
                        {q.type === "select" ? (
                          <select {...props}>
                            <option value="">{copy.placeholder}</option>
                            {q.options.map((o) => (
                              <option value={o.value} key={o.value}>
                                {templateText(o.label, locale)}
                              </option>
                            ))}
                          </select>
                        ) : q.type === "textarea" ? (
                          <textarea
                            {...props}
                            rows={3}
                            maxLength={q.maxLength}
                          />
                        ) : (
                          <input
                            {...props}
                            type={q.type}
                            maxLength={q.maxLength}
                          />
                        )}
                        {q.help && (
                          <span className="text-xs text-muted-foreground">
                            {templateText(q.help, locale)}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              ) : (
                <div className="space-y-3">
                  <h2 className="font-semibold">{copy.review}</h2>
                  <dl className="space-y-3">
                    {data.template.steps
                      .flatMap((s) => s.questions)
                      .map((q) => (
                        <div key={q.id}>
                          <dt className="text-sm text-muted-foreground">
                            {templateText(q.label, locale)}
                          </dt>
                          <dd className="whitespace-pre-wrap break-words">
                            {templateAnswerText(q, answers[q.id], locale)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  <p className="text-sm">
                    Hermes · 1{" "}
                    {locale === "es"
                      ? "agente previsto, sin activar"
                      : "planned agent, not activated"}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-3">
                {step > 0 ? (
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => setStep(step - 1)}
                  >
                    {copy.back}
                  </Button>
                ) : (
                  <span />
                )}
                <Button disabled={busy} type="submit">
                  {busy
                    ? copy.saving
                    : step < data.template.steps.length
                      ? copy.next
                      : copy.create}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
