import { describe, expect, it } from "vitest";
import { createTriageRequest } from "../../src/application/triage-request.js";
import { FakeClassifier } from "../support/fake-classifier.js";

const returnsOutput = {
  ok: true as const,
  value: {
    category: "returns",
    summary: "Customer wants to return order 1234.",
    extracted: { orderNumber: "1234" },
  },
};

describe("triageRequest", () => {
  it("builds a suggestion from the classifier output and computes missing data", async () => {
    const triageRequest = createTriageRequest({ classifier: FakeClassifier.returning(returnsOutput) });

    const result = await triageRequest({ id: "req-1", body: "I want to return order 1234" });

    expect(result).toEqual({
      ok: true,
      value: {
        requestId: "req-1",
        category: "returns",
        summary: "Customer wants to return order 1234.",
        extracted: { orderNumber: "1234" },
        missingFields: ["return_reason"],
      },
    });
  });

  it("sends the validated request to the classifier", async () => {
    const classifier = FakeClassifier.returning(returnsOutput);
    const triageRequest = createTriageRequest({ classifier });

    await triageRequest({ id: " req-1 ", body: "  I want to return order 1234  " });

    expect(classifier.calls).toEqual([{ id: "req-1", body: "I want to return order 1234" }]);
  });

  it("rejects an invalid request without calling the classifier", async () => {
    const classifier = FakeClassifier.returning(returnsOutput);
    const triageRequest = createTriageRequest({ classifier });

    const result = await triageRequest({ id: "req-1", body: "   " });

    expect(result).toEqual({ ok: false, error: "empty_body" });
    expect(classifier.calls).toHaveLength(0);
  });

  it("reports an unavailable classifier", async () => {
    const triageRequest = createTriageRequest({
      classifier: FakeClassifier.returning({ ok: false, error: "unavailable" }),
    });

    const result = await triageRequest({ id: "req-1", body: "Where is my order?" });

    expect(result).toEqual({ ok: false, error: "classifier_unavailable" });
  });

  it("reports classifier output that could not be parsed", async () => {
    const triageRequest = createTriageRequest({
      classifier: FakeClassifier.returning({ ok: false, error: "invalid_output" }),
    });

    const result = await triageRequest({ id: "req-1", body: "Where is my order?" });

    expect(result).toEqual({ ok: false, error: "classifier_invalid_output" });
  });

  it("treats a classifier that throws as unavailable", async () => {
    const triageRequest = createTriageRequest({
      classifier: FakeClassifier.throwing(new Error("socket hang up")),
    });

    const result = await triageRequest({ id: "req-1", body: "Where is my order?" });

    expect(result).toEqual({ ok: false, error: "classifier_unavailable" });
  });

  it("rejects a category the domain does not know", async () => {
    const triageRequest = createTriageRequest({
      classifier: FakeClassifier.returning({
        ok: true,
        value: { ...returnsOutput.value, category: "refunds" },
      }),
    });

    const result = await triageRequest({ id: "req-1", body: "I want my money back" });

    expect(result).toEqual({ ok: false, error: "invalid_category" });
  });
});
