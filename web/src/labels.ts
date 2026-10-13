import type { Category } from "../../src/domain/category.js";
import type { Ticket, TicketStatus } from "../../src/domain/ticket.js";
import type { MissingField } from "../../src/domain/triage-suggestion.js";

export const CATEGORY_LABEL: Record<Category, string> = {
  shipping: "Shipping",
  billing: "Billing",
  returns: "Returns",
  other: "Other",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  new: "New",
  awaiting_review: "To review",
  triage_failed: "Failed",
  reviewed: "Reviewed",
};

export const MISSING_FIELD_LABEL: Record<MissingField, string> = {
  order_number: "order number",
  return_reason: "return reason",
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
