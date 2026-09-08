"use client";

export type FormatReview = { contract: "artizen-update-v1"; status: "passed" | "needs-review";
  wordCount: number; paragraphCount: number; issues: ("structured_output_invalid" | "paragraph_count" | "word_count" | "non_prose")[] };

/** Immutable generation assessment, not an assessment of the locally edited
 * textarea, a factuality verdict, or authorization to retry/publish. */
export function ArtizenFormatReview({ review, es, edited = false }: { review?: FormatReview; es: boolean; edited?: boolean }) {
  if (!review || review.contract !== "artizen-update-v1") return null;
  const failed = review.status !== "passed";
  const labels = {
    structured_output_invalid: es ? "La respuesta no respetó el esquema solicitado." : "The response did not follow the requested schema.",
    paragraph_count: es ? "Se requieren exactamente dos párrafos." : "Exactly two paragraphs are required.",
    word_count: es ? "Se requieren entre 90 y 120 palabras en total." : "Between 90 and 120 words are required in total.",
    non_prose: es ? "El texto contiene títulos o listas en lugar de prosa." : "The text contains headings or lists instead of prose.",
  };
  return <div role={failed ? "alert" : "status"} className="space-y-1 rounded-lg border border-border bg-muted/20 p-3 text-sm" aria-label={es ? "Formato del borrador original" : "Original draft format"}>
    <p className="font-medium">{failed ? (es ? "Formato: requiere revisión" : "Format: needs review") : (es ? "Formato: cumple los controles" : "Format: checks passed")}</p>
    <p>{es ? `${review.paragraphCount} párrafos · ${review.wordCount} palabras. Objetivo: 2 párrafos, 90–120 palabras.`
      : `${review.paragraphCount} paragraphs · ${review.wordCount} words. Target: 2 paragraphs, 90–120 words.`}</p>
    {failed && <ul className="list-disc pl-5">{review.issues.map(code => <li key={code}>{labels[code]}</li>)}</ul>}
    <p>{es ? "Control del formato original, no de los hechos. No se volverá a generar automáticamente; puedes editarlo sin otra llamada al modelo."
      : "Checks the original format, not the facts. No automatic regeneration; you can edit without another model call."}</p>
    {edited && <p>{es ? "Has editado el texto. Estos resultados corresponden al borrador original, no a tus cambios."
      : "You edited the text. These results describe the original draft, not your changes."}</p>}
  </div>;
}
