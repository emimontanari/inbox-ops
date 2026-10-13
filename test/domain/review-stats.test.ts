import { describe, expect, it } from "vitest";
import { summarizeReviews } from "../../src/domain/review-stats.js";
import type { Ticket } from "../../src/domain/ticket.js";

const base = { body: "x", receivedAt: "2026-10-13T10:00:00.000Z" };
const suggestion = {
  requestId: "x",
  category: "shipping" as const,
  summary: "Consulta.",
  extracted: {},
  missingFields: ["order_number" as const],
};

function reviewed(
  id: string,
  decision: "accepted" | "corrected" | "manual",
  finalCategory: "shipping" | "billing" = "shipping",
): Ticket {
  return {
    ...base,
    id,
    status: "reviewed",
    ...(decision !== "manual" && { suggestion }),
    review: {
      decision,
      reviewedAt: "2026-10-13T10:05:00.000Z",
      final: { category: finalCategory, extracted: {}, missingFields: [] },
    },
  };
}

describe("summarizeReviews", () => {
  it("counts tickets by status and review decision", () => {
    const tickets: Ticket[] = [
      { ...base, id: "n", status: "new" },
      { ...base, id: "a", status: "awaiting_review", suggestion },
      { ...base, id: "f", status: "triage_failed", triageError: "classifier_unavailable" },
      reviewed("r1", "accepted"),
      reviewed("r2", "accepted"),
      reviewed("r3", "corrected", "billing"),
      reviewed("r4", "corrected", "shipping"),
      reviewed("r5", "manual", "billing"),
    ];

    expect(summarizeReviews(tickets)).toEqual({
      total: 8,
      byStatus: { new: 1, awaiting_review: 1, triage_failed: 1, reviewed: 5 },
      decisions: { accepted: 2, corrected: 2, manual: 1 },
      acceptanceRate: 0.5,
      categoryChanges: 1,
    });
  });

  it("leaves manual triage out of the acceptance rate", () => {
    const stats = summarizeReviews([reviewed("r1", "accepted"), reviewed("r2", "manual")]);

    expect(stats.acceptanceRate).toBe(1);
  });

  it("has no acceptance rate until a suggestion has been reviewed", () => {
    expect(summarizeReviews([reviewed("r1", "manual")]).acceptanceRate).toBeNull();
    expect(summarizeReviews([]).acceptanceRate).toBeNull();
  });
});
