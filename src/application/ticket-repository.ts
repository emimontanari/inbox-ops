import type { Ticket } from "../domain/ticket.js";

// Port: where tickets live. The inbox does not know whether it is memory or a database.
export interface TicketRepository {
  save(ticket: Ticket): Promise<void>;
  findById(id: string): Promise<Ticket | undefined>;
  list(): Promise<Ticket[]>;
}
