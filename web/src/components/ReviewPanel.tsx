import { useState, type FormEvent, type ReactNode } from "react";
import { CATEGORIES, isCategory } from "../../../src/domain/category.js";
import type { CorrectionInput, ReviewDecision, ReviewedTicket, Ticket } from "../../../src/domain/ticket.js";
// The same pure domain rule the backend uses: the preview cannot drift from the server.
import { findMissingFields, type ExtractedData, type MissingField } from "../../../src/domain/triage-suggestion.js";
import { ApiError, type ApiClient } from "../api.js";
import { CATEGORY_LABEL, MISSING_FIELD_LABEL } from "../labels.js";

const DECISION_LABEL: Record<ReviewDecision, string> = {
  accepted: "Accepted",
  corrected: "Corrected",
  manual: "Manual triage",
};

const ERROR_MESSAGE: Record<string, string> = {
  not_reviewable: "This ticket was already reviewed. Reload to see its current state.",
  not_found: "This ticket no longer exists. Reload the list.",
  invalid_category: "Choose a valid category.",
};

type Draft = { category: string; orderNumber: string; returnReason: string };

export function ReviewPanel(props: {
  ticket: Ticket;
  api: ApiClient;
  onReviewed: (ticket: ReviewedTicket) => void;
}) {
  const { ticket } = props;
  const [saving, setSaving] = useState<"accept" | "correct" | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState(ticket.status === "triage_failed");
  const [draft, setDraft] = useState<Draft>(() => initialDraft(ticket));

  async function save(action: "accept" | "correct", call: () => Promise<ReviewedTicket>) {
    setSaving(action);
    setError(undefined);
    try {
      props.onReviewed(await call());
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.code : undefined;
      setError((code && ERROR_MESSAGE[code]) ?? "Could not save the review. Try again.");
    } finally {
      setSaving(undefined);
    }
  }

  function submitCorrection(event: FormEvent) {
    event.preventDefault();
    void save("correct", () => props.api.correct(ticket.id, toCorrection(draft)));
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer message</h2>
        <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{ticket.body}</p>
      </div>

      {ticket.status === "new" && <p className="text-sm text-slate-500">Waiting for triage.</p>}

      {ticket.status === "triage_failed" && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          The model could not triage this request ({ticket.triageError}).
        </p>
      )}

      {ticket.status === "awaiting_review" && (
        <Triage title="Model suggestion" summary={ticket.suggestion.summary} triage={ticket.suggestion} />
      )}

      {ticket.status === "reviewed" && (
        <>
          <p>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {DECISION_LABEL[ticket.review.decision]}
            </span>
          </p>
          <Triage title="Final triage" summary={ticket.suggestion?.summary} triage={ticket.review.final} />
        </>
      )}

      {ticket.status === "awaiting_review" && !editing && (
        <div className="flex gap-2">
          <Button primary disabled={saving !== undefined} onClick={() => void save("accept", () => props.api.accept(ticket.id))}>
            {saving === "accept" ? "Saving…" : "Accept"}
          </Button>
          <Button disabled={saving !== undefined} onClick={() => setEditing(true)}>
            Correct
          </Button>
        </div>
      )}

      {editing && ticket.status !== "reviewed" && (
        <CorrectionForm
          title={ticket.status === "triage_failed" ? "Triage manually" : "Correct the suggestion"}
          draft={draft}
          onChange={setDraft}
          onSubmit={submitCorrection}
          saving={saving === "correct"}
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
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Category</dt>
        <dd className="font-medium">{CATEGORY_LABEL[category]}</dd>
        <dt className="text-slate-500">Order number</dt>
        <dd>{extracted.orderNumber ?? "—"}</dd>
        <dt className="text-slate-500">Return reason</dt>
        <dd>{extracted.returnReason ?? "—"}</dd>
      </dl>
      {missingFields.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Missing: {missingFields.map((field) => MISSING_FIELD_LABEL[field]).join(", ")}
        </p>
      )}
    </div>
  );
}

function CorrectionForm(props: {
  title: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onSubmit: (event: FormEvent) => void;
  saving: boolean;
}) {
  const { draft } = props;
  const update = (field: keyof Draft) => (value: string) => props.onChange({ ...draft, [field]: value });
  const missing = isCategory(draft.category) ? findMissingFields(draft.category, toExtracted(draft)) : undefined;

  return (
    <form onSubmit={props.onSubmit} className="flex flex-col gap-3 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold">{props.title}</h2>
      <Field id="category" label="Category">
        <select
          id="category"
          value={draft.category}
          onChange={(e) => update("category")(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="" disabled>
            Choose a category
          </option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABEL[category]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="order-number" label="Order number">
        <input
          id="order-number"
          value={draft.orderNumber}
          onChange={(e) => update("orderNumber")(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </Field>
      <Field id="return-reason" label="Return reason">
        <input
          id="return-reason"
          value={draft.returnReason}
          onChange={(e) => update("returnReason")(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </Field>
      {missing && (
        <p className={`text-xs ${missing.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
          {missing.length > 0
            ? `Still missing: ${missing.map((field) => MISSING_FIELD_LABEL[field]).join(", ")}`
            : "Nothing missing"}
        </p>
      )}
      <div>
        <Button primary type="submit" disabled={props.saving || !isCategory(draft.category)}>
          {props.saving ? "Saving…" : "Save review"}
        </Button>
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
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        props.primary ? "bg-slate-900 text-white hover:bg-slate-700" : "border border-slate-300 hover:bg-slate-100"
      }`}
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
