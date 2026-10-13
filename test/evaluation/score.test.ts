import { describe, expect, it } from "vitest";
import type { EvalCase } from "../../src/evaluation/dataset.js";
import { scoreCase, summarize, type CaseScore } from "../../src/evaluation/score.js";
import type { Measurement } from "../../src/evaluation/metered-classifier.js";
import type { TriageSuggestion } from "../../src/domain/triage-suggestion.js";

const returnCase: EvalCase = {
  id: "ret-01",
  split: "dev",
  tags: [],
  body: "Quiero devolver el pedido 61002, me quedaron chicas.",
  expected: { category: "returns", orderNumber: "61002", hasReturnReason: true },
};

function suggestion(overrides: Partial<TriageSuggestion> = {}): TriageSuggestion {
  return {
    requestId: "ret-01",
    category: "returns",
    summary: "The customer wants to return order 61002.",
    extracted: { orderNumber: "61002", returnReason: "too small" },
    missingFields: [],
    ...overrides,
  };
}

describe("scoreCase", () => {
  it("marks a fully correct suggestion", () => {
    const score = scoreCase(returnCase, { ok: true, value: suggestion() });

    expect(score).toEqual({
      id: "ret-01",
      expectedCategory: "returns",
      actualCategory: "returns",
      categoryCorrect: true,
      orderNumber: "correct",
      returnReason: "correct",
      summary: "The customer wants to return order 61002.",
      summaryLanguage: "en",
    });
  });

  it("detects the summary language", () => {
    const score = scoreCase(returnCase, {
      ok: true,
      value: suggestion({ summary: "El cliente quiere devolver el pedido 61002." }),
    });

    expect(score.summaryLanguage).toBe("es");
  });

  it("marks a wrong category", () => {
    const score = scoreCase(returnCase, { ok: true, value: suggestion({ category: "shipping" }) });

    expect(score.categoryCorrect).toBe(false);
    expect(score.actualCategory).toBe("shipping");
  });

  it("ignores a leading # and spaces when comparing order numbers", () => {
    const score = scoreCase(returnCase, {
      ok: true,
      value: suggestion({ extracted: { orderNumber: " #61002 ", returnReason: "too small" } }),
    });

    expect(score.orderNumber).toBe("correct");
  });

  it("flags an order number the customer never wrote as hallucinated", () => {
    const noOrderCase: EvalCase = {
      ...returnCase,
      expected: { ...returnCase.expected, orderNumber: null },
    };

    const score = scoreCase(noOrderCase, { ok: true, value: suggestion() });

    expect(score.orderNumber).toBe("hallucinated");
  });

  it("flags a missed order number", () => {
    const score = scoreCase(returnCase, {
      ok: true,
      value: suggestion({ extracted: { returnReason: "too small" } }),
    });

    expect(score.orderNumber).toBe("missed");
  });

  it("flags a different order number as wrong", () => {
    const score = scoreCase(returnCase, {
      ok: true,
      value: suggestion({ extracted: { orderNumber: "61003", returnReason: "too small" } }),
    });

    expect(score.orderNumber).toBe("wrong");
  });

  it("flags an invented return reason", () => {
    const noReasonCase: EvalCase = {
      ...returnCase,
      expected: { ...returnCase.expected, hasReturnReason: false },
    };

    const score = scoreCase(noReasonCase, { ok: true, value: suggestion() });

    expect(score.returnReason).toBe("hallucinated");
  });

  it("flags a missed return reason", () => {
    const score = scoreCase(returnCase, {
      ok: true,
      value: suggestion({ extracted: { orderNumber: "61002" } }),
    });

    expect(score.returnReason).toBe("missed");
  });

  it("does not score the return reason outside the returns category", () => {
    const shippingCase: EvalCase = {
      ...returnCase,
      expected: { category: "shipping", orderNumber: "61002", hasReturnReason: false },
    };

    const score = scoreCase(shippingCase, { ok: true, value: suggestion({ category: "shipping" }) });

    expect(score.returnReason).toBe("not_applicable");
  });

  it("records an error result as an error, never as correct", () => {
    const score = scoreCase(returnCase, { ok: false, error: "classifier_unavailable" });

    expect(score).toEqual({
      id: "ret-01",
      expectedCategory: "returns",
      actualCategory: null,
      categoryCorrect: false,
      orderNumber: "not_applicable",
      returnReason: "not_applicable",
      error: "classifier_unavailable",
    });
  });
});

describe("summarize", () => {
  const scores: CaseScore[] = [
    scoreCase(returnCase, {
      ok: true,
      value: suggestion({ summary: "El cliente quiere devolver el pedido 61002." }),
    }),
    scoreCase(returnCase, { ok: true, value: suggestion({ category: "shipping" }) }),
    scoreCase({ ...returnCase, expected: { ...returnCase.expected, orderNumber: null } }, {
      ok: true,
      value: suggestion(),
    }),
    scoreCase(returnCase, { ok: false, error: "classifier_invalid_output" }),
  ];
  const measurements: Measurement[] = [
    { requestId: "a", latencyMs: 100, ok: true, usage: { inputTokens: 200, outputTokens: 50 } },
    { requestId: "b", latencyMs: 300, ok: true, usage: { inputTokens: 210, outputTokens: 40 } },
    { requestId: "c", latencyMs: 200, ok: true, usage: { inputTokens: 190, outputTokens: 60 } },
    { requestId: "d", latencyMs: 900, ok: false },
  ];

  it("aggregates accuracy, extraction errors, latency and tokens", () => {
    const report = summarize(scores, measurements);

    expect(report).toEqual({
      total: 4,
      errors: 1,
      categoryAccuracy: 0.5,
      byExpectedCategory: { returns: { total: 4, correct: 2 } },
      orderNumber: { correct: 2, missed: 0, wrong: 0, hallucinated: 1 },
      returnReason: { correct: 3, missed: 0, hallucinated: 0 },
      summaryLanguage: { es: 1, en: 2, unknown: 0 },
      latencyMs: { p50: 200, p95: 900, max: 900 },
      tokens: { input: 600, output: 150 },
    });
  });

  it("returns zeroed metrics for an empty run", () => {
    expect(summarize([], [])).toEqual({
      total: 0,
      errors: 0,
      categoryAccuracy: 0,
      byExpectedCategory: {},
      orderNumber: { correct: 0, missed: 0, wrong: 0, hallucinated: 0 },
      returnReason: { correct: 0, missed: 0, hallucinated: 0 },
      summaryLanguage: { es: 0, en: 0, unknown: 0 },
      latencyMs: { p50: 0, p95: 0, max: 0 },
      tokens: { input: 0, output: 0 },
    });
  });
});
