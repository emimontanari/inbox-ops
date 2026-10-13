import { useEffect, useState } from "react";
import type { Ticket } from "../../src/domain/ticket.js";
import type { ApiClient } from "./api.js";
import { TicketList } from "./components/TicketList.js";

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; tickets: Ticket[] };

// The API client is injected so tests can render the app without a server.
export function App(props: { api: ApiClient }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    props.api.listTickets().then(
      (tickets) => !cancelled && setState({ kind: "ready", tickets }),
      () => !cancelled && setState({ kind: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [props.api]);

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
        <main className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <TicketList tickets={state.tickets} selectedId={selectedId} onSelect={setSelectedId} />
          <aside className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            {selectedId ? `Selected ${selectedId}. Review panel arrives in the next step.` : "Select a ticket to review it."}
          </aside>
        </main>
      )}
    </div>
  );
}
