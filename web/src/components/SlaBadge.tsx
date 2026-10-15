import { assessSla } from "../../../src/domain/sla.js";
import type { Ticket } from "../../../src/domain/ticket.js";
const LABEL = { on_time: "A tiempo", due_soon: "Por vencer", overdue: "Vencido" };
const STYLE = { on_time: "bg-emerald-50 text-emerald-800", due_soon: "bg-amber-50 text-amber-900", overdue: "bg-red-50 text-red-800" };
function duration(ms: number): string {
  const minutes = Math.max(1, Math.ceil(Math.abs(ms) / 60000));
  return minutes < 60 ? minutes + " min" : Math.floor(minutes / 60) + " h " + minutes % 60 + " min";
}
export function SlaBadge(props: { ticket: Ticket; nowMs: number }) {
  const sla = assessSla(props.ticket, props.nowMs);
  return <div className={"mt-2 rounded-md p-2 text-xs " + STYLE[sla.status]}>
    <span className="font-semibold">{sla.completed ? (sla.status === "overdue" ? "Revisado fuera de plazo" : "Revisado en plazo") : LABEL[sla.status]}</span>
    <span> · Objetivo {sla.targetHours} h{sla.provisional ? " (provisional)" : ""}</span>
    <p>{sla.completed ? "Revisión en " + duration(sla.elapsedMs) : sla.remainingMs <= 0 ? "Retraso: " + duration(sla.remainingMs) : "Quedan " + duration(sla.remainingMs)}</p>
    <time dateTime={new Date(sla.deadlineMs).toISOString()}>Vencimiento: {new Date(sla.deadlineMs).toLocaleString("es")}</time>
  </div>;
}
