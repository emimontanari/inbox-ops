# HTTP API

All bodies are JSON. Input shapes are validated at the boundary (`400 invalid_body` with details); business rules stay in the domain.

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/tickets` | — | `200 { tickets }`, oldest first | — |
| `POST /api/tickets` | `{ requests: [{ id?, body }] }`, 1 to 200 items | `201 { added, rejected }`; a missing `id` is generated | `400 invalid_body` |
| `POST /api/triage` | optional `{ retryFailed: true }` | `200 { triaged, failed }` | `400 invalid_body` |
| `POST /api/tickets/:id/accept` | — | `200 { ticket }` | `404 not_found`, `409 not_reviewable` |
| `POST /api/tickets/:id/correct` | `{ category, extracted: { orderNumber?, returnReason? } }` | `200 { ticket }` | `400 invalid_body` or `invalid_category`, `404 not_found`, `409 not_reviewable` |
| `POST /api/tickets/:id/draft` | — | `200 { draft: { sentences, sources } }` | `404 not_found`, `409 not_draftable`, `502 drafter_invalid_output`, `503 drafter_unavailable` |

## Reply drafts

`POST /api/tickets/:id/draft` suggests a Spanish reply for a ticket that is `awaiting_review` or `reviewed`; `new` and `triage_failed` tickets return `409 not_draftable`. It spends provider tokens on every call. The draft is returned only: it is not stored, the ticket does not change, and nothing is sent to the customer.

- `sentences`: `[{ text, sourceIds }]` in reading order. `sourceIds` lists the policy passages the model says support the sentence; an empty list means the sentence states no policy or is unsupported.
- `sources`: the cited passages `{ id, title, topics, text }` from `knowledge/store-policies.json`.

The server retrieves up to three passages that share at least two words with the customer message (the ticket category only ranks them), sends only those to the model, and rejects a draft that cites any other id (`502 drafter_invalid_output`). A valid citation shows which passage the model points to; it does not prove the sentence is correct. When no passage matches, the model receives none and the draft cannot cite anything. A reviewed ticket is drafted from the final human triage.

`rejected` items look like `{ index, id, error }`, where `error` is `empty_id`, `empty_body`, `body_too_long` or `duplicate_id`.

## Example

```bash
curl -X POST http://127.0.0.1:3000/api/tickets -H 'content-type: application/json' \
  -d '{"requests":[{"body":"Quiero devolver el pedido 4821, me llegó la talla equivocada"}]}'
curl -X POST http://127.0.0.1:3000/api/triage
curl http://127.0.0.1:3000/api/tickets
```

## Web app and unknown paths

When `web/dist` exists, the same server serves the web app and other non-API paths fall back to `index.html`. An unknown `/api/...` path always answers `404 { "error": "not_found" }` in JSON, never the app's HTML, so a mistyped API URL cannot look like a success.

## Protections

- Request bodies over 1 MB are rejected.
- Unexpected errors return `500 { "error": "internal_error" }` without internal details; the cause is logged on the server.
- Blank `extracted` fields count as not provided.
- Triage failure logs use a constant format string, so a user-provided id cannot forge log lines.

**There is no authentication.** The server listens on `127.0.0.1` by default. Do not expose it publicly: anyone could read requests or spend provider tokens through `/api/triage`.
