import { useState } from "react";
import type { Ticket, TicketStatus } from "../../../src/domain/ticket.js";
import { CATEGORY_LABEL, MISSING_FIELD_LABEL, STATUS_LABEL, currentTriage, headline } from "../labels.js";

type Filter = "all" | TicketStatus;

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "awaiting_review", label: STATUS_LABEL.awaiting_review },
  { value: "triage_failed", label: STATUS_LABEL.triage_failed },
  { value: "new", label: STATUS_LABEL.new },
  { value: "reviewed", label: STATUS_LABEL.reviewed },
];

const STATUS_STYLE: Record<TicketStatus, string> = {
  new: "bg-slate-100 text-slate-700",
  awaiting_review: "bg-amber-100 text-amber-800",
  triage_failed: "bg-red-100 text-red-800",
  reviewed: "bg-emerald-100 text-emerald-800",
};

export function TicketList(props: {
  tickets: readonly Ticket[];
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const count = (value: Filter) =>
    value === "all" ? props.tickets.length : props.tickets.filter((t) => t.status === value).length;
  const visible = filter === "all" ? props.tickets : props.tickets.filter((t) => t.status === filter);

  return (
    <section className="flex flex-col gap-3">
      <div role="tablist" aria-label="Filter tickets by status" className="flex flex-wrap gap-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              filter === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">{count(value)}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No tickets in this view.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((ticket) => {
            const triage = currentTriage(ticket);
            const missing = triage?.missingFields ?? [];
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  aria-current={props.selectedId === ticket.id}
                  onClick={() => props.onSelect(ticket.id)}
                  className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-slate-400 ${
                    props.selectedId === ticket.id ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_STYLE[ticket.status]}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                    {triage && <span className="font-medium text-slate-700">{CATEGORY_LABEL[triage.category]}</span>}
                    <span className="ml-auto text-slate-400">{ticket.id}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">{headline(ticket)}</p>
                  {missing.length > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Missing: {missing.map((field) => MISSING_FIELD_LABEL[field]).join(", ")}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
