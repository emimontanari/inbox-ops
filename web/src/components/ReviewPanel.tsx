import { useState, type SubmitEvent, type ReactNode } from "react";
import { CATEGORIES, isCategory } from "../../../src/domain/category.js";
import type { CorrectionInput, ReviewDecision, ReviewedTicket, Ticket } from "../../../src/domain/ticket.js";
// The same pure domain rule the backend uses: the preview cannot drift from the server.
import { findMissingFields, type ExtractedData, type MissingField } from "../../../src/domain/triage-suggestion.js";
import { ApiError, type ApiClient } from "../api.js";
import { CATEGORY_LABEL, MISSING_FIELD_LABEL, currentTriage } from "../labels.js";
import { assessOrderGrounding } from "../order-grounding.js";

const DECISION_LABEL: Record<ReviewDecision, string> = {
  accepted: "Aceptada",
  corrected: "Corregida",
  manual: "Clasificación manual",
};

const ERROR_MESSAGE: Record<string, string> = {
  not_reviewable: "Esta solicitud ya se revisó. Recarga para ver su estado actual.",
  not_found: "Esta solicitud ya no existe. Recarga la lista.",
  invalid_category: "Elige una categoría válida.",
};

type Draft = { category: string; orderNumber: string; returnReason: string };

export function ReviewPanel(props: {
  ticket: Ticket;
  api: ApiClient;
  onReviewed: (ticket: ReviewedTicket) => void;
  nextTicket?: Ticket | undefined;
  onNext?: () => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const { ticket } = props;
  const triage = currentTriage(ticket);
  const grounding = triage ? assessOrderGrounding(ticket.body, triage.extracted.orderNumber) : undefined;
  const [saving, setSaving] = useState<"accept" | "correct" | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState(ticket.status === "triage_failed");
  const [draft, setDraft] = useState<Draft>(() => initialDraft(ticket));

  function cancelCorrection() {
    setDraft(initialDraft(ticket));
    setError(undefined);
    setEditing(false);
  }

  async function save(action: "accept" | "correct", call: () => Promise<ReviewedTicket>) {
    setSaving(action);
    props.onSavingChange?.(true);
    setError(undefined);
    try {
      props.onReviewed(await call());
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : undefined;
      setError((code && ERROR_MESSAGE[code]) ?? "No se pudo guardar la revisión. Inténtalo de nuevo.");
    } finally {
      setSaving(undefined);
      props.onSavingChange?.(false);
    }
  }

  function submitCorrection(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void save("correct", () => props.api.correct(ticket.id, toCorrection(draft)));
  }

  return (
    <section className="review-panel">
      <div className="panel-heading">
        <h2>Detalle de la solicitud</h2>
        <span className="ticket-id" title={ticket.id}>{ticket.id}</span>
      </div>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mensaje del cliente</h2>
        <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{ticket.body}</p>
      </div>

      {ticket.status === "new" && <p className="text-sm text-slate-500">En espera de clasificación.</p>}

      {ticket.status === "triage_failed" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          No se pudo clasificar esta solicitud ({ticket.triageError}).
        </p>
      )}

      {ticket.status === "awaiting_review" && (
        <Triage title="Sugerencia del modelo" summary={ticket.suggestion.summary} triage={ticket.suggestion} />
      )}

      {ticket.status === "reviewed" && (
        <>
          <p>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {DECISION_LABEL[ticket.review.decision]}
            </span>
          </p>
          <Triage title="Clasificación final" summary={ticket.suggestion?.summary} triage={ticket.review.final} />
        </>
      )}

      {grounding && (
        <aside aria-label="Comprobaciones de revisión" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <h2 className="font-semibold">Antes de confirmar</h2>
          <p className="mt-2">
            {grounding === "not_found"
              ? "El número de pedido no aparece como identificador completo en el mensaje. Revisá si la IA lo inventó o si se agregó después durante la revisión."
              : grounding === "present"
                ? "Aparece en el mensaje, pero eso no confirma que sea un pedido real ni que pertenezca al cliente. Puede ser otro dato o una instrucción incrustada."
                : "No hay número de pedido para contrastar con el mensaje."}
          </p>
          <p className="mt-2">Compará el resumen con el mensaje: quién hizo qué, negaciones, importes y fechas. La fidelidad del resumen no se verifica automáticamente.</p>
        </aside>
      )}

      {ticket.status === "awaiting_review" && !editing && (
        <div className="review-actions">
          <Button primary disabled={saving !== undefined} onClick={() => void save("accept", () => props.api.accept(ticket.id))}>
            {saving === "accept" ? "Guardando…" : "Aceptar sugerencia"}
          </Button>
          <Button disabled={saving !== undefined} onClick={() => setEditing(true)}>
            Corregir
          </Button>
        </div>
      )}

      {ticket.status === "triage_failed" && !editing && (
        <Button disabled={saving !== undefined} onClick={() => { setDraft(initialDraft(ticket)); setError(undefined); setEditing(true); }}>Clasificar manualmente</Button>
      )}

      {ticket.status === "reviewed" && (
        <div className="review-actions">
          <Button disabled={!props.nextTicket || !props.onNext || saving !== undefined} onClick={() => props.onNext?.()}>Siguiente por revisar</Button>
          {!props.nextTicket && <span> No quedan solicitudes pendientes de revisar.</span>}
          <p>Pendientes de toda la bandeja</p>
        </div>
      )}

      {editing && ticket.status !== "reviewed" && (
        <CorrectionForm
          title={ticket.status === "triage_failed" ? "Clasificar manualmente" : "Corregir la sugerencia"}
          draft={draft}
          onChange={setDraft}
          onSubmit={submitCorrection}
          saving={saving !== undefined}
          onCancel={cancelCorrection}
        />
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}

function Triage(props: {
  title: string;
  summary: string | undefined;
  triage: { category: keyof typeof CATEGORY_LABEL; extracted: ExtractedData; missingFields: readonly MissingField[] };
}) {
  const { category, extracted, missingFields } = props.triage;
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</h2>
      {props.summary && <p className="mt-1 text-sm">{props.summary}</p>}
      <dl className="triage-fields">
        <dt className="text-slate-500">Categoría</dt>
        <dd className="font-medium">{CATEGORY_LABEL[category]}</dd>
        <dt className="text-slate-500">Número de pedido</dt>
        <dd>{extracted.orderNumber ?? "—"}</dd>
        <dt className="text-slate-500">Motivo de devolución</dt>
        <dd>{extracted.returnReason ?? "—"}</dd>
      </dl>
      {missingFields.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Falta: {missingFields.map((field) => MISSING_FIELD_LABEL[field]).join(", ")}
        </p>
      )}
    </div>
  );
}

function CorrectionForm(props: {
  title: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const { draft } = props;
  const update = (field: keyof Draft) => (value: string) => props.onChange({ ...draft, [field]: value });
  const missing = isCategory(draft.category) ? findMissingFields(draft.category, toExtracted(draft)) : undefined;

  return (
    <form onSubmit={props.onSubmit} className="flex flex-col gap-3 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold">{props.title}</h2>
      <Field id="category" label="Categoría">
        <select
          id="category"
          value={draft.category}
          disabled={props.saving}
          onChange={(e) => update("category")(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Elige una categoría
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABEL[category]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="order-number" label="Número de pedido">
        <input
          id="order-number"
          value={draft.orderNumber}
          disabled={props.saving}
          onChange={(e) => update("orderNumber")(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </Field>
      <Field id="return-reason" label="Motivo de devolución">
        <input
          id="return-reason"
          value={draft.returnReason}
          disabled={props.saving}
          onChange={(e) => update("returnReason")(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </Field>
      {missing && (
        <p className={`text-xs ${missing.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
          {missing.length > 0
            ? `Aún falta: ${missing.map((field) => MISSING_FIELD_LABEL[field]).join(", ")}`
            : "No falta nada"}
        </p>
      )}
      <div className="review-actions">
        <Button primary type="submit" disabled={props.saving || !isCategory(draft.category)}>
          {props.saving ? "Guardando…" : "Guardar revisión"}
        </Button>
        <Button disabled={props.saving} onClick={props.onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

function Field(props: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={props.id} className="text-xs font-medium text-slate-600">
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={props.primary ? "action-primary" : "action-secondary"}
    >
      {props.children}
    </button>
  );
}

function initialDraft(ticket: Ticket): Draft {
  const extracted = ticket.status === "awaiting_review" ? ticket.suggestion.extracted : {};
  return {
    category: ticket.status === "awaiting_review" ? ticket.suggestion.category : "",
    orderNumber: extracted.orderNumber ?? "",
    returnReason: extracted.returnReason ?? "",
  };
}

// Blank fields mean "not provided", exactly as the API and the domain treat them.
function toExtracted(draft: Draft): ExtractedData {
  const orderNumber = draft.orderNumber.trim();
  const returnReason = draft.returnReason.trim();
  return { ...(orderNumber && { orderNumber }), ...(returnReason && { returnReason }) };
}

function toCorrection(draft: Draft): CorrectionInput {
  return { category: draft.category, extracted: toExtracted(draft) };
}
