import { assessSla } from "../../src/domain/sla.js";
import type { Ticket } from "../../src/domain/ticket.js";
export function compareByDeadline(a: Ticket, b: Ticket): number {
  const completed = Number(a.status === "reviewed") - Number(b.status === "reviewed");
  return completed || assessSla(a, 0).deadlineMs - assessSla(b, 0).deadlineMs || Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.id.localeCompare(b.id);
}
