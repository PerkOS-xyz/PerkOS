"use client";

import { useTranslation } from "react-i18next";

type Attempt = { phase?: string; result?: unknown; stopReason?: string | null; failureCode?: string };
export function isArtizenUnsuccessful(run: Attempt) {
  return !run.result && (run.failureCode === "runtime-start-failed" ||
    ["failed", "timeout", "operator"].includes(run.stopReason ?? "") || ["settled", "cancelled"].includes(run.phase ?? ""));
}
export function ArtizenFailureLabel() {
  const { i18n } = useTranslation();
  return <span className="text-sm text-destructive">{i18n.language.startsWith("es") ? "Sin resultado" : "Unsuccessful"}</span>;
}
export function ArtizenRunFailure({ run }: { run: Attempt }) {
  const { i18n } = useTranslation(); const es = i18n.language.startsWith("es");
  if (!isArtizenUnsuccessful(run)) return null;
  const reconciled = run.phase === "settled" || run.phase === "cancelled";
  return <div role="alert" className="space-y-1 break-words text-sm text-destructive">
    <p>{run.failureCode === "runtime-start-failed"
      ? (es ? "Hermes no pudo iniciar. No se llamó al modelo ni se creó un borrador." : "Hermes could not start. The model was not called and no draft was created.")
      : (es ? "El intento no produjo un borrador válido." : "The attempt did not produce a valid draft.")}</p>
    <p>{reconciled
      ? (es ? "La reserva se ha conciliado; cualquier costo asignado aparece en el presupuesto." : "The reservation has been reconciled; any allocated cost appears in the budget.")
      : (es ? "La reserva sigue retenida hasta confirmar la parada y el costo." : "The reservation remains held until stop and cost are confirmed.")}</p>
    <p>{es ? "No se volverá a generar automáticamente." : "It will not regenerate automatically."}</p>
  </div>;
}
