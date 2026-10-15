import type { ReviewedTicket } from "./ticket.js";
import type { MissingField } from "./triage-suggestion.js";

export type ReviewField = "category" | "orderNumber" | "returnReason" | "missingFields";
export type ReviewValue = string | readonly MissingField[] | undefined;
export type ReviewComparison = {
  hasOriginal: boolean;
  rows: Array<{ field: ReviewField; before: ReviewValue; after: ReviewValue; changed: boolean | undefined }>;
};

// Compare the one recorded review. No event history, actor or model-generation timestamp is inferred.
export function compareReview(ticket: ReviewedTicket): ReviewComparison {
  const original = ticket.suggestion;
  const final = ticket.review.final;
  const fields: Array<{ field: ReviewField; before: ReviewValue; after: ReviewValue }> = [
    { field: "category", before: original?.category, after: final.category },
    { field: "orderNumber", before: original?.extracted.orderNumber, after: final.extracted.orderNumber },
    { field: "returnReason", before: original?.extracted.returnReason, after: final.extracted.returnReason },
    { field: "missingFields", before: original?.missingFields, after: final.missingFields },
  ];
  return {
    hasOriginal: original !== undefined,
    rows: fields.map(row => ({ ...row, changed: original === undefined ? undefined : !equalValue(row.before, row.after) })),
  };
}

function equalValue(a: ReviewValue, b: ReviewValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    const left = new Set(a); const right = new Set(b);
    return left.size === right.size && [...left].every(value => right.has(value));
  }
  return a === b;
}
