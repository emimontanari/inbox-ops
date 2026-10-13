import { describe, expect, it } from "vitest";
import {
  acceptSuggestion,
  correctTriage,
  createTicket,
  recordTriage,
  type Ticket,
} from "../../src/domain/ticket.js";
import type { TriageSuggestion } from "../../src/domain/triage-suggestion.js";

const RECEIVED_AT = "2026-10-13T10:00:00.000Z";
const REVIEWED_AT = "2026-10-13T10:05:00.000Z";

const suggestion: TriageSuggestion = {
  requestId: "t-1",
  category: "shipping",
  summary: "El cliente pregunta por el pedido 1234.",
  extracted: { orderNumber: "1234" },
  missingFields: [],
};

function newTicket(): Ticket {
  const created = createTicket({ id: "t-1", body: "¿Dónde está mi pedido 1234?", receivedAt: RECEIVED_AT });
  if (!created.ok) throw new Error("fixture must be valid");
  return created.value;
}

function awaitingReview(): Ticket {
  const triaged = recordTriage(newTicket(), { ok: true, value: suggestion });
  if (!triaged.ok) throw new Error("fixture must be valid");
  return triaged.value;
}

function triageFailed(): Ticket {
  const triaged = recordTriage(newTicket(), { ok: false, error: "classifier_unavailable" });
  if (!triaged.ok) throw new Error("fixture must be valid");
  return triaged.value;
}

describe("createTicket", () => {
  it("creates a new ticket from a valid request", () => {
    expect(createTicket({ id: "t-1", body: "  ¿Dónde está mi pedido?  ", receivedAt: RECEIVED_AT })).toEqual({
      ok: true,
      value: { id: "t-1", body: "¿Dónde está mi pedido?", receivedAt: RECEIVED_AT, status: "new" },
    });
  });

  it("rejects an invalid request with the request error", () => {
    expect(createTicket({ id: "t-1", body: "   ", receivedAt: RECEIVED_AT })).toEqual({
      ok: false,
      error: "empty_body",
    });
  });
});

describe("recordTriage", () => {
  it("moves a new ticket to awaiting review with the suggestion", () => {
    expect(awaitingReview()).toMatchObject({ status: "awaiting_review", suggestion });
  });

  it("marks the ticket as failed and keeps the error when triage fails", () => {
    expect(triageFailed()).toMatchObject({ status: "triage_failed", triageError: "classifier_unavailable" });
  });

  it("lets a failed ticket be triaged again", () => {
    const retried = recordTriage(triageFailed(), { ok: true, value: suggestion });

    expect(retried.ok && retried.value.status).toBe("awaiting_review");
    expect(retried.ok && "triageError" in retried.value).toBe(false);
  });

  it("refuses to triage a ticket that already has a suggestion", () => {
    expect(recordTriage(awaitingReview(), { ok: true, value: suggestion })).toEqual({
      ok: false,
      error: "already_triaged",
    });
  });
});

describe("acceptSuggestion", () => {
  it("reviews the ticket keeping the suggested category and data", () => {
    const result = acceptSuggestion(awaitingReview(), REVIEWED_AT);

    expect(result).toEqual({
      ok: true,
      value: {
        ...awaitingReview(),
        status: "reviewed",
        review: {
          decision: "accepted",
          reviewedAt: REVIEWED_AT,
          final: { category: "shipping", extracted: { orderNumber: "1234" }, missingFields: [] },
        },
      },
    });
  });

  it("cannot accept a ticket without a suggestion", () => {
    expect(acceptSuggestion(triageFailed(), REVIEWED_AT)).toEqual({ ok: false, error: "not_reviewable" });
  });

  it("cannot accept a ticket twice", () => {
    const reviewed = acceptSuggestion(awaitingReview(), REVIEWED_AT);
    if (!reviewed.ok) throw new Error("fixture must be valid");

    expect(acceptSuggestion(reviewed.value, REVIEWED_AT)).toEqual({ ok: false, error: "not_reviewable" });
  });
});

describe("correctTriage", () => {
  it("stores the correction and recomputes the missing data", () => {
    const result = correctTriage(
      awaitingReview(),
      { category: "returns", extracted: { orderNumber: "1234" } },
      REVIEWED_AT,
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        status: "reviewed",
        review: {
          decision: "corrected",
          reviewedAt: REVIEWED_AT,
          final: { category: "returns", extracted: { orderNumber: "1234" }, missingFields: ["return_reason"] },
        },
      },
    });
  });

  it("records a manual triage when the model had failed", () => {
    const result = correctTriage(triageFailed(), { category: "billing", extracted: {} }, REVIEWED_AT);

    expect(result).toMatchObject({ ok: true, value: { review: { decision: "manual" } } });
  });

  it("rejects an unknown category", () => {
    expect(correctTriage(awaitingReview(), { category: "refunds", extracted: {} }, REVIEWED_AT)).toEqual({
      ok: false,
      error: "invalid_category",
    });
  });

  it("cannot review a ticket that was never triaged", () => {
    expect(correctTriage(newTicket(), { category: "other", extracted: {} }, REVIEWED_AT)).toEqual({
      ok: false,
      error: "not_reviewable",
    });
  });
});
