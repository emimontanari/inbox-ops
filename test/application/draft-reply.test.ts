import { describe, expect, it } from "vitest";
import { InMemoryTicketRepository } from "../../src/adapters/in-memory-ticket-repository.js";
import { createDraftReply } from "../../src/application/draft-reply.js";
import type { DrafterResult } from "../../src/application/reply-drafter.js";
import type { PolicyPassage } from "../../src/domain/policy.js";
import type { Ticket } from "../../src/domain/ticket.js";
import { FakeDrafter } from "../support/fake-drafter.js";

const passages: PolicyPassage[] = [
  { id: "returns-window", title: "Devoluciones", topics: ["returns"], text: "Para iniciar una devolución necesitamos el número de pedido y el motivo de la devolución." },
  { id: "shipping-tracking", title: "Seguimiento", topics: ["shipping"], text: "Si el seguimiento no muestra novedades durante 48 horas hábiles, abrimos una consulta." },
];

const RECEIVED = "2026-10-14T10:00:00.000Z";
const awaiting: Ticket = {
  id: "t-1",
  body: "Quiero devolver el pedido 64132.",
  receivedAt: RECEIVED,
  status: "awaiting_review",
  suggestion: { requestId: "t-1", category: "returns", summary: "Quiere devolver el pedido 64132.", extracted: { orderNumber: "64132" }, missingFields: ["return_reason"] },
};

const goodDraft: DrafterResult = {
  ok: true,
  value: { sentences: [{ text: "¿Nos indicás el motivo de la devolución?", sourceIds: ["returns-window"] }] },
};

async function setup(tickets: Ticket[], drafter = FakeDrafter.returning(goodDraft)) {
  const repository = new InMemoryTicketRepository();
  for (const ticket of tickets) await repository.save(ticket);
  return { repository, drafter, draftReply: createDraftReply({ repository, drafter, passages }) };
}

describe("draftReply", () => {
  it("drafts from the current suggestion with retrieved passages and missing fields", async () => {
    const { draftReply, drafter } = await setup([awaiting]);

    const result = await draftReply("t-1");

    expect(result).toEqual({
      ok: true,
      value: { sentences: [{ text: "¿Nos indicás el motivo de la devolución?", sourceIds: ["returns-window"] }], sources: [passages[0]] },
    });
    expect(drafter.calls).toEqual([
      {
        customerMessage: awaiting.body,
        category: "returns",
        summary: "Quiere devolver el pedido 64132.",
        extracted: { orderNumber: "64132" },
        missingFields: ["return_reason"],
        passages: [passages[0]],
      },
    ]);
  });

  it("uses the final human triage of a reviewed ticket", async () => {
    const reviewed: Ticket = {
      ...awaiting,
      status: "reviewed",
      review: { decision: "corrected", reviewedAt: RECEIVED, final: { category: "shipping", extracted: { orderNumber: "64132" }, missingFields: [] } },
    };
    const { draftReply, drafter } = await setup([reviewed]);

    await draftReply("t-1");

    expect(drafter.calls[0]).toMatchObject({ category: "shipping", missingFields: [], summary: "Quiere devolver el pedido 64132." });
  });

  it("drafts a manually triaged ticket without a model summary", async () => {
    const manual: Ticket = {
      id: "t-2", body: "Me cobraron dos veces", receivedAt: RECEIVED, status: "reviewed", triageError: "classifier_unavailable",
      review: { decision: "manual", reviewedAt: RECEIVED, final: { category: "billing", extracted: {}, missingFields: ["order_number"] } },
    };
    const { draftReply, drafter } = await setup([manual]);

    await draftReply("t-2");

    expect(drafter.calls[0]).not.toHaveProperty("summary");
    expect(drafter.calls[0]).toMatchObject({ category: "billing", missingFields: ["order_number"] });
  });

  it("returns not_found for an unknown ticket without calling the model", async () => {
    const { draftReply, drafter } = await setup([]);
    expect(await draftReply("missing")).toEqual({ ok: false, error: "not_found" });
    expect(drafter.calls).toEqual([]);
  });

  it.each([
    { name: "new", ticket: { id: "t-1", body: "Hola", receivedAt: RECEIVED, status: "new" } as Ticket },
    { name: "failed", ticket: { id: "t-1", body: "Hola", receivedAt: RECEIVED, status: "triage_failed", triageError: "classifier_unavailable" } as Ticket },
  ])("refuses to draft a $name ticket without a classification", async ({ ticket }) => {
    const { draftReply, drafter } = await setup([ticket]);
    expect(await draftReply("t-1")).toEqual({ ok: false, error: "not_draftable" });
    expect(drafter.calls).toEqual([]);
  });

  it.each([
    { answer: { ok: false, error: "unavailable" } as DrafterResult, error: "drafter_unavailable" },
    { answer: { ok: false, error: "invalid_output" } as DrafterResult, error: "drafter_invalid_output" },
    { answer: { ok: true, value: { sentences: [{ text: "Te reembolsamos hoy.", sourceIds: ["refund-now"] }] } } as DrafterResult, error: "drafter_invalid_output" },
    { answer: { ok: true, value: { sentences: [] } } as DrafterResult, error: "drafter_invalid_output" },
  ])("maps drafter failure to $error", async ({ answer, error }) => {
    const { draftReply } = await setup([awaiting], FakeDrafter.returning(answer));
    expect(await draftReply("t-1")).toEqual({ ok: false, error });
  });

  it("never changes the stored ticket", async () => {
    const { draftReply, repository } = await setup([awaiting]);
    await draftReply("t-1");
    expect(await repository.list()).toEqual([awaiting]);
  });
});
