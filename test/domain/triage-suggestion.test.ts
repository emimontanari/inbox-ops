import { describe, expect, it } from "vitest";
import { CATEGORIES, isCategory } from "../../src/domain/category.js";
import {
  MAX_SUMMARY_LENGTH,
  createTriageSuggestion,
  type TriageSuggestionInput,
} from "../../src/domain/triage-suggestion.js";

const validInput: TriageSuggestionInput = {
  requestId: "req-1",
  category: "shipping",
  summary: "Customer asks where order 1234 is.",
  extracted: { orderNumber: "1234" },
};

describe("isCategory", () => {
  it("accepts every supported category", () => {
    expect(CATEGORIES).toEqual(["shipping", "billing", "returns", "other"]);
    for (const category of CATEGORIES) {
      expect(isCategory(category)).toBe(true);
    }
  });

  it("rejects an unknown category", () => {
    expect(isCategory("refunds")).toBe(false);
  });
});

describe("createTriageSuggestion", () => {
  it("creates a suggestion with no missing fields when required data is present", () => {
    const result = createTriageSuggestion(validInput);

    expect(result).toEqual({
      ok: true,
      value: {
        requestId: "req-1",
        category: "shipping",
        summary: "Customer asks where order 1234 is.",
        extracted: { orderNumber: "1234" },
        missingFields: [],
      },
    });
  });

  it("flags the order number as missing for billing requests", () => {
    const result = createTriageSuggestion({ ...validInput, category: "billing", extracted: {} });

    expect(result.ok && result.value.missingFields).toEqual(["order_number"]);
  });

  it("flags order number and return reason as missing for returns", () => {
    const result = createTriageSuggestion({ ...validInput, category: "returns", extracted: {} });

    expect(result.ok && result.value.missingFields).toEqual(["order_number", "return_reason"]);
  });

  it("requires no data for the other category", () => {
    const result = createTriageSuggestion({ ...validInput, category: "other", extracted: {} });

    expect(result.ok && result.value.missingFields).toEqual([]);
  });

  it("treats a blank extracted value as missing", () => {
    const result = createTriageSuggestion({ ...validInput, extracted: { orderNumber: "   " } });

    expect(result.ok && result.value.missingFields).toEqual(["order_number"]);
  });

  it("rejects an unknown category", () => {
    const result = createTriageSuggestion({ ...validInput, category: "refunds" });

    expect(result).toEqual({ ok: false, error: "invalid_category" });
  });

  it("rejects an empty summary", () => {
    const result = createTriageSuggestion({ ...validInput, summary: "  " });

    expect(result).toEqual({ ok: false, error: "empty_summary" });
  });

  it("accepts a summary at the maximum length", () => {
    const result = createTriageSuggestion({ ...validInput, summary: "a".repeat(MAX_SUMMARY_LENGTH) });

    expect(result.ok).toBe(true);
  });

  it("rejects a summary longer than the maximum length", () => {
    const result = createTriageSuggestion({
      ...validInput,
      summary: "a".repeat(MAX_SUMMARY_LENGTH + 1),
    });

    expect(result).toEqual({ ok: false, error: "summary_too_long" });
  });
});
