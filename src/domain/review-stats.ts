import type { ReviewDecision, Ticket, TicketStatus } from "./ticket.js";

export type ReviewStats = {
  total: number;
  byStatus: Record<TicketStatus, number>;
  decisions: Record<ReviewDecision, number>;
  // Share of reviewed suggestions kept as the model proposed them: accepted / (accepted + corrected).
  // Manual triage is left out because the model gave no suggestion to accept. Null until there is data.
  acceptanceRate: number | null;
  // Corrections where the person changed the category, not only the extracted data.
  categoryChanges: number;
};

export function summarizeReviews(tickets: readonly Ticket[]): ReviewStats {
  const byStatus: Record<TicketStatus, number> = { new: 0, awaiting_review: 0, triage_failed: 0, reviewed: 0 };
  const decisions: Record<ReviewDecision, number> = { accepted: 0, corrected: 0, manual: 0 };
  let categoryChanges = 0;

  for (const ticket of tickets) {
    byStatus[ticket.status]++;
    if (ticket.status !== "reviewed") continue;

    decisions[ticket.review.decision]++;
    if (ticket.review.decision === "corrected" && ticket.suggestion?.category !== ticket.review.final.category) {
      categoryChanges++;
    }
  }

  const judged = decisions.accepted + decisions.corrected;
  return {
    total: tickets.length,
    byStatus,
    decisions,
    acceptanceRate: judged === 0 ? null : decisions.accepted / judged,
    categoryChanges,
  };
}
