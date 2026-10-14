# 0004. A person reviews every suggestion; no automatic actions

- **Status:** accepted
- **Date:** 2026-10-13

## Context

Triage mistakes have a cost: a refund request filed as shipping, an order number taken from a prompt injection. The model is right most of the time, not always, and some failures cannot be detected automatically.

## Decision

- The system only suggests. A person accepts, corrects or triages manually; nothing is sent to customers and no order is changed.
- When the model fails, the ticket stays usable: it can be retried or triaged manually.
- Each review stores its decision (`accepted`, `corrected`, `manual`), so the share of human interventions is measurable.
- Triage runs only when a person asks for it, because it spends provider tokens.

## Consequences

- The acceptance rate, accepted / (accepted + corrected), is the product metric, closer to real value than accuracy on a dataset.
- Errors the evaluation cannot catch, such as an unfaithful summary, are caught by the reviewer, who sees the original message next to the suggestion.
- Throughput is limited by people. Automating actions would need verification against real systems first (for example, that the order exists and belongs to the customer).
