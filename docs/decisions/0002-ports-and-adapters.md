# 0002. Ports and adapters with composition roots

- **Status:** accepted
- **Date:** 2026-10-13

## Context

The project depends on things that change or cost money: an LLM provider, a database, an HTTP framework. Tests must run fast, offline and without spending tokens.

## Decision

- The application defines two ports: `Classifier` and `TicketRepository`.
- Adapters implement them: the AI SDK classifier, SQLite and in-memory repositories.
- Dependencies are passed by hand (`createTriageRequest({ classifier })`), with no DI framework.
- Each entry point has a composition root (`main.ts`, `server.ts`, `run-eval.ts`) and only those files know the concrete provider and storage.
- Dependencies point inward: the domain imports nothing from other layers.

## Consequences

- Use cases are tested with a `FakeClassifier` and an in-memory repository: no network, no tokens.
- Changing the provider means a new adapter or a different model in a composition root; the domain and use cases stay as they are.
- A small amount of wiring code is repeated across the three composition roots. Model setup is shared in `groq-model.ts`.
- This is a modular monolith. Splitting it into services would add deployment and network concerns without a current need.
