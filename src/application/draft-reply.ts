import type { PolicyPassage } from "../domain/policy.js";
import { createReplyDraft, type ReplyDraft } from "../domain/reply-draft.js";
import { fail, type Result } from "../domain/result.js";
import type { Ticket } from "../domain/ticket.js";
import type { DraftContext, ReplyDrafter } from "./reply-drafter.js";
import { retrievePassages } from "./retrieve-passages.js";
import type { TicketRepository } from "./ticket-repository.js";

export type DraftReplyError = "not_found" | "not_draftable" | "drafter_unavailable" | "drafter_invalid_output";

export type DraftReply = (ticketId: string) => Promise<Result<ReplyDraft, DraftReplyError>>;

// Use case: suggest a reply grounded in store policies. Drafts are not stored and never sent;
// a person edits and sends them through their own channel.
export function createDraftReply(deps: {
  repository: TicketRepository;
  drafter: ReplyDrafter;
  passages: readonly PolicyPassage[];
}): DraftReply {
  return async (ticketId) => {
    const ticket = await deps.repository.findById(ticketId);
    if (!ticket) return fail("not_found");

    const triage = currentTriage(ticket);
    if (!triage) return fail("not_draftable");

    const passages = retrievePassages(deps.passages, {
      text: [ticket.body, triage.summary].filter(Boolean).join(" "),
      category: triage.category,
    });
    const context: DraftContext = { customerMessage: ticket.body, ...triage, passages };

    const result = await deps.drafter.draft(context);
    if (!result.ok) return fail(result.error === "unavailable" ? "drafter_unavailable" : "drafter_invalid_output");

    const draft = createReplyDraft(result.value, passages);
    return draft.ok ? draft : fail("drafter_invalid_output");
  };
}

// A reviewed ticket uses the person's final triage; the model summary is kept only as context.
function currentTriage(ticket: Ticket): Omit<DraftContext, "customerMessage" | "passages"> | undefined {
  if (ticket.status === "awaiting_review") {
    const { category, summary, extracted, missingFields } = ticket.suggestion;
    return { category, summary, extracted, missingFields };
  }
  if (ticket.status === "reviewed") {
    const { category, extracted, missingFields } = ticket.review.final;
    return { category, extracted, missingFields, ...(ticket.suggestion && { summary: ticket.suggestion.summary }) };
  }
  return undefined;
}
