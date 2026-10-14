import type { Category } from "../../src/domain/category.js";
import type { Ticket, TicketStatus } from "../../src/domain/ticket.js";
import type { MissingField } from "../../src/domain/triage-suggestion.js";

export const CATEGORY_LABEL: Record<Category, string> = {
  shipping: "Envío",
  billing: "Facturación",
  returns: "Devoluciones",
  other: "Otro",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "Nueva",
  awaiting_review: "Por revisar",
  triage_failed: "Fallida",
  reviewed: "Revisada",
};

export const MISSING_FIELD_LABEL: Record<MissingField, string> = {
  order_number: "número de pedido",
  return_reason: "motivo de devolución",
};

// What a person should read first: the final decision, then the model's suggestion, then the raw text.
export function currentTriage(ticket: Ticket) {
  if (ticket.status === "reviewed") return ticket.review.final;
  if (ticket.status === "awaiting_review") return ticket.suggestion;
  return undefined;
}

export function headline(ticket: Ticket): string {
  if (ticket.status === "awaiting_review") return ticket.suggestion.summary;
  if (ticket.status === "reviewed" && ticket.suggestion) return ticket.suggestion.summary;
  return ticket.body;
}
