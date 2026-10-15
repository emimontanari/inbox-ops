import { fail, type Result } from "../domain/result.js";
import { parseReceivedAt, type ReceivedAtError } from "../domain/received-at.js";
import type { SupportRequestError } from "../domain/support-request.js";
import {
  acceptSuggestion,
  correctTriage,
  createTicket,
  recordTriage,
  type CorrectionInput,
  type ReviewError,
  type ReviewedTicket,
  type Ticket,
} from "../domain/ticket.js";
import type { TicketRepository } from "./ticket-repository.js";
import type { TriageRequest } from "./triage-request.js";

export type AddRequestsResult = {
  added: string[];
  rejected: Array<{ index: number; id: string; error: SupportRequestError | ReceivedAtError | "duplicate_id" }>;
};

export type TriageOutcome = { triaged: number; failed: number };

export type Inbox = ReturnType<typeof createInbox>;

// Application service: the use cases of the review inbox, wired to a repository and the triage use case.
export function createInbox(deps: {
  repository: TicketRepository;
  triageRequest: TriageRequest;
  now: () => string;
}) {
  const { repository } = deps;

  async function review(
    id: string,
    apply: (ticket: Ticket) => Result<ReviewedTicket, ReviewError>,
  ): Promise<Result<ReviewedTicket, ReviewError | "not_found">> {
    const ticket = await repository.findById(id);
    if (!ticket) return fail("not_found");

    const reviewed = apply(ticket);
    if (reviewed.ok) await repository.save(reviewed.value);
    return reviewed;
  }

  return {
    async addRequests(inputs: ReadonlyArray<{ id: string; body: string; receivedAt?: string }>): Promise<AddRequestsResult> {
      const result: AddRequestsResult = { added: [], rejected: [] };
      const now = deps.now();
      for (const [index, input] of inputs.entries()) {
        const received = parseReceivedAt(input.receivedAt ?? now, now);
        if (!received.ok) {
          result.rejected.push({ index, id: input.id, error: received.error });
          continue;
        }
        const ticket = createTicket({ ...input, receivedAt: received.value });
        if (!ticket.ok) {
          result.rejected.push({ index, id: input.id, error: ticket.error });
        } else if (await repository.findById(ticket.value.id)) {
          result.rejected.push({ index, id: input.id, error: "duplicate_id" });
        } else {
          await repository.save(ticket.value);
          result.added.push(ticket.value.id);
        }
      }
      return result;
    },

    // Sequential on purpose: keeps the provider's rate limit predictable.
    async triagePending(options: { retryFailed?: boolean } = {}): Promise<TriageOutcome> {
      const outcome: TriageOutcome = { triaged: 0, failed: 0 };
      const pending = (await repository.list()).filter(
        (ticket) => ticket.status === "new" || (options.retryFailed === true && ticket.status === "triage_failed"),
      );

      for (const ticket of pending) {
        const result = await deps.triageRequest({ id: ticket.id, body: ticket.body });
        const updated = recordTriage(ticket, result);
        if (!updated.ok) continue;
        await repository.save(updated.value);
        if (updated.value.status === "awaiting_review") outcome.triaged++;
        else outcome.failed++;
      }
      return outcome;
    },

    accept(id: string) {
      return review(id, (ticket) => acceptSuggestion(ticket, deps.now()));
    },

    correct(id: string, input: CorrectionInput) {
      return review(id, (ticket) => correctTriage(ticket, input, deps.now()));
    },

    async list(): Promise<Ticket[]> {
      const tickets = await repository.list();
      return tickets.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
    },
  };
}
