import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryTicketRepository } from "../../src/adapters/in-memory-ticket-repository.js";
import { SqliteTicketRepository } from "../../src/adapters/sqlite-ticket-repository.js";
import type { TicketRepository } from "../../src/application/ticket-repository.js";
import type { Ticket } from "../../src/domain/ticket.js";

const newTicket: Ticket = {
  id: "t-1",
  body: "¿Dónde está mi pedido 1234?",
  receivedAt: "2026-10-13T10:00:00.000Z",
  status: "new",
};

const reviewedTicket: Ticket = {
  ...newTicket,
  status: "reviewed",
  suggestion: {
    requestId: "t-1",
    category: "shipping",
    summary: "Consulta por el pedido 1234.",
    extracted: { orderNumber: "1234" },
    missingFields: [],
  },
  review: {
    decision: "accepted",
    reviewedAt: "2026-10-13T10:05:00.000Z",
    final: { category: "shipping", extracted: { orderNumber: "1234" }, missingFields: [] },
  },
};

// The same behavior is required from every implementation of the port.
const implementations: Array<[string, () => TicketRepository]> = [
  ["in memory", () => new InMemoryTicketRepository()],
  ["SQLite", () => SqliteTicketRepository.open(":memory:")],
];

describe.each(implementations)("TicketRepository contract: %s", (_name, create) => {
  it("finds a saved ticket by id", async () => {
    const repository = create();

    await repository.save(newTicket);

    expect(await repository.findById("t-1")).toEqual(newTicket);
  });

  it("returns undefined for an unknown id", async () => {
    expect(await create().findById("missing")).toBeUndefined();
  });

  it("replaces a ticket saved again with the same id", async () => {
    const repository = create();

    await repository.save(newTicket);
    await repository.save(reviewedTicket);

    expect(await repository.findById("t-1")).toEqual(reviewedTicket);
    expect(await repository.list()).toHaveLength(1);
  });

  it("lists every saved ticket", async () => {
    const repository = create();

    await repository.save(newTicket);
    await repository.save({ ...newTicket, id: "t-2" });

    expect((await repository.list()).map((t) => t.id).sort()).toEqual(["t-1", "t-2"]);
  });
});

describe("SqliteTicketRepository", () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("keeps tickets after the database is closed and opened again", async () => {
    dir = mkdtempSync(join(tmpdir(), "inbox-ops-"));
    const file = join(dir, "inbox.db");

    const first = SqliteTicketRepository.open(file);
    await first.save(reviewedTicket);
    first.close();

    const second = SqliteTicketRepository.open(file);
    expect(await second.findById("t-1")).toEqual(reviewedTicket);
    second.close();
  });
});
