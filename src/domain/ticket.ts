import { isCategory, type Category } from "./category.js";
import { fail, ok, type Result } from "./result.js";
import { createSupportRequest, type SupportRequestError } from "./support-request.js";
import type { TriageError } from "./triage-error.js";
import {
  findMissingFields,
  type ExtractedData,
  type MissingField,
  type TriageSuggestion,
} from "./triage-suggestion.js";

type TicketBase = {
  readonly id: string;
  readonly body: string;
  readonly receivedAt: string;
};

// A discriminated union: each status carries exactly the data that status needs,
// so states like "reviewed without a review" cannot be represented.
export type NewTicket = TicketBase & { readonly status: "new" };

export type FailedTicket = TicketBase & {
  readonly status: "triage_failed";
  readonly triageError: TriageError;
};

export type AwaitingReviewTicket = TicketBase & {
  readonly status: "awaiting_review";
  readonly suggestion: TriageSuggestion;
};

export type ReviewedTicket = TicketBase & {
  readonly status: "reviewed";
  readonly suggestion?: TriageSuggestion;
  readonly triageError?: TriageError;
  readonly review: Review;
};

export type Ticket = NewTicket | FailedTicket | AwaitingReviewTicket | ReviewedTicket;

export type TicketStatus = Ticket["status"];

// accepted: the person kept the model's suggestion; corrected: the person changed it;
// manual: the model had failed and the person triaged from scratch.
export type ReviewDecision = "accepted" | "corrected" | "manual";

export type FinalTriage = {
  readonly category: Category;
  readonly extracted: ExtractedData;
  readonly missingFields: readonly MissingField[];
};

export type Review = {
  readonly decision: ReviewDecision;
  readonly reviewedAt: string;
  readonly final: FinalTriage;
};

// Category is a plain string because it comes from a person filling a form.
export type CorrectionInput = {
  category: string;
  extracted: ExtractedData;
};

export type RecordTriageError = "already_triaged";
export type ReviewError = "not_reviewable" | "invalid_category";

export function createTicket(input: {
  id: string;
  body: string;
  receivedAt: string;
}): Result<NewTicket, SupportRequestError> {
  const request = createSupportRequest(input);
  if (!request.ok) return request;
  return ok({ ...request.value, receivedAt: input.receivedAt, status: "new" });
}

export function recordTriage(
  ticket: Ticket,
  result: Result<TriageSuggestion, TriageError>,
): Result<AwaitingReviewTicket | FailedTicket, RecordTriageError> {
  if (ticket.status !== "new" && ticket.status !== "triage_failed") return fail("already_triaged");

  const base = baseOf(ticket);
  return ok(
    result.ok
      ? { ...base, status: "awaiting_review", suggestion: result.value }
      : { ...base, status: "triage_failed", triageError: result.error },
  );
}

export function acceptSuggestion(ticket: Ticket, reviewedAt: string): Result<ReviewedTicket, "not_reviewable"> {
  if (ticket.status !== "awaiting_review") return fail("not_reviewable");

  const { category, extracted, missingFields } = ticket.suggestion;
  return ok({
    ...ticket,
    status: "reviewed",
    review: { decision: "accepted", reviewedAt, final: { category, extracted, missingFields } },
  });
}

export function correctTriage(
  ticket: Ticket,
  input: CorrectionInput,
  reviewedAt: string,
): Result<ReviewedTicket, ReviewError> {
  if (ticket.status !== "awaiting_review" && ticket.status !== "triage_failed") return fail("not_reviewable");
  if (!isCategory(input.category)) return fail("invalid_category");

  const final: FinalTriage = {
    category: input.category,
    extracted: input.extracted,
    missingFields: findMissingFields(input.category, input.extracted),
  };
  const decision: ReviewDecision = ticket.status === "triage_failed" ? "manual" : "corrected";
  return ok({ ...ticket, status: "reviewed", review: { decision, reviewedAt, final } });
}

function baseOf(ticket: Ticket): TicketBase {
  return { id: ticket.id, body: ticket.body, receivedAt: ticket.receivedAt };
}
