import type { Ticket } from "../../src/domain/ticket.js";

const base = { body: "", receivedAt: "2026-10-13T10:00:00.000Z" };

export const newTicket: Ticket = {
  ...base,
  id: "t-new",
  body: "Hola, ¿tienen local en Córdoba?",
  status: "new",
};

export const awaitingTicket: Ticket = {
  ...base,
  id: "t-await",
  body: "Quiero devolver el pedido 4821",
  status: "awaiting_review",
  suggestion: {
    requestId: "t-await",
    category: "returns",
    summary: "El cliente quiere devolver el pedido 4821.",
    extracted: { orderNumber: "4821" },
    missingFields: ["return_reason"],
  },
};

export const failedTicket: Ticket = {
  ...base,
  id: "t-failed",
  body: "Me cobraron dos veces",
  status: "triage_failed",
  triageError: "classifier_unavailable",
};

export const reviewedTicket: Ticket = {
  ...base,
  id: "t-reviewed",
  body: "¿Dónde está mi pedido 1234?",
  status: "reviewed",
  suggestion: {
    requestId: "t-reviewed",
    category: "shipping",
    summary: "El cliente pregunta por el pedido 1234.",
    extracted: { orderNumber: "1234" },
    missingFields: [],
  },
  review: {
    decision: "accepted",
    reviewedAt: "2026-10-13T10:05:00.000Z",
    final: { category: "shipping", extracted: { orderNumber: "1234" }, missingFields: [] },
  },
};

export const allTickets: Ticket[] = [newTicket, awaitingTicket, failedTicket, reviewedTicket];
