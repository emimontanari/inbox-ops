# Demo: classify requests, then review them

InboxOps suggests a category, a Spanish summary and missing information for a store's support requests. A person reviews the suggestion; no emails are sent and no orders are changed. Allow about five minutes, plus provider latency.

## Start locally

From the repository root, with Node.js 22 or later:

```bash
npm ci
npm --prefix web ci
npm run check
npm --prefix web run check
npm run demo
```

Before starting the server, configure `GROQ_API_KEY` in a local, Git-ignored `.env`. The default model is `openai/gpt-oss-20b`; see [configuration](../README.md#configuration). Never include the key in screenshots or commit it.

Open <http://127.0.0.1:3000>. The server uses `data/inbox.db`, so requests and reviews survive restarts. Keep the default local binding: there is no authentication.

For an isolated demo without touching your existing inbox, use this instead of `npm run demo` (POSIX shell):

```bash
INBOX_DB_PATH=data/demo-$(date +%s).db npm run demo
```

## Walk through the workflow

1. **Import requests.** In **Agregar solicitudes**, choose **Importar CSV** and upload [`examples/requests.csv`](../examples/requests.csv). This intake section is below the review workspace and can be collapsed. It contains ten fictional Spanish messages, including a quoted comma, escaped quotes and a multiline message. The tickets initially have status `new`. Reimporting the same IDs into the same database rejects duplicates.
2. **Run classification.** Select **Clasificar**. It processes every new ticket in the inbox; **Reintentar fallidas** includes new and failed tickets. Search and category/status filters do not limit these actions. This sends customer text to Groq and consumes provider tokens; it is not an offline demo. The inbox exposes the resulting suggestions or failures. The server workflow does not use the evaluation runner's token pacing, so provider rate limits are possible.
3. **Review and continue deliberately.** After saving, the decision and ticket ID remain confirmed while you choose whether to open **Siguiente por revisar**. This uses the global inbox order, independent of visible filters; no ticket is selected automatically. Cancel a correction to discard its draft and restore the original suggestion.
4. **Accept a sound suggestion.** Open a routine request such as `demo-01`. Compare the original text, summary, category and extracted order number; accept only if they are correct. The ticket becomes `reviewed` with decision `accepted`.
5. **Show missing information.** Open `demo-09`: it requests a return without an order number. Inspect the missing-data list. The domain computes it from the category and extracted fields, not from the model's opinion.
6. **Correct a suggestion.** On an `awaiting_review` ticket, use the correction form to change a category or extracted field and save. Use a deliberately changed field if the model made no natural error, and say this is demonstrating the workflow, not measuring model quality. The decision is `corrected`; missing fields are recomputed.
7. **Inspect the injection case.** `demo-08` asks the model to ignore instructions. Compare the suggestion with the actual shipping complaint. A correct answer on this message does not prove injection resistance: the recorded holdout contains a different injection that planted a false order number.
8. **Show metrics and persistence.** Inspect accepted, corrected and manual counts. Acceptance rate is `accepted / (accepted + corrected)`; manual reviews are excluded. Refresh the page and confirm saved decisions remain.

If a real model call fails, show the `triage_failed` ticket: correct it manually or select **Reintentar fallidas** after the provider recovers. Retrying consumes more tokens. Do not deliberately trigger an outage just to show this path.

## Find requests during daily work

Use **Buscar solicitudes** for text, ID, summary or an extracted order number/return reason. Matching ignores case and accents. Combine **Filtrar por categoría** with the existing status buttons; **Sin clasificar** includes new requests and failed classifications. Reviewed requests use the final corrected category and extracted fields.

Use **Ordenar solicitudes** to show oldest (default) or newest requests first. **Solo con datos faltantes** shows known missing fields from the current triage or final human review; it excludes new/failed requests with no classification. This combines with all other filters. Sorting is only visual: it does not change the global queue used by **Siguiente por revisar**.

**Limpiar filtros** resets search, category, status and the missing-data checkbox, while preserving the selected sort order. The result counter shows visible / total; status counts remain global to the inbox. Filtering is local: it makes no API or model calls. A selected review stays open even if hidden by a filter, so an unsaved correction draft is not discarded. Filters reset on page reload.

## Check suggestion quality

In **Antes de confirmar**, compare the order number with the original message and check who did what, negations, amounts and dates in the summary. A matching number is not a verified order; warnings do not block acceptance or change stored fields. See [quality-review guidance and new calibration cases](quality-review.md). Summary fidelity requires human judgment; the calibration examples are not model outputs or a benchmark.

## Explain the design in an interview

| Point | Evidence |
|---|---|
| Business rules are independent of the provider | Domain validation and missing-field computation; [architecture](architecture.md) |
| Dependencies are replaceable | `Classifier` and `TicketRepository` ports; [ADRs](decisions/README.md) |
| Human control is deliberate | Suggestions cannot send emails or modify orders; review decisions are stored |
| Quality is measured, not assumed | [Recorded holdout](evaluation.md): 9/10 categories, one invalid output, one planted order number |
| Failures are acknowledged | One holdout summary reversed who issued a refund; language scoring is only a heuristic |

Model results can vary between runs. The sample CSV is for demonstrating the product, not a labeled benchmark. Do not rerun the holdout for the demo or tune the prompt against it. Usage is recorded as tokens in evaluation reports, not as a verified monetary cost.

## Limits before public deployment

This is a local MVP. Authentication, authorization, privacy/retention controls, request concurrency and token-budget controls need production design. Extracted order numbers are untrusted: a future order integration must verify both existence and the customer's access to the order before taking action. A syntactically valid model response is not necessarily faithful or safe.
