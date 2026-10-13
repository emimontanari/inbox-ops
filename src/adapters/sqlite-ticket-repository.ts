import { DatabaseSync } from "node:sqlite";
import type { TicketRepository } from "../application/ticket-repository.js";
import type { Ticket } from "../domain/ticket.js";

// node:sqlite ships with Node 22 (still marked experimental); it is isolated behind
// the TicketRepository port, so swapping it for another driver touches only this file.
//
// Each ticket is stored as a JSON document, with id, status and receivedAt copied
// into columns for querying. The application is the only writer of this table.
export class SqliteTicketRepository implements TicketRepository {
  private constructor(private readonly db: DatabaseSync) {}

  static open(path: string): SqliteTicketRepository {
    const db = new DatabaseSync(path);
    db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        received_at TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      )
    `);
    return new SqliteTicketRepository(db);
  }

  async save(ticket: Ticket): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tickets (id, received_at, status, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           received_at = excluded.received_at, status = excluded.status, data = excluded.data`,
      )
      .run(ticket.id, ticket.receivedAt, ticket.status, JSON.stringify(ticket));
  }

  async findById(id: string): Promise<Ticket | undefined> {
    const row = this.db.prepare("SELECT data FROM tickets WHERE id = ?").get(id);
    return row ? toTicket(row["data"]) : undefined;
  }

  async list(): Promise<Ticket[]> {
    return this.db
      .prepare("SELECT data FROM tickets ORDER BY received_at, id")
      .all()
      .map((row) => toTicket(row["data"]));
  }

  close(): void {
    this.db.close();
  }
}

function toTicket(data: unknown): Ticket {
  if (typeof data !== "string") throw new Error("Corrupted ticket row: data is not text");
  try {
    return JSON.parse(data) as Ticket;
  } catch (error) {
    throw new Error("Corrupted ticket row: data is not valid JSON", { cause: error });
  }
}
