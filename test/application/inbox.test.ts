import { describe, expect, it } from "vitest";
import { InMemoryTicketRepository } from "../../src/adapters/in-memory-ticket-repository.js";
import { createInbox } from "../../src/application/inbox.js";
import { createTriageRequest } from "../../src/application/triage-request.js";
import type { ClassifierResult } from "../../src/application/classifier.js";
import { FakeClassifier } from "../support/fake-classifier.js";

const NOW = "2026-10-13T10:00:00.000Z";

const shippingAnswer: ClassifierResult = {
  ok: true,
  value: { category: "shipping", summary: "Consulta por el pedido 1234.", extracted: { orderNumber: "1234" } },
};

function setup(classifier = FakeClassifier.returning(shippingAnswer)) {
  const repository = new InMemoryTicketRepository();
  const inbox = createInbox({
    repository,
    triageRequest: createTriageRequest({ classifier }),
    now: () => NOW,
  });
  return { inbox, repository, classifier };
}

describe("inbox", () => {
  it("adds valid requests as new tickets and reports the rejected ones", async () => {
    const { inbox } = setup();

    const result = await inbox.addRequests([
      { id: "t-1", body: "¿Dónde está mi pedido 1234?" },
      { id: "t-2", body: "   " },
      { id: "t-1", body: "Otro texto con el mismo id" },
    ]);

    expect(result).toEqual({
      added: ["t-1"],
      rejected: [
        { index: 1, id: "t-2", error: "empty_body" },
        { index: 2, id: "t-1", error: "duplicate_id" },
      ],
    });
    expect(await inbox.list()).toEqual([
      { id: "t-1", body: "¿Dónde está mi pedido 1234?", receivedAt: NOW, status: "new" },
    ]);
  });

  it("triages only new tickets and stores the outcome", async () => {
    const { inbox, classifier } = setup();
    await inbox.addRequests([{ id: "t-1", body: "¿Dónde está mi pedido 1234?" }]);

    const first = await inbox.triagePending();
    const second = await inbox.triagePending();

    expect(first).toEqual({ triaged: 1, failed: 0 });
    expect(second).toEqual({ triaged: 0, failed: 0 });
    expect(classifier.calls).toHaveLength(1);
    expect((await inbox.list())[0]).toMatchObject({ status: "awaiting_review", suggestion: { category: "shipping" } });
  });

  it("keeps failed tickets for retry and manual triage", async () => {
    const { inbox } = setup(FakeClassifier.returning({ ok: false, error: "unavailable" }));
    await inbox.addRequests([{ id: "t-1", body: "¿Dónde está mi pedido 1234?" }]);

    const outcome = await inbox.triagePending();

    expect(outcome).toEqual({ triaged: 0, failed: 1 });
    expect((await inbox.list())[0]).toMatchObject({ status: "triage_failed", triageError: "classifier_unavailable" });
  });

  it("retries failed tickets when asked to", async () => {
    let answer: ClassifierResult = { ok: false, error: "unavailable" };
    const { inbox } = setup(new FakeClassifier(async () => answer));
    await inbox.addRequests([{ id: "t-1", body: "¿Dónde está mi pedido 1234?" }]);
    await inbox.triagePending();

    answer = shippingAnswer;
    const outcome = await inbox.triagePending({ retryFailed: true });

    expect(outcome).toEqual({ triaged: 1, failed: 0 });
  });

  it("accepts a suggestion and persists the review", async () => {
    const { inbox } = setup();
    await inbox.addRequests([{ id: "t-1", body: "¿Dónde está mi pedido 1234?" }]);
    await inbox.triagePending();

    const result = await inbox.accept("t-1");

    expect(result).toMatchObject({ ok: true, value: { review: { decision: "accepted" } } });
    expect((await inbox.list())[0]?.status).toBe("reviewed");
  });

  it("corrects a suggestion and persists the review", async () => {
    const { inbox } = setup();
    await inbox.addRequests([{ id: "t-1", body: "Quiero devolver el pedido 1234" }]);
    await inbox.triagePending();

    const result = await inbox.correct("t-1", { category: "returns", extracted: { orderNumber: "1234" } });

    expect(result).toMatchObject({ ok: true, value: { review: { final: { missingFields: ["return_reason"] } } } });
  });

  it("reports an unknown ticket", async () => {
    const { inbox } = setup();

    expect(await inbox.accept("missing")).toEqual({ ok: false, error: "not_found" });
    expect(await inbox.correct("missing", { category: "other", extracted: {} })).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("does not change a ticket when the review is rejected", async () => {
    const { inbox } = setup();
    await inbox.addRequests([{ id: "t-1", body: "¿Dónde está mi pedido 1234?" }]);
    await inbox.triagePending();
    const before = await inbox.list();

    const result = await inbox.correct("t-1", { category: "refunds", extracted: {} });

    expect(result).toEqual({ ok: false, error: "invalid_category" });
    expect(await inbox.list()).toEqual(before);
  });
});
