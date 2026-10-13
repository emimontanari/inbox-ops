import type { TicketRepository } from "../application/ticket-repository.js";
import type { Ticket } from "../domain/ticket.js";

// Used by tests and local experiments; data is lost when the process exits.
export class InMemoryTicketRepository implements TicketRepository {
  private readonly tickets = new Map<string, Ticket>();

  async save(ticket: Ticket): Promise<void> {
    this.tickets.set(ticket.id, ticket);
  }

  async findById(id: string): Promise<Ticket | undefined> {
    return this.tickets.get(id);
  }

  async list(): Promise<Ticket[]> {
    return [...this.tickets.values()];
  }
}
