# 0001. The model extracts; the domain decides

- **Status:** accepted
- **Date:** 2026-10-13

## Context

A triage suggestion needs a category, a summary and a list of missing data. A model could produce all three, including "what is missing". But which data a return needs is a business rule: it must be stable, testable and change only when the business changes it, not when the prompt or the model changes.

## Decision

The model only extracts: category, summary, and the data the customer actually wrote (order number, return reason). The domain decides:

- whether the category is valid (`isCategory`), even though the schema already restricts it;
- which data is missing for that category (`findMissingFields`).

The same `findMissingFields` runs on the server and in the web app's correction form.

## Consequences

- The missing-data rule is plain TypeScript with unit tests; changing the model cannot change it silently.
- The evaluation can measure extraction separately (order number `correct`, `missed`, `wrong`, `hallucinated`) from the rule.
- The model output is treated as untrusted input and validated twice: by the schema in the adapter and by the domain.
- Extraction can still be wrong in ways the domain cannot see, such as a number planted by prompt injection. See [0006](0006-prompt-injection-limits.md).
