# 0005. SQLite (`node:sqlite`) behind a repository port

- **Status:** accepted
- **Date:** 2026-10-13

## Context

Tickets must survive a server restart. The app is a single-user local tool for now, and setup should not require a database server.

## Decision

- Store tickets with `node:sqlite`, built into Node 22, so there is no native dependency to install.
- Each ticket is a JSON document, with `id`, `status` and `receivedAt` copied into columns for ordering and querying.
- Keep it behind the `TicketRepository` port, with one contract test suite that runs against both the SQLite and the in-memory implementation.
- Keep the database file in `data/`, ignored by Git, so real customer messages are never committed.

## Consequences

- `node:sqlite` is still marked experimental and Node prints a warning. If its API changes, only `sqlite-ticket-repository.ts` changes, and the contract suite proves the replacement behaves the same.
- Storing documents keeps the schema simple while the ticket shape evolves. Reporting queries over nested fields would need extra columns or a migration.
- One file and one process: no concurrent writers and no multi-user deployment. Moving to Postgres would be a new adapter that passes the same contract tests.
