import { useState, type ChangeEvent } from "react";
import type { AddRequestsResult } from "../../../src/application/inbox.js";
import type { ApiClient } from "../api.js";
import { parseRequestsCsv, type CsvRequest } from "../csv.js";

// Must match the API's per-request limit (MAX_REQUESTS_PER_BATCH in src/http/app.ts).
const BATCH_SIZE = 200;

const REJECTION_LABEL: Record<AddRequestsResult["rejected"][number]["error"], string> = {
  empty_id: "identificador vacío",
  empty_body: "mensaje vacío",
  body_too_long: "mensaje demasiado largo",
  duplicate_id: "identificador duplicado",
  invalid_received_at: "fecha de recepción inválida (usa ISO con zona horaria)",
  future_received_at: "fecha de recepción en el futuro",
};

type Feedback = { kind: "status" | "error"; text: string };

export function AddRequests(props: { api: ApiClient; onAdded: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | undefined>();

  async function send(requests: CsvRequest[]): Promise<boolean> {
    setBusy(true);
    setFeedback(undefined);
    try {
      const result: AddRequestsResult = { added: [], rejected: [] };
      for (let start = 0; start < requests.length; start += BATCH_SIZE) {
        const batch = await props.api.addRequests(requests.slice(start, start + BATCH_SIZE));
        result.added.push(...batch.added);
        result.rejected.push(...batch.rejected.map((r) => ({ ...r, index: r.index + start })));
      }
      setFeedback({ kind: "status", text: describe(result) });
      props.onAdded();
      return true;
    } catch {
      setFeedback({ kind: "error", text: "No se pudieron añadir las solicitudes. ¿Está en marcha la API?" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addMessage() {
    if (await send([{ body: message }])) setMessage("");
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const parsed = parseRequestsCsv(await file.text());
    input.value = "";
    if (!parsed.ok) {
      setFeedback({ kind: "error", text: parsed.error });
      return;
    }
    await send(parsed.value);
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="new-message" className="text-xs font-medium text-slate-600">
          Mensaje del cliente
        </label>
        <textarea
          id="new-message"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || message.trim() === ""}
          onClick={() => void addMessage()}
          className="action-primary"
        >
          Añadir solicitud
        </button>
        <label className="csv-import action-secondary">
          Importar CSV
          <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => void importCsv(e)} className="sr-only" />
        </label>
        <span className="text-xs text-slate-600">Columnas del CSV: body (obligatoria), id y receivedAt (opcionales). Fecha ISO con zona horaria; sin fecha, cuenta desde la importación.</span>
      </div>
      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`text-sm ${feedback.kind === "error" ? "text-red-700" : "text-slate-700"}`}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}

function describe(result: AddRequestsResult): string {
  const added = result.added.length === 1 ? "Se añadió 1 solicitud." : `Se añadieron ${result.added.length} solicitudes.`;
  if (result.rejected.length === 0) return added;
  const details = result.rejected
    .map((r) => `#${r.index + 1} (${r.id}) ${REJECTION_LABEL[r.error]}`)
    .join(", ");
  return `${added} Rechazadas ${result.rejected.length}: ${details}.`;
}
