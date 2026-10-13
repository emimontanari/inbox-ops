import { useCallback, useEffect, useState } from "react";
import type { ReviewedTicket, Ticket } from "../../src/domain/ticket.js";
import type { ApiClient } from "./api.js";
import { AddRequests } from "./components/AddRequests.js";
import { ReviewPanel } from "./components/ReviewPanel.js";
import { ReviewStats } from "./components/ReviewStats.js";
import { TicketList } from "./components/TicketList.js";
import { TriageControls } from "./components/TriageControls.js";

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; tickets: Ticket[] };

// The API client is injected so tests can render the app without a server.
export function App(props: { api: ApiClient }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | undefined>();

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
    setState((current) =>
      current.kind === "ready"
        ? { kind: "ready", tickets: current.tickets.map((t) => (t.id === updated.id ? updated : t)) }
        : current,
    );
  }

  const tickets = state.kind === "ready" ? state.tickets : [];
  const selected = tickets.find((t) => t.id === selectedId);
  const count = (status: Ticket["status"]) => tickets.filter((t) => t.status === status).length;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">InboxOps</h1>
        <p className="text-sm text-slate-500">AI-suggested triage for support requests. A person always decides.</p>
      </header>

      {state.kind === "loading" && <p className="text-sm text-slate-500">Loading tickets…</p>}

      {state.kind === "error" && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Could not load tickets. Is the API running? (npm run serve)
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <ReviewStats tickets={tickets} />
          <AddRequests api={props.api} onAdded={() => void reload()} />
          <TriageControls
            api={props.api}
            pending={count("new")}
            failed={count("triage_failed")}
            onDone={() => void reload()}
          />
          <main className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <TicketList tickets={tickets} selectedId={selectedId} onSelect={setSelectedId} />
            <aside>
              {selected ? (
                // key: a different ticket starts with a fresh form, not the previous ticket's draft.
                <ReviewPanel key={selected.id} ticket={selected} api={props.api} onReviewed={replaceTicket} />
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  Select a ticket to review it.
                </p>
              )}
            </aside>
          </main>
        </>
      )}
    </div>
  );
}
