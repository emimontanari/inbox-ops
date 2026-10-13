import type { TriageError } from "../application/triage-request.js";
import type { Category } from "../domain/category.js";
import type { Result } from "../domain/result.js";
import type { TriageSuggestion } from "../domain/triage-suggestion.js";
import type { EvalCase } from "./dataset.js";
import { detectLanguage, type Language } from "./language.js";
import type { Measurement } from "./metered-classifier.js";

export type OrderNumberOutcome = "correct" | "missed" | "wrong" | "hallucinated" | "not_applicable";
export type ReturnReasonOutcome = "correct" | "missed" | "hallucinated" | "not_applicable";

export type CaseScore = {
  id: string;
  expectedCategory: Category;
  actualCategory: Category | null;
  categoryCorrect: boolean;
  orderNumber: OrderNumberOutcome;
  returnReason: ReturnReasonOutcome;
  summary?: string;
  summaryLanguage?: Language;
  error?: TriageError;
};

export type EvalReport = {
  total: number;
  errors: number;
  categoryAccuracy: number;
  byExpectedCategory: Partial<Record<Category, { total: number; correct: number }>>;
  orderNumber: Record<Exclude<OrderNumberOutcome, "not_applicable">, number>;
  returnReason: Record<Exclude<ReturnReasonOutcome, "not_applicable">, number>;
  // Counted over successful suggestions only.
  summaryLanguage: Record<Language, number>;
  latencyMs: { p50: number; p95: number; max: number };
  tokens: { input: number; output: number };
};

export function scoreCase(
  evalCase: EvalCase,
  result: Result<TriageSuggestion, TriageError>,
): CaseScore {
  const expected = evalCase.expected;

  if (!result.ok) {
    return {
      id: evalCase.id,
      expectedCategory: expected.category,
      actualCategory: null,
      categoryCorrect: false,
      orderNumber: "not_applicable",
      returnReason: "not_applicable",
      error: result.error,
    };
  }

  const actual = result.value;
  return {
    id: evalCase.id,
    expectedCategory: expected.category,
    actualCategory: actual.category,
    categoryCorrect: actual.category === expected.category,
    orderNumber: scoreOrderNumber(expected.orderNumber, actual.extracted.orderNumber),
    returnReason:
      expected.category === "returns"
        ? scoreReturnReason(expected.hasReturnReason, actual.extracted.returnReason)
        : "not_applicable",
    summary: actual.summary,
    summaryLanguage: detectLanguage(actual.summary),
  };
}

function scoreOrderNumber(expected: string | null, actual: string | undefined): OrderNumberOutcome {
  const normalized = actual === undefined ? "" : normalizeOrderNumber(actual);
  if (expected === null) return normalized === "" ? "correct" : "hallucinated";
  if (normalized === "") return "missed";
  return normalized === normalizeOrderNumber(expected) ? "correct" : "wrong";
}

function normalizeOrderNumber(value: string): string {
  return value.trim().replace(/^#/, "");
}

function scoreReturnReason(expected: boolean, actual: string | undefined): ReturnReasonOutcome {
  const present = actual !== undefined && actual.trim() !== "";
  if (expected === present) return "correct";
  return expected ? "missed" : "hallucinated";
}

export function summarize(scores: readonly CaseScore[], measurements: readonly Measurement[]): EvalReport {
  const byExpectedCategory: EvalReport["byExpectedCategory"] = {};
  const orderNumber = { correct: 0, missed: 0, wrong: 0, hallucinated: 0 };
  const returnReason = { correct: 0, missed: 0, hallucinated: 0 };
  const summaryLanguage = { es: 0, en: 0, unknown: 0 };
  let correct = 0;
  let errors = 0;

  for (const score of scores) {
    const bucket = (byExpectedCategory[score.expectedCategory] ??= { total: 0, correct: 0 });
    bucket.total++;
    if (score.categoryCorrect) {
      bucket.correct++;
      correct++;
    }
    if (score.error) errors++;
    if (score.orderNumber !== "not_applicable") orderNumber[score.orderNumber]++;
    if (score.returnReason !== "not_applicable") returnReason[score.returnReason]++;
    if (score.summaryLanguage) summaryLanguage[score.summaryLanguage]++;
  }

  const latencies = measurements.map((m) => m.latencyMs).sort((a, b) => a - b);

  return {
    total: scores.length,
    errors,
    categoryAccuracy: scores.length === 0 ? 0 : correct / scores.length,
    byExpectedCategory,
    orderNumber,
    returnReason,
    summaryLanguage,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? 0,
    },
    tokens: {
      input: sum(measurements.map((m) => m.usage?.inputTokens ?? 0)),
      output: sum(measurements.map((m) => m.usage?.outputTokens ?? 0)),
    },
  };
}

// Nearest-rank percentile over an ascending list.
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.ceil(p * sorted.length) - 1] ?? 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
