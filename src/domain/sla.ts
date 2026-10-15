import type { Category } from "./category.js";
import type { Ticket } from "./ticket.js";
// Fictional internal review targets, in elapsed hours (not business hours or customer commitments).
export const SLA_HOURS: Readonly<Record<Category, number>> = { billing: 4, shipping: 8, returns: 24, other: 24 };
export type SlaStatus = "on_time" | "due_soon" | "overdue";
export type TicketSla = { targetHours: number; deadlineMs: number; remainingMs: number; elapsedMs: number; status: SlaStatus; provisional: boolean; completed: boolean };
export function assessSla(ticket: Ticket, nowMs: number): TicketSla {
  const category = ticket.status === "reviewed" ? ticket.review.final.category : ticket.status === "awaiting_review" ? ticket.suggestion.category : undefined;
  const targetHours = category === undefined ? 24 : SLA_HOURS[category];
  const receivedMs = Date.parse(ticket.receivedAt);
  const deadlineMs = receivedMs + targetHours * 3600000;
  const completed = ticket.status === "reviewed";
  const endMs = ticket.status === "reviewed" ? Date.parse(ticket.review.reviewedAt) : nowMs;
  const remainingMs = deadlineMs - endMs;
  return { targetHours, deadlineMs, remainingMs, elapsedMs: Math.max(0, endMs - receivedMs),
    status: remainingMs <= 0 ? "overdue" : remainingMs < targetHours * 3600000 / 4 ? "due_soon" : "on_time",
    provisional: category === undefined, completed };
}
