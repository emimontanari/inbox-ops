import { describe, expect, it } from "vitest";
import { InMemoryTicketRepository } from "../../src/adapters/in-memory-ticket-repository.js";
import type { ClassifierResult } from "../../src/application/classifier.js";
import { createInbox } from "../../src/application/inbox.js";
import { createDraftReply } from "../../src/application/draft-reply.js";
import type { DrafterResult } from "../../src/application/reply-drafter.js";
import { createTriageRequest } from "../../src/application/triage-request.js";
import { createApp } from "../../src/http/app.js";
import { FakeClassifier } from "../support/fake-classifier.js";
import { FakeDrafter } from "../support/fake-drafter.js";

const NOW = "2026-10-13T10:00:00.000Z";

const shippingAnswer: ClassifierResult = {
  ok: true,
  value: { category: "shipping", summary: "Consulta por el pedido 1234.", extracted: { orderNumber: "1234" } },
};

const passages = [{ id: "shipping-tracking", title: "Seguimiento", topics: ["shipping" as const], text: "Si no sabés dónde está tu pedido, abrimos una consulta con el transportista." }];
const draftAnswer: DrafterResult = { ok: true, value: { sentences: [{ text: "Abrimos una consulta con el transportista.", sourceIds: ["shipping-tracking"] }] } };

function setup(classifier = FakeClassifier.returning(shippingAnswer), drafter = FakeDrafter.returning(draftAnswer)) {
  const repository = new InMemoryTicketRepository();
  const inbox = createInbox({ repository, triageRequest: createTriageRequest({ classifier }), now: () => NOW });
  const draftReply = createDraftReply({ repository, drafter, passages });
  let nextId = 0;
  const app = createApp({ inbox, draftReply, generateId: () => `gen-${++nextId}` });
  return { app, repository, classifier, drafter };
}

function post(app: ReturnType<typeof setup>["app"], path: string, body?: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

async function addAndTriage(app: ReturnType<typeof setup>["app"], body = "¿Dónde está mi pedido 1234?") {
  await post(app, "/api/tickets", { requests: [{ id: "t-1", body }] });
  await post(app, "/api/triage");
}

describe("HTTP API", () => {
  it("forwards receivedAt and rejects invalid/future dates without losing valid rows", async () => {
    const { app, repository } = setup();
    const response = await post(app, "/api/tickets", { requests: [
      { id: "past", body: "Hola", receivedAt: "2026-10-13T05:00:00-03:00" },
      { id: "bad", body: "Hola", receivedAt: "tomorrow" },
      { id: "future", body: "Hola", receivedAt: "2027-01-01T00:00:00Z" },
    ] });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ added: ["past"], rejected: [
      { index: 1, id: "bad", error: "invalid_received_at" },
      { index: 2, id: "future", error: "future_received_at" },
    ] });
    expect(await repository.findById("past")).toMatchObject({ receivedAt: "2026-10-13T08:00:00.000Z" });
  });
  it("adds requests and generates an id when none is given", async () => {
    const { app } = setup();

    const response = await post(app, "/api/tickets", {
      requests: [{ id: "t-1", body: "¿Dónde está mi pedido?" }, { body: "Me cobraron dos veces" }, { body: " " }],
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      added: ["t-1", "gen-1"],
      rejected: [{ index: 2, id: "gen-2", error: "empty_body" }],
    });
  });

  it("rejects a malformed body with 400 and stores nothing", async () => {
    const { app, repository } = setup();

    const response = await post(app, "/api/tickets", { requests: [{ id: 5 }] });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_body" });
    expect(await repository.list()).toEqual([]);
  });

  it("rejects more requests than the batch limit", async () => {
    const { app, repository } = setup();
    const requests = Array.from({ length: 201 }, (_, i) => ({ body: `Pedido ${i}` }));

    const response = await post(app, "/api/tickets", { requests });

    expect(response.status).toBe(400);
    expect(await repository.list()).toEqual([]);
  });

  it("lists tickets", async () => {
    const { app } = setup();
    await post(app, "/api/tickets", { requests: [{ id: "t-1", body: "¿Dónde está mi pedido?" }] });

    const response = await app.request("/api/tickets");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tickets: [{ id: "t-1", body: "¿Dónde está mi pedido?", receivedAt: NOW, status: "new" }],
    });
  });

  it("triages pending tickets and can retry failed ones", async () => {
    let answer: ClassifierResult = { ok: false, error: "unavailable" };
    const { app } = setup(new FakeClassifier(async () => answer));
    await post(app, "/api/tickets", { requests: [{ id: "t-1", body: "¿Dónde está mi pedido 1234?" }] });

    const first = await post(app, "/api/triage");
    answer = shippingAnswer;
    const retry = await post(app, "/api/triage", { retryFailed: true });

    expect(await first.json()).toEqual({ triaged: 0, failed: 1 });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ triaged: 1, failed: 0 });
  });

  it("accepts a suggestion", async () => {
    const { app } = setup();
    await addAndTriage(app);

    const response = await post(app, "/api/tickets/t-1/accept");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ticket: { status: "reviewed", review: { decision: "accepted" } } });
  });

  it("corrects a suggestion", async () => {
    const { app } = setup();
    await addAndTriage(app, "Quiero devolver el pedido 1234");

    const response = await post(app, "/api/tickets/t-1/correct", {
      category: "returns",
      extracted: { orderNumber: "1234" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ticket: { review: { decision: "corrected", final: { missingFields: ["return_reason"] } } },
    });
  });

  it("maps review errors to HTTP status codes and leaves the ticket unchanged", async () => {
    const { app, repository } = setup();
    await addAndTriage(app);
    const before = await repository.findById("t-1");

    const unknown = await post(app, "/api/tickets/missing/accept");
    const badCategory = await post(app, "/api/tickets/t-1/correct", { category: "refunds", extracted: {} });
    await post(app, "/api/tickets/t-1/accept");
    const twice = await post(app, "/api/tickets/t-1/accept");

    expect([unknown.status, badCategory.status, twice.status]).toEqual([404, 400, 409]);
    expect(await unknown.json()).toEqual({ error: "not_found" });
    expect(await badCategory.json()).toEqual({ error: "invalid_category" });
    expect(await twice.json()).toEqual({ error: "not_reviewable" });
    expect(before?.status).toBe("awaiting_review");
  });

  it("drafts a reply with its cited sources without changing the ticket", async () => {
    const { app, repository } = setup();
    await addAndTriage(app);
    const before = await repository.findById("t-1");

    const response = await post(app, "/api/tickets/t-1/draft");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      draft: { sentences: [{ text: "Abrimos una consulta con el transportista.", sourceIds: ["shipping-tracking"] }], sources: passages },
    });
    expect(await repository.findById("t-1")).toEqual(before);
  });

  it("maps draft errors to HTTP status codes", async () => {
    const unavailable = setup(undefined, FakeDrafter.returning({ ok: false, error: "unavailable" }));
    const invalid = setup(undefined, FakeDrafter.returning({ ok: false, error: "invalid_output" }));
    await addAndTriage(unavailable.app);
    await addAndTriage(invalid.app);
    await post(unavailable.app, "/api/tickets", { requests: [{ id: "t-new", body: "Hola" }] });

    const responses = [
      await post(unavailable.app, "/api/tickets/missing/draft"),
      await post(unavailable.app, "/api/tickets/t-new/draft"),
      await post(unavailable.app, "/api/tickets/t-1/draft"),
      await post(invalid.app, "/api/tickets/t-1/draft"),
    ];

    expect(responses.map((response) => response.status)).toEqual([404, 409, 503, 502]);
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
      { error: "not_found" },
      { error: "not_draftable" },
      { error: "drafter_unavailable" },
      { error: "drafter_invalid_output" },
    ]);
  });

  it("hides internal errors behind a generic 500", async () => {
    const repository = new InMemoryTicketRepository();
    repository.list = async () => {
      throw new Error("disk on fire: /var/secret/path");
    };
    const inbox = createInbox({
      repository,
      triageRequest: createTriageRequest({ classifier: FakeClassifier.returning(shippingAnswer) }),
      now: () => NOW,
    });
    const draftReply = createDraftReply({ repository, drafter: FakeDrafter.returning(draftAnswer), passages });
    const app = createApp({ inbox, draftReply, generateId: () => "x", logError: () => {} });

    const response = await app.request("/api/tickets");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal_error" });
  });
});
