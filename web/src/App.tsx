import { useCallback, useEffect, useState } from "react";
import type { ReviewedTicket, Ticket } from "../../src/domain/ticket.js";
import type { ApiClient } from "./api.js";
import { AddRequests } from "./components/AddRequests.js";
import { ReviewPanel } from "./components/ReviewPanel.js";
import { ReviewStats } from "./components/ReviewStats.js";
import { TicketList } from "./components/TicketList.js";
import { compareByDeadline } from "./sla-order.js";
import { TriageControls } from "./components/TriageControls.js";

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; tickets: Ticket[] };

// The API client is injected so tests can render the app without a server.
export function App(props: { api: ApiClient }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewConfirmation, setReviewConfirmation] = useState<string | undefined>();

  // Reloads keep the current list on screen; only the first load shows "Loading".
  const reload = useCallback(async () => {
    try {
      setState({ kind: "ready", tickets: await props.api.listTickets() });
    } catch {
      setState({ kind: "error" });
    }
  }, [props.api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // The server's answer is the source of truth: replace the ticket with what it returned.
  function replaceTicket(updated: ReviewedTicket) {
    const decision = updated.review.decision;
    const labels = { accepted: "aceptada", corrected: "corregida", manual: "clasificada manualmente" };
    setReviewConfirmation(`Solicitud ${updated.id}: decisión ${labels[decision]}.`);
    setState((current) =>
      current.kind === "ready"
        ? { kind: "ready", tickets: current.tickets.map((t) => (t.id === updated.id ? updated : t)) }
        : current,
    );
  }

  const tickets = state.kind === "ready" ? state.tickets : [];
  const selected = tickets.find((t) => t.id === selectedId);
  const count = (status: Ticket["status"]) => tickets.filter((t) => t.status === status).length;
  const nextTicket = selected?.status === "reviewed"
    ? tickets.filter((ticket) => ticket.id !== selected.id && ticket.status === "awaiting_review").sort(compareByDeadline)[0]
    : undefined;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">Ir a la bandeja</a>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">IO</span>
          <div>
            <h1>InboxOps</h1>
            <p>Tu espacio de soporte</p>
          </div>
        </div>
        <p className="human-badge">IA propone · vos decidís</p>
      </header>

      {state.kind === "loading" && <p className="text-sm text-slate-500">Cargando solicitudes…</p>}

      {state.kind === "error" && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          No se pudieron cargar las solicitudes. ¿Está en marcha la API? (npm run serve)
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">Atención al cliente</p>
              <h2>Bandeja de soporte</h2>
              <p>Revisá cada sugerencia antes de confirmar. No se envían respuestas automáticas.</p>
            </div>
            <span className="pending-badge">{count("awaiting_review")} por revisar</span>
          </div>
          <ReviewStats tickets={tickets} />
          {reviewConfirmation && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{reviewConfirmation}</p>}
          <section className="triage-toolbar" aria-label="Clasificación de solicitudes">
            <TriageControls
              api={props.api}
              pending={count("new")}
              failed={count("triage_failed")}
              onDone={() => void reload()}
            />

          </section>
          <main id="workspace" tabIndex={-1} aria-label="Bandeja de soporte" className="workspace-grid">
            <TicketList tickets={tickets} selectedId={selectedId} onSelect={(id) => { if (!reviewSaving) setSelectedId(id); }} />
            <section aria-label="Revisión de solicitud" className="review-workspace">
              {selected ? (
                // key: a different ticket starts with a fresh form, not the previous ticket's draft.
                <ReviewPanel key={selected.id} ticket={selected} api={props.api} onReviewed={replaceTicket}
                  onSavingChange={setReviewSaving} nextTicket={nextTicket}
                  onNext={() => { if (nextTicket && !reviewSaving) setSelectedId(nextTicket.id); }} />
              ) : (
                <div className="empty-review">
                  <span className="empty-mark" aria-hidden="true">↗</span>
                  <h2>Una decisión a la vez</h2>
                  <p>Seleccioná una solicitud de la bandeja para comparar el mensaje con la sugerencia de IA.</p>
                  {tickets.length === 0 && <p>Para empezar, agregá un mensaje o importá un CSV más abajo.</p>}
                </div>
              )}
            </section>
          </main>
          <details className="intake-panel" open>
            <summary>Agregar solicitudes</summary>
            <p className="intake-hint">Escribí un mensaje o importá varias solicitudes. Después, elegí cuándo clasificarlas.</p>
            <AddRequests api={props.api} onAdded={() => void reload()} />
          </details>
        </>
      )}
    </div>
  );
}
