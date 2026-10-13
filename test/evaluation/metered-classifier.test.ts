import { describe, expect, it } from "vitest";
import { createMeteredClassifier } from "../../src/evaluation/metered-classifier.js";
import { FakeClassifier } from "../support/fake-classifier.js";

const request = { id: "req-1", body: "Where is my order?" };

function clockFrom(times: number[]): () => number {
  let index = 0;
  return () => times[index++] ?? 0;
}

describe("MeteredClassifier", () => {
  it("passes the result through and records latency and token usage", async () => {
    const result = {
      ok: true as const,
      value: {
        category: "shipping",
        summary: "Asks for order status.",
        extracted: {},
        usage: { inputTokens: 180, outputTokens: 35 },
      },
    };
    const metered = createMeteredClassifier(FakeClassifier.returning(result), clockFrom([1000, 1250]));

    const returned = await metered.classifier.classify(request);

    expect(returned).toBe(result);
    expect(metered.measurements).toEqual([
      { requestId: "req-1", latencyMs: 250, ok: true, usage: { inputTokens: 180, outputTokens: 35 } },
    ]);
  });

  it("records a failed classification without usage", async () => {
    const metered = createMeteredClassifier(
      FakeClassifier.returning({ ok: false, error: "unavailable" }),
      clockFrom([0, 40]),
    );

    await metered.classifier.classify(request);

    expect(metered.measurements).toEqual([{ requestId: "req-1", latencyMs: 40, ok: false }]);
  });

  it("records a classifier that throws and rethrows the error", async () => {
    const metered = createMeteredClassifier(
      FakeClassifier.throwing(new Error("boom")),
      clockFrom([0, 15]),
    );

    await expect(metered.classifier.classify(request)).rejects.toThrow("boom");
    expect(metered.measurements).toEqual([{ requestId: "req-1", latencyMs: 15, ok: false }]);
  });
});
