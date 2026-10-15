import { describe, expect, it } from "vitest";
import type { ReviewedTicket } from "../../src/domain/ticket.js";
import { compareReview } from "../../src/domain/review-comparison.js";
const ticket: ReviewedTicket = {
  id: "t", body: "Consulta", receivedAt: "2026-10-13T10:00:00Z", status: "reviewed",
  suggestion: { requestId: "t", category: "shipping", summary: "Resumen original", extracted: { orderNumber: "004821" }, missingFields: [] },
  review: { decision: "accepted", reviewedAt: "2026-10-13T10:05:00Z", final: { category: "shipping", extracted: { orderNumber: "004821" }, missingFields: [] } },
};
describe("compareReview", () => {
  it("shows all comparable fields unchanged for accepted suggestions", () => {
    const result = compareReview(ticket);
    expect(result.hasOriginal).toBe(true);
    expect(result.rows.map(row => row.field)).toEqual(["category", "orderNumber", "returnReason", "missingFields"]);
    expect(result.rows.every(row => row.changed === false)).toBe(true);
  });
  it("detects added, removed and replaced values without mutating the ticket", () => {
    const corrected: ReviewedTicket = { ...ticket, review: { ...ticket.review, decision: "corrected", final: { category: "returns", extracted: { returnReason: "Talle" }, missingFields: ["order_number"] } } };
    const before = structuredClone(corrected);
    const result = compareReview(corrected);
    expect(result.rows).toEqual([
      { field: "category", before: "shipping", after: "returns", changed: true },
      { field: "orderNumber", before: "004821", after: undefined, changed: true },
      { field: "returnReason", before: undefined, after: "Talle", changed: true },
      { field: "missingFields", before: [], after: ["order_number"], changed: true },
    ]);
    expect(corrected).toEqual(before);
  });
  it("does not invent changes when a correction saves identical values", () => {
    expect(compareReview({ ...ticket, review: { ...ticket.review, decision: "corrected" } }).rows.some(row => row.changed)).toBe(false);
  });
  it("does not count manual values as modifications to a nonexistent suggestion", () => {
    const manual: ReviewedTicket = { id: "manual", body: "Hola", receivedAt: ticket.receivedAt, status: "reviewed", triageError: "classifier_unavailable", review: { ...ticket.review, decision: "manual" } };
    expect(compareReview(manual).hasOriginal).toBe(false);
    expect(compareReview(manual).rows.every(row => row.before === undefined && row.changed === undefined)).toBe(true);
  });
  it("compares missing fields as sets but preserves leading zeros in identifiers", () => {
    if (!ticket.suggestion) throw new Error("fixture");
    const t: ReviewedTicket = { ...ticket, suggestion: { ...ticket.suggestion, missingFields: ["order_number", "return_reason"] }, review: { ...ticket.review, final: { ...ticket.review.final, extracted: { orderNumber: "4821" }, missingFields: ["return_reason", "order_number"] } } };
    expect(compareReview(t).rows.find(row => row.field === "missingFields")?.changed).toBe(false);
    expect(compareReview(t).rows.find(row => row.field === "orderNumber")?.changed).toBe(true);
  });
});
