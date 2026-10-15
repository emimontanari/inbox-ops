import { describe, expect, it } from "vitest";
import { assessSla } from "../../src/domain/sla.js";
import type { Category } from "../../src/domain/category.js";
import type { Ticket } from "../../src/domain/ticket.js";
const start = "2026-10-13T10:00:00.000Z";
function ticket(category: Category): Ticket {
  return { id: "t", body: "Consulta", receivedAt: start, status: "awaiting_review", suggestion: {
    requestId: "t", category, summary: "Consulta", extracted: {}, missingFields: [],
  } };
}
describe("assessSla", () => {
  it.each([["billing", 4], ["shipping", 8], ["returns", 24], ["other", 24]] as const)("uses %s target %i hours", (category, hours) => {
    expect(assessSla(ticket(category), Date.parse(start))).toMatchObject({ targetHours: hours, remainingMs: hours * 3600000, status: "on_time", provisional: false, completed: false });
  });
  it("handles exact 25 percent and exact deadline boundaries", () => {
    const t = ticket("billing"); const now = Date.parse(start);
    expect(assessSla(t, now + 3 * 3600000).status).toBe("on_time");
    expect(assessSla(t, now + 3 * 3600000 + 1).status).toBe("due_soon");
    expect(assessSla(t, now + 4 * 3600000).status).toBe("overdue");
  });
  it.each(["new", "triage_failed"] as const)("uses provisional 24h for %s", status => {
    const t: Ticket = status === "new" ? { id: "t", body: "Hola", receivedAt: start, status } : { id: "t", body: "Hola", receivedAt: start, status, triageError: "classifier_unavailable" };
    expect(assessSla(t, Date.parse(start))).toMatchObject({ targetHours: 24, provisional: true });
  });
  it("freezes reviewed tickets at review time and uses human final category", () => {
    const t: Ticket = { id: "t", body: "Hola", receivedAt: start, status: "reviewed", review: {
      decision: "manual", reviewedAt: "2026-10-13T15:00:00.000Z", final: { category: "billing", extracted: {}, missingFields: [] },
    } };
    expect(assessSla(t, Date.parse("2026-11-01T00:00:00Z"))).toMatchObject({ targetHours: 4, status: "overdue", completed: true, remainingMs: -3600000 });
  });
});
