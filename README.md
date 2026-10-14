# InboxOps

AI-assisted support inbox for an online store. For each customer request it suggests a category, a short summary and the data that is missing; a person accepts or corrects the suggestion. It never sends emails or changes orders.

> Status: all seven MVP steps implemented. Local demo only, not production-ready. The holdout found a planted order number and an unfaithful summary; human review remains required.

## Review this project

- [Demo walkthrough](docs/demo.md): import sample requests, classify and review them.
- [Architecture](docs/architecture.md) and [decision records](docs/decisions/README.md): boundaries and trade-offs.
- [Evaluation and known failures](docs/evaluation.md): recorded dev and holdout results, not a claim of production quality.
- [Fresh fidelity diagnostic](docs/fidelity-results-v1.md) and [paired injection mitigation](docs/injection-results-v1.md): real captures with AI-assisted review, uncertainty and limits—not human-scored security guarantees.

## Quick start

Requires Node.js 22 or later.

```bash
npm install
npm run check   # typecheck + tests, no API key needed
npm run triage -- "I want to return order 4821, wrong size"
npm run eval    # scores the real model on the dev split
npm run serve   # HTTP API on http://127.0.0.1:3000
```

Full app (API and web inbox on one port):

```bash
npm --prefix web install
npm run demo    # builds web/ and serves everything on http://127.0.0.1:3000
```

For frontend work with hot reload, run `npm run serve` and, in a second terminal, `npm --prefix web run dev` (http://localhost:5173, proxies `/api` to the API).

## Configuration

`npm run triage`, `npm run eval` and `npm run serve` read a `.env` file in this folder if it exists. Tests never call a real model and need no key.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | yes, for `triage`, `eval` and `serve` | — | Groq API key from <https://console.groq.com/keys> |
| `GROQ_MODEL` | no | `openai/gpt-oss-20b` | Groq model id |
| `EVAL_TOKENS_PER_MINUTE` | no | `8000` | Token budget per minute that `eval` stays under; match your provider's limit |
| `EVAL_REQUEST_TOKEN_ESTIMATE` | no | `2000` | Tokens reserved per request before sending it; Groq budgets each request by its own estimate, not by the tokens finally used |
| `PORT` | no | `3000` | Port for `serve` |
| `HOST` | no | `127.0.0.1` | Interface for `serve`; the API has no authentication, so keep it local |
| `INBOX_DB_PATH` | no | `data/inbox.db` | SQLite file for `serve`; `data/` is ignored by Git |

`.env` is ignored by Git; never commit it.

## Scripts

| Script | What it does |
|---|---|
| `npm run triage -- "<text>"` | Triages one request with the real model and prints the result as JSON; exits 1 on error |
| `npm run serve` | Starts the HTTP API with SQLite storage and the Groq classifier; also serves `web/dist` when it exists |
| `npm run build:web` | Builds the web app into `web/dist` |
| `npm run demo` | `build:web`, then `serve`: the whole app on one port |
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

### Ticket lifecycle

```text
new ──triage ok──────▶ awaiting_review ──accept───▶ reviewed (accepted)
 │                            └─────────correct───▶ reviewed (corrected)
 └──triage failed──▶ triage_failed ────correct────▶ reviewed (manual)
                          └──retry──▶ awaiting_review
```

| Rule | Where |
|---|---|
| A ticket is a discriminated union on `status`: each status carries exactly its data (`suggestion`, `triageError`, `review`) | `src/domain/ticket.ts` |
| Only `new` and `triage_failed` tickets can be triaged; a failed ticket can be retried | `src/domain/ticket.ts` |
| Only `awaiting_review` tickets can be accepted | `src/domain/ticket.ts` |
| `awaiting_review` and `triage_failed` tickets can be corrected; a correction of a failed triage is recorded as `manual` | `src/domain/ticket.ts` |
| A correction recomputes missing data with the same domain rule as the model's suggestion | `src/domain/ticket.ts` |
| The review decision (`accepted`, `corrected`, `manual`) is stored, so the share of human interventions can be measured | `src/domain/ticket.ts` |
| Adding a request with an id that already exists is rejected as `duplicate_id` | `src/application/inbox.ts` |

## Architecture

```text
src/
├── domain/        # business rules, pure TypeScript, no I/O
├── application/   # use cases and ports: triage, review inbox, Classifier, TicketRepository
├── adapters/      # implementations of ports: AI SDK classifier, Groq model, SQLite and in-memory tickets
├── http/          # HTTP API (Hono): input validation and status codes, no business rules
├── evaluation/    # dataset loading, scoring and the eval entry point
├── main.ts        # composition root for the CLI
└── server.ts      # composition root for the API: SQLite, Groq, HTTP server
web/               # React + Vite + Tailwind review inbox, with its own package.json and tests
eval/
├── dataset.json   # 30 hand-labeled requests: 20 dev, 10 holdout
└── results/       # one JSON report per eval run
```

Dependencies point inward: `adapters`, `http` and `application` use `domain`; `domain` depends on nothing. Only the composition roots (`main.ts`, `server.ts`) know which AI provider and storage are used.

Storage uses `node:sqlite`, built into Node 22 but still marked experimental (Node prints a warning). It sits behind the `TicketRepository` port, and one contract test suite runs against both the SQLite and the in-memory implementation, so replacing the driver touches one file.

The AI SDK adapter:

- Asks for structured output validated by a Zod schema; fields the customer did not write come back as `null` and are dropped.
- Sends the customer text in a JSON `customerMessage` field, never inside the system instructions. The prompt distinguishes legitimate support requests from embedded model directives and forbids using directive values as customer facts. This is a prompt-level mitigation, not a security guarantee or order verification.
- Maps unparsable or out-of-schema answers to `invalid_output`, including a provider that validates the schema itself and rejects the generation with HTTP 400 (Groq's `json_validate_failed`). Any other failure (network, timeout of 20 s, rate limit, other provider errors) is `unavailable`.
- Accepts an optional `onError(requestId, error)` hook with the original error, so callers can diagnose failures; the use case only sees the error code.

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

## Web app

`web/` is a React app built with Vite and styled with Tailwind. It has its own `package.json`, so the backend does not install frontend dependencies.

- **Shared types, no copies.** The app imports `Ticket`, `Category` and the inbox result types straight from `src/domain` and `src/application` as type-only imports. A change in the backend contract breaks the web build instead of failing at runtime.
- **Typed API client.** `web/src/api.ts` only calls paths under `/api/`, enforced by its type and at runtime, and turns error responses into an `ApiError` with the HTTP status and the API's error code.
- **Injected client.** `App` receives the API client as a prop, so component tests run without a server.
- **Review panel.** Shows the customer message next to the model's suggestion. A person accepts it, corrects category, order number and return reason, or triages manually when the model failed. While correcting, the panel previews the missing data with `findMissingFields`, the same pure domain function the server uses, so the preview cannot drift from the saved result.
- **Adding requests.** Type one message, or import a CSV with a `body` column and an optional `id` column. A small RFC 4180 parser keeps commas, quotes and line breaks inside messages. Files over 200 rows are sent in batches of 200, the API limit; rejected rows are listed with their reason.
- **Triage on demand.** "Run triage" classifies new tickets and "Retry failed" retries the failed ones. Triage never runs on page load because it spends provider tokens.
- **Review stats.** Acceptance rate, suggestions accepted and corrected, and manual triage, computed by `summarizeReviews` in the domain. The acceptance rate is accepted / (accepted + corrected): manual triage is left out because the model gave no suggestion to accept.
- **Server as source of truth.** After a review the UI replaces the ticket with the one the API returned, and API errors (for example a ticket already reviewed) are shown without changing the ticket.

| Script, inside `web/` | What it does |
|---|---|
| `npm run dev` | Vite dev server; `/api` is proxied to `http://127.0.0.1:3000` |
| `npm run build` | Production build in `web/dist/`, served by `npm run serve` |
| `npm run check` | Typecheck and tests (Vitest with jsdom and Testing Library) |

La interfaz está en español; los resúmenes de solicitudes también se muestran en español porque el equipo de soporte los lee en ese idioma.

## HTTP API

All bodies are JSON. Input shapes are validated at the boundary (`400 invalid_body` with details); business rules stay in the domain.

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/tickets` | — | `200 { tickets }`, oldest first | — |
| `POST /api/tickets` | `{ requests: [{ id?, body }] }`, 1 to 200 items | `201 { added, rejected }`; a missing `id` is generated | `400 invalid_body` |
| `POST /api/triage` | optional `{ retryFailed: true }` | `200 { triaged, failed }` | `400 invalid_body` |
| `POST /api/tickets/:id/accept` | — | `200 { ticket }` | `404 not_found`, `409 not_reviewable` |
| `POST /api/tickets/:id/correct` | `{ category, extracted: { orderNumber?, returnReason? } }` | `200 { ticket }` | `400 invalid_body` or `invalid_category`, `404 not_found`, `409 not_reviewable` |
| `POST /api/tickets/:id/draft` | — | `200 { draft: { sentences, sources } }`; not stored, never sent | `404 not_found`, `409 not_draftable`, `502 drafter_invalid_output`, `503 drafter_unavailable` |

When `web/dist` exists the same server serves the web app; other non-API paths fall back to `index.html`. An unknown `/api/...` path always answers `404 { error: "not_found" }` in JSON, never the app's HTML.

Other protections: request bodies over 1 MB are rejected, unexpected errors return `500 { error: "internal_error" }` without internal details, and blank `extracted` fields count as not provided.

**There is no authentication.** The server listens on `127.0.0.1` by default; do not expose it publicly, since anyone could read requests or spend provider tokens through `/api/triage`.

## Evaluation

`eval/dataset.json` holds hand-labeled requests with the expected category, order number and whether a return reason is present. Tags group them: `easy`, `missing-data`, `ambiguous`, `tricky`, `injection`, `out-of-scope`, plus language (`es`, `en`).

- **`dev` (20 cases):** used while changing prompts or models.
- **`holdout` (10 cases):** not looked at while iterating; run it only to confirm a final result, otherwise it stops being an honest measure.

Each run scores:

| Metric | How |
|---|---|
| Category accuracy | Exact match with the label, overall and per expected category |
| Order number | `correct`, `missed`, `wrong` or `hallucinated` (the label expects no number, but the model returned one, including a number planted by injection); a leading `#` is ignored |
| Return reason | Only for `returns` cases: `correct`, `missed` or `hallucinated` |
| Latency | p50, p95 and max per model call, measured by a decorator around the classifier |
| Tokens | Input and output tokens reported by the provider |
| Summary language | `es`, `en` or `unknown` per successful suggestion, by a word-list heuristic; summaries must be Spanish |

Failed cases keep a `cause` in the results file (error name, HTTP status and a short message, with provider organization ids redacted), so an `unavailable` result can be diagnosed.

Cost is reported as tokens; multiply by your provider's current price per token.

The run is sequential and paced by a one-minute sliding token window (`EVAL_TOKENS_PER_MINUTE`), so a provider rate limit is not counted as a quality failure. Pacing makes a run slower: a little over a minute for the dev split on Groq's on-demand tier.

### Recorded holdout result

The saved run of 10 holdout cases returned **9/10 correct categories**, with one provider-side invalid output. It also extracted an order number planted by prompt injection. All nine successful summaries were labeled Spanish by the heuristic, but one reversed who issued a refund. Language detection does not measure faithfulness.

Latency: p50 0.99 s, p95 1.46 s. Usage: 3,800 input and 2,619 output tokens; no monetary cost was calculated. See the [full report and limitations](docs/evaluation.md) and [raw saved run](eval/results/holdout-2026-10-13T19-30-40.756Z.json). The holdout was not rerun or used to tune the prompt after these findings.

### Dev results

`openai/gpt-oss-20b` on Groq, 20 dev cases, three runs in order:

1. **Baseline:** no rule for the summary language.
2. **Spanish summaries:** the product decision is that summaries are always in Spanish.
3. **Paced eval:** same prompt, with the eval paced under the token limit and Groq's JSON rejections mapped to `invalid_output`.

| Metric | 1. Baseline | 2. Spanish summaries | 3. Paced eval |
|---|---|---|---|
| Category correct | 20/20 | 17/20: 2 errors, 1 wrong | **19/20**: 1 invalid output, 0 wrong |
| Order number | 20 correct, 0 hallucinated | 18 correct, 0 hallucinated | 19 correct, **0 hallucinated** |
| Return reason | 4 correct, 1 missed | 3 correct, 1 missed | 4 correct, 1 missed |
| Summaries in Spanish | 2/20 | 18/18 | 18/19, 1 `unknown` |
| Latency | p50 0.74 s, p95 5.65 s | p50 0.72 s, p95 11.36 s | p50 0.73 s, **p95 1.06 s** |
| Tokens | 7,952 in, 5,146 out | 7,612 in, 6,070 out | 8,016 in, 3,919 out |

What the results files show:

- **The long latency tail was rate limiting.** Runs 1 and 2 hit Groq's 8,000 tokens-per-minute limit; the SDK retried with backoff, which produced the 5 to 11 s p95. With pacing there were no 429 errors and the p95 dropped to 1.06 s. An earlier hypothesis blamed the model's internal reasoning; the data did not support it.
- **Provider-side schema rejection (400).** Groq validates the JSON schema itself and sometimes rejects a generation (`ret-04` in run 2, `oth-01` in run 3). These are now `invalid_output`, not `unavailable`, so they count as quality failures.
- **Detector false positive.** In run 1 one English summary quoting "en distribución" was counted as Spanish. In run 3 the summary for "hola" was just "Hola": too short to detect, and not useful to a reader.
- **Non-determinism:** `tricky-02` (a package that arrived open with a missing item) was `shipping` in the first run and `returns` in the second. Ambiguous cases can flip between runs, so one run is not enough to compare prompts.
- **Debatable label:** `ret-02` (exchange for another size) expects a return reason; the model does not extract one.
- 20 cases are a small sample: treat the numbers as a baseline, not as proof.

## Roadmap

1. Project scaffold — done
2. Domain model: request, categories and triage result — done
3. Triage use case behind a classifier port, tested with a fake — done
4. AI SDK adapter with structured output — done
5. Labeled dataset and evaluation (errors, latency, cost) — done
6. Review inbox: accept or correct suggestions — done
7. Architecture notes, decisions, demo walkthrough and recorded holdout evaluation — done
