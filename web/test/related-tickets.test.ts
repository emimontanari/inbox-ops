import { describe, expect, it } from "vitest";
import type { Ticket } from "../../src/domain/ticket.js";
import { findRelatedTickets } from "../src/related-tickets.js";
import { awaitingTicket, reviewedTicket, newTicket, failedTicket } from "./fixtures.js";
function pending(id: string, orderNumber: string, receivedAt = awaitingTicket.receivedAt): Ticket {
  if (awaitingTicket.status !== "awaiting_review") throw new Error("fixture");
  return { ...awaitingTicket, id, receivedAt, suggestion: { ...awaitingTicket.suggestion, extracted: { orderNumber } } };
}
describe("findRelatedTickets", () => {
  it("matches exact trimmed current order and excludes self, blanks, substrings and raw message numbers", () => {
    const selected = pending("selected", " 004821 ");
    const candidates = [selected, pending("same", "004821"), pending("short", "4821"), pending("prefix", "0048219"), pending("empty", " "), { ...newTicket, body: "Pedido 004821" }, failedTicket];
    expect(findRelatedTickets(selected, candidates).map(t => t.id)).toEqual(["same"]);
    expect(findRelatedTickets(pending("blank", " "), candidates)).toEqual([]);
    expect(findRelatedTickets(newTicket, candidates)).toEqual([]);
  });
  it("uses human final data, including manually classified tickets, not superseded suggestions", () => {
    if (reviewedTicket.status !== "reviewed") throw new Error("fixture");
    const corrected: Ticket = { ...reviewedTicket, review: { ...reviewedTicket.review, final: { ...reviewedTicket.review.final, extracted: { orderNumber: "4821" } } } };
    expect(findRelatedTickets(corrected, [pending("match", "4821"), pending("old", "1234")]).map(t => t.id)).toEqual(["match"]);
    const manual: Ticket = { id: "manual", body: "Hola", receivedAt: reviewedTicket.receivedAt, status: "reviewed", review: { ...reviewedTicket.review, decision: "manual", final: { ...reviewedTicket.review.final, extracted: { orderNumber: "4821" } } } };
    expect(findRelatedTickets(pending("p", "4821"), [manual, reviewedTicket]).map(t => t.id)).toEqual(["manual"]);
  });
  it("sorts newest first with stable ID ties and does not mutate the input", () => {
    const selected = pending("s", "AB-123");
    const items = [pending("z", "AB-123"), pending("old", "AB-123", "2026-10-01T00:00:00Z"), pending("a", "AB-123"), pending("lowercase", "ab-123")];
    const before = structuredClone(items);
    expect(findRelatedTickets(selected, items).map(t => t.id)).toEqual(["a", "z", "old"]);
    expect(items).toEqual(before);
  });
});
