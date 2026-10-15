import type { Ticket } from "../../src/domain/ticket.js";
import { currentTriage } from "./labels.js";

export function currentOrderNumber(ticket: Ticket): string | undefined {
  return currentTriage(ticket)?.extracted.orderNumber?.trim() || undefined;
}

// An exact shared identifier is a navigation hint, not proof of identity or order ownership.
// Keep case, punctuation and leading zeros: there is no external order system to normalize against.
export function findRelatedTickets(selected: Ticket, tickets: readonly Ticket[]): Ticket[] {
  const order = currentOrderNumber(selected);
  if (!order) return [];
  return tickets.filter(ticket => ticket.id !== selected.id && currentOrderNumber(ticket) === order)
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt) || a.id.localeCompare(b.id));
}
