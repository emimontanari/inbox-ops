import type { Ticket } from "../../../src/domain/ticket.js";
import { CATEGORY_LABEL, STATUS_LABEL, currentTriage } from "../labels.js";
import { currentOrderNumber, findRelatedTickets } from "../related-tickets.js";

export function RelatedTickets(props: {
  selected: Ticket;
  tickets: readonly Ticket[];
  onOpen: (id: string) => void;
  disabled: boolean;
}) {
  const order = currentOrderNumber(props.selected);
  const related = findRelatedTickets(props.selected, props.tickets);
  return (
    <section aria-label="Solicitudes relacionadas" className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold">Solicitudes relacionadas</h2>
      <p className="text-xs text-slate-600">El número compartido no confirma identidad ni titularidad del pedido, ni que sea un pedido real. Revisa los mensajes antes de actuar.</p>
      {!order ? (
        <p className="text-sm text-slate-600">No hay número de pedido en la clasificación actual. No se buscan coincidencias en el texto del mensaje.</p>
      ) : (
        <>
          <p className="break-all text-sm font-medium">Pedido {order} · {related.length} relacionadas</p>
          {related.length === 0 ? (
            <p className="text-sm text-slate-600">No hay otras solicitudes con este número en la bandeja cargada.</p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-2">
              {related.map(ticket => {
                const triage = currentTriage(ticket);
                return (
                  <li key={ticket.id}>
                    <button type="button" aria-label={`Abrir solicitud ${ticket.id}`} disabled={props.disabled}
                      onClick={() => props.onOpen(ticket.id)} className="action-secondary flex w-full min-w-0 flex-col items-start gap-1 text-left">
                      <span className="w-full break-all font-medium">{ticket.id}</span>
                      <span className="text-xs">{STATUS_LABEL[ticket.status]} · {triage ? CATEGORY_LABEL[triage.category] : "Sin clasificar"}</span>
                      <time className="text-xs" dateTime={ticket.receivedAt}>{new Date(ticket.receivedAt).toLocaleString("es")}</time>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
