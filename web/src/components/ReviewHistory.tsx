import { compareReview, type ReviewField, type ReviewValue } from "../../../src/domain/review-comparison.js";
import type { ReviewedTicket } from "../../../src/domain/ticket.js";
import { CATEGORY_LABEL, MISSING_FIELD_LABEL } from "../labels.js";

const FIELD_LABEL: Record<ReviewField, string> = {
  category: "Categoría", orderNumber: "Número de pedido", returnReason: "Motivo de devolución", missingFields: "Datos faltantes (derivados)",
};
const DECISION_LABEL = { accepted: "Aceptación de sugerencia", corrected: "Corrección humana", manual: "Clasificación manual" };

export function ReviewHistory(props: { ticket: ReviewedTicket }) {
  const { ticket } = props;
  const comparison = compareReview(ticket);
  return (
    <section aria-label="Historial de revisión" className="flex min-w-0 flex-col gap-3 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold">Historial de revisión</h2>
      <p className="text-sm font-medium">{DECISION_LABEL[ticket.review.decision]}</p>
      <p className="text-xs text-slate-600">Revisión guardada: <time dateTime={ticket.review.reviewedAt}>{new Date(ticket.review.reviewedAt).toLocaleString("es")}</time></p>
      <p className="text-xs text-slate-600">Una decisión guardada por solicitud. No registra versiones anteriores ni identifica al operador. Revisar no significa enviar una respuesta.</p>
      {!comparison.hasOriginal ? (
        <p className="rounded-md bg-slate-50 p-2 text-sm">No hay sugerencia original guardada para comparar. Los valores finales son la clasificación registrada, no correcciones de una propuesta de IA.</p>
      ) : !comparison.rows.some(row => row.changed) ? (
        <p className="text-sm text-slate-600">Sin cambios en los campos comparados.</p>
      ) : null}
      {ticket.triageError && <p className="text-xs text-slate-600">Error de clasificación guardado: {ticket.triageError}</p>}
      {ticket.suggestion && (
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <h3 className="font-medium">Resumen original del modelo (no editable en la revisión)</h3>
          <p className="mt-1 whitespace-pre-wrap break-words">{ticket.suggestion.summary}</p>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        {comparison.rows.map(row => (
          <div key={row.field} role="group" aria-label={FIELD_LABEL[row.field]} className={`min-w-0 rounded-md border p-3 text-sm ${row.changed ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-medium">{FIELD_LABEL[row.field]}</h3>
              {row.changed !== undefined && <span className="text-xs">{row.changed ? "Modificado" : "Sin cambios"}</span>}
            </div>
            <dl className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
              <div className="min-w-0"><dt className="text-xs text-slate-500">Sugerencia original</dt><dd className="whitespace-pre-wrap break-words">{comparison.hasOriginal ? formatValue(row.field, row.before) : "Sin sugerencia"}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-slate-500">Clasificación final</dt><dd className="whitespace-pre-wrap break-words">{formatValue(row.field, row.after)}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatValue(field: ReviewField, value: ReviewValue): string {
  if (value === undefined || value === "") return "No informado";
  if (typeof value !== "string") return value.length === 0 ? "Ninguno" : value.map(item => MISSING_FIELD_LABEL[item]).join(", ");
  return field === "category" ? (CATEGORY_LABEL[value as keyof typeof CATEGORY_LABEL] ?? value) : value;
}
