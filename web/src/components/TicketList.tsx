import { useState } from "react";
import { assessSla } from "../../../src/domain/sla.js";
import { compareByDeadline } from "../sla-order.js";
import { useClock } from "../use-clock.js";
import { SlaBadge } from "./SlaBadge.js";
import type { Ticket, TicketStatus } from "../../../src/domain/ticket.js";
import { CATEGORIES, type Category } from "../../../src/domain/category.js";
import { CATEGORY_LABEL, MISSING_FIELD_LABEL, STATUS_LABEL, currentTriage, headline } from "../labels.js";

type Filter = "all" | TicketStatus;

// Normalize only for matching; never rewrite the customer's text or stored data.
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: "all", label: "Todas" },
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
  nowMs?: number;
  selectedId?: string | undefined;
  onSelect: (id: string) => void;
}) {
  const clock = useClock();
  const nowMs = props.nowMs ?? clock;
  const [slaFilter, setSlaFilter] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const count = (value: Filter) =>
    value === "all" ? props.tickets.length : props.tickets.filter((t) => t.status === value).length;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all" | "unclassified">("all");
  const [order, setOrder] = useState<"deadline" | "oldest" | "newest">("deadline");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const normalizedQuery = normalize(query.trim());
  const visible = props.tickets.filter((ticket) => {
    const triage = currentTriage(ticket);
    const matchesCategory = category === "all" || (category === "unclassified" ? !triage : triage?.category === category);
    const searchable = [ticket.id, ticket.body, headline(ticket), triage?.extracted.orderNumber, triage?.extracted.returnReason];
    const sla = assessSla(ticket, nowMs);
    const matchesSla = slaFilter === "all" || (!sla.completed && (slaFilter === "urgent" ? sla.status !== "on_time" : sla.status === slaFilter));
    return matchesSla && (filter === "all" || ticket.status === filter) && matchesCategory
      && (!onlyMissing || (triage?.missingFields.length ?? 0) > 0)
      && searchable.some((text) => normalize(text ?? "").includes(normalizedQuery));
  }).sort((a, b) => {
    if (order === "deadline") return compareByDeadline(a, b);
    const byReceived = Date.parse(a.receivedAt) - Date.parse(b.receivedAt);
    return (order === "oldest" ? byReceived : -byReceived) || a.id.localeCompare(b.id);
  });
  const hasFilters = query !== "" || category !== "all" || filter !== "all" || onlyMissing || slaFilter !== "all";

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setFilter("all");
    setOnlyMissing(false);
    setSlaFilter("all");
  }

  return (
    <section className="ticket-list" aria-label="Solicitudes">
      <div className="panel-heading">
        <h2>Solicitudes</h2>
        <span aria-live="polite" aria-atomic="true">{visible.length} de {props.tickets.length} solicitudes</span>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Buscar solicitudes
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Texto, ID o número de pedido" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Filtrar por categoría
          <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Todas las categorías</option>
            {CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABEL[value]}</option>)}
            <option value="unclassified">Sin clasificar</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Ordenar solicitudes
          <select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}
            className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="deadline">Vencimiento más cercano</option>
            <option value="oldest">Más antiguas primero</option>
            <option value="newest">Más recientes primero</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Filtrar por SLA
          <select value={slaFilter} onChange={event => setSlaFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Todos los plazos</option>
            <option value="urgent">Pendientes urgentes</option>
            <option value="due_soon">Pendientes por vencer</option>
            <option value="overdue">Pendientes vencidos</option>
            <option value="on_time">Pendientes a tiempo</option>
          </select>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)}
            aria-describedby="missing-data-scope" className="h-5 w-5 shrink-0 accent-indigo-600" />
          Solo con datos faltantes
        </label>
        <p id="missing-data-scope" className="text-xs text-slate-600">Incluye datos faltantes detectados en la clasificación actual; excluye solicitudes nuevas o fallidas sin clasificar.</p>
        <button type="button" className="action-secondary self-start" disabled={!hasFilters} onClick={clearFilters}>Limpiar filtros</button>
      </div>
      <p className="text-xs text-slate-600">SLA interno hasta revisión humana, en horas corridas; no mide envío de respuesta. Se actualiza cada 30 s. Sin clasificación: 24 h provisionales.</p>
      <p className="text-xs text-slate-600">Los conteos por estado corresponden a toda la bandeja.</p>
      <div role="group" aria-label="Filtrar solicitudes por estado" className="status-filters">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className="filter-button"
          >
            {label}
            <span className="ml-1.5 text-xs opacity-70">{count(value)}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No hay solicitudes en esta vista.{hasFilters && " Probá otra búsqueda o limpiá los filtros."}
        </p>
      ) : (
        <ul className="ticket-items">
          {visible.map((ticket) => {
            const triage = currentTriage(ticket);
            const missing = triage?.missingFields ?? [];
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  aria-current={props.selectedId === ticket.id}
                  onClick={() => props.onSelect(ticket.id)}
                  className="ticket-card"
                >
                  <div className="ticket-meta">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_STYLE[ticket.status]}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                    {triage && <span className="font-medium text-slate-700">{CATEGORY_LABEL[triage.category]}</span>}
                    <span className="ticket-id" title={ticket.id}>{ticket.id}</span>
                  </div>
                  <SlaBadge ticket={ticket} nowMs={nowMs} />
                  <p className="ticket-headline">{headline(ticket)}</p>
                  {missing.length > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      Falta: {missing.map((field) => MISSING_FIELD_LABEL[field]).join(", ")}
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
