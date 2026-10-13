# InboxOps

AI-assisted support inbox for an online store. For each customer request it suggests a category, a short summary and the data that is missing; a person accepts or corrects the suggestion. It never sends emails or changes orders.

> Status: step 5 of 7 — evaluation. See [the task plan](../odd/tasks/inbox-ops.md).

## Quick start

Requires Node.js 22 or later.

```bash
npm install
npm run check   # typecheck + tests, no API key needed
npm run triage -- "I want to return order 4821, wrong size"
npm run eval    # scores the real model on the dev split
```

## Configuration

`npm run triage` and `npm run eval` read a `.env` file in this folder if it exists. Tests never call a real model and need no key.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | yes, for `triage` and `eval` | — | Groq API key from <https://console.groq.com/keys> |
| `GROQ_MODEL` | no | `openai/gpt-oss-20b` | Groq model id |

`.env` is ignored by Git; never commit it.

## Scripts

| Script | What it does |
|---|---|
| `npm run triage -- "<text>"` | Triages one request with the real model and prints the result as JSON; exits 1 on error |
| `npm run eval -- [--split=dev\|holdout\|all]` | Runs the real pipeline over the labeled dataset, prints the report and saves it to `eval/results/`; default split is `dev` |
| `npm run typecheck` | Type-checks sources and tests without emitting files |
| `npm test` | Runs the test suite once with Vitest |
| `npm run test:watch` | Runs tests in watch mode |
| `npm run check` | Typecheck and tests together |
| `npm run build` | Compiles `src/` to `dist/` |

## Domain rules

| Rule | Where |
|---|---|
| A request needs an id and a non-empty body of at most 4000 characters | `src/domain/support-request.ts` |
| Categories are `shipping`, `billing`, `returns` and `other` | `src/domain/category.ts` |
| A suggestion needs a known category and a summary of at most 280 characters | `src/domain/triage-suggestion.ts` |
| Missing data is decided by code, not by the model: shipping and billing need an order number; returns need an order number and a reason | `src/domain/triage-suggestion.ts` |

Validation returns a `Result` with an error code instead of throwing, because invalid input is expected, not exceptional.

## Architecture

```text
src/
├── domain/        # business rules, pure TypeScript, no I/O
├── application/   # use cases and ports (interfaces they depend on)
├── adapters/      # implementations of ports: AI SDK classifier, Groq model setup
├── evaluation/    # dataset loading, scoring and the eval entry point
└── main.ts        # composition root: picks the provider and wires everything
eval/
├── dataset.json   # 30 hand-labeled requests: 20 dev, 10 holdout
└── results/       # one JSON report per eval run
```

Dependencies point inward: `adapters` and `application` use `domain`; `domain` depends on nothing. Only `main.ts` knows which AI provider is used.

The AI SDK adapter:

- Asks for structured output validated by a Zod schema; fields the customer did not write come back as `null` and are dropped.
- Sends the customer text as the user message, never inside the instructions, and tells the model to treat it as data. This reduces prompt injection risk; it does not remove it.
- Maps unparsable or out-of-schema answers to `invalid_output`, and any other failure (network, timeout of 20 s, provider error) to `unavailable`.

The triage use case:

1. Validates the request. An invalid request never reaches the model, so it costs nothing.
2. Calls the `Classifier` port. Outages and unparsable output become error codes; a classifier that throws counts as unavailable.
3. Validates the classifier output through the domain, which also computes the missing data.

| Error code | Meaning |
|---|---|
| `empty_id`, `empty_body`, `body_too_long` | Invalid request; the classifier was not called |
| `classifier_unavailable` | The classifier failed or threw |
| `classifier_invalid_output` | The classifier answered with output it could not parse |
| `invalid_category`, `empty_summary`, `summary_too_long` | The classifier answered, but the domain rejected the suggestion |

## Evaluation

`eval/dataset.json` holds hand-labeled requests with the expected category, order number and whether a return reason is present. Tags group them: `easy`, `missing-data`, `ambiguous`, `tricky`, `injection`, `out-of-scope`, plus language (`es`, `en`).

- **`dev` (20 cases):** used while changing prompts or models.
- **`holdout` (10 cases):** not looked at while iterating; run it only to confirm a final result, otherwise it stops being an honest measure.

Each run scores:

| Metric | How |
|---|---|
| Category accuracy | Exact match with the label, overall and per expected category |
| Order number | `correct`, `missed`, `wrong` or `hallucinated` (the model returned a number the customer never wrote); a leading `#` is ignored |
| Return reason | Only for `returns` cases: `correct`, `missed` or `hallucinated` |
| Latency | p50, p95 and max per model call, measured by a decorator around the classifier |
| Tokens | Input and output tokens reported by the provider |
| Summary language | `es`, `en` or `unknown` per successful suggestion, by a word-list heuristic; summaries must be Spanish |

Failed cases keep a `cause` in the results file (error name, HTTP status and a short message, with provider organization ids redacted), so an `unavailable` result can be diagnosed.

Cost is reported as tokens; multiply by your provider's current price per token.

### Dev results

`openai/gpt-oss-20b` on Groq, 20 dev cases. Summaries must be in Spanish (product decision); the instructions were changed between the two runs.

| Metric | Before: no language rule | After: summaries in Spanish |
|---|---|---|
| Category correct | 20/20 | 17/20: 2 errors, 1 wrong (`tricky-02`) |
| Order number | 20 correct, 0 hallucinated | 18 correct, 0 hallucinated |
| Return reason | 4 correct, 1 missed | 3 correct, 1 missed |
| Summaries in Spanish | 2/20 (one is a false positive of the detector) | 18/18 |
| Latency | p50 0.74 s, p95 5.65 s | p50 0.72 s, p95 11.36 s |
| Tokens | 7,952 in, 5,146 out | 7,612 in, 6,070 out |

What the results files show:

- **Rate limit (429):** Groq allows 8,000 tokens per minute for this model and a sequential run uses more. `noise-01` failed for that reason; it is an evaluation pacing problem, not a quality problem.
- **Provider-side JSON failure (400):** Groq rejected `ret-04` with "Failed to generate JSON". The adapter currently reports it as `unavailable`; it should be `invalid_output`.
- **Non-determinism:** `tricky-02` (a package that arrived open with a missing item) was `shipping` in the first run and `returns` in the second. Ambiguous cases can flip between runs, so one run is not enough to compare prompts.
- **Debatable label:** `ret-02` (exchange for another size) expects a return reason; the model does not extract one.
- 20 cases are a small sample: treat the numbers as a baseline, not as proof.

## Roadmap

1. Project scaffold — done
2. Domain model: request, categories and triage result — done
3. Triage use case behind a classifier port, tested with a fake — done
4. AI SDK adapter with structured output — done
5. Labeled dataset and evaluation (errors, latency, cost) — done
6. Review inbox: accept or correct suggestions
7. Architecture notes, decisions and demo
