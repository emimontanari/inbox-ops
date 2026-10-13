import { isCategory, type Category } from "./category.js";
import { fail, ok, type Result } from "./result.js";

export const MAX_SUMMARY_LENGTH = 280;

// Data the model may find in the request text. The model only extracts;
// deciding what is missing is a business rule owned by this module.
export type ExtractedData = {
  readonly orderNumber?: string;
  readonly returnReason?: string;
};

export type MissingField = "order_number" | "return_reason";

const REQUIRED_FIELDS: Record<Category, readonly MissingField[]> = {
  shipping: ["order_number"],
  billing: ["order_number"],
  returns: ["order_number", "return_reason"],
  other: [],
};

const FIELD_VALUE: Record<MissingField, (data: ExtractedData) => string | undefined> = {
  order_number: (data) => data.orderNumber,
  return_reason: (data) => data.returnReason,
};

export type TriageSuggestion = {
  readonly requestId: string;
  readonly category: Category;
  readonly summary: string;
  readonly extracted: ExtractedData;
  readonly missingFields: readonly MissingField[];
};

// Category is a plain string here because it comes from an untrusted source (the model).
export type TriageSuggestionInput = {
  requestId: string;
  category: string;
  summary: string;
  extracted: ExtractedData;
};

export type TriageSuggestionError = "invalid_category" | "empty_summary" | "summary_too_long";

export function createTriageSuggestion(
  input: TriageSuggestionInput,
): Result<TriageSuggestion, TriageSuggestionError> {
  if (!isCategory(input.category)) return fail("invalid_category");

  const summary = input.summary.trim();
  if (summary === "") return fail("empty_summary");
  if (summary.length > MAX_SUMMARY_LENGTH) return fail("summary_too_long");

  return ok({
    requestId: input.requestId,
    category: input.category,
    summary,
    extracted: input.extracted,
    missingFields: findMissingFields(input.category, input.extracted),
  });
}

function findMissingFields(category: Category, data: ExtractedData): MissingField[] {
  return REQUIRED_FIELDS[category].filter((field) => {
    const value = FIELD_VALUE[field](data);
    return value === undefined || value.trim() === "";
  });
}
