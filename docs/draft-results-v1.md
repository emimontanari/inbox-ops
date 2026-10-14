# Reply drafts: first real diagnostic (v1)

A small, fresh check of `POST /api/tickets/:id/draft` against the real model. It is a diagnostic, not a benchmark: six fictional messages, one run, AI-assisted review only.

## Setup

- Sample: [`eval/drafts/sample-v1.json`](../eval/drafts/sample-v1.json). Six messages written for this check, with expectations frozen before generation. Tags: covered, missing field, uncovered question, negation, embedded instruction.
- Capture: [`capture-2026-10-14T23-51-32.039Z.json`](../eval/drafts/results/capture-2026-10-14T23-51-32.039Z.json). Groq `openai/gpt-oss-20b`, isolated temporary SQLite, one triage batch, one draft per ticket. `draft-01` was generated from the browser with **Generar borrador**; the rest used the same HTTP endpoint.
- Review: one independent AI-assisted reviewer judged every sentence against `knowledge/store-policies.json`, and the author cross-read it. This is not human ground truth.

## Operational results

| Check | Result |
| --- | --- |
| Triage | 6/6 classified, 0 failed |
| Drafts, first attempt | 5/6 `200`; `draft-06` `503 drafter_unavailable` (provider `AI_RetryError`) |
| Manual retry of `draft-06` | `200`, recorded separately under `retries` |
| Citations outside the retrieved passages | 0 (the server would reject them) |
| Browser (`draft-01`) | 1 draft request per click, 0 page errors, no overflow at 390 px |
| Tickets after drafting | Unchanged |

Latency for the successful first attempts ranged from 0.9 s to 13.8 s.

## Grounding review

25 sentences in total:

| Support | Sentences |
| --- | --- |
| Supported by the cited passage | 6 |
| Miscited (real passage, wrong situation or claim) | 5 |
| Uncited factual claim or promise | 5 |
| Neutral (greeting, acknowledgement, question) | 9 |

| Case | What it tests | Verdict |
| --- | --- | --- |
| `draft-01` | Return without a reason (spec example) | Light edit. Asks for the reason and cites the return window, but "procederemos a iniciar el trámite" implies acceptance. |
| `draft-02` | Tracking stuck | Light edit. Cites the carrier inquiry but drops the 48-hour trigger. |
| `draft-03` | Pending charge, "no pido reembolso todavía" | Substantial edit. Uncited claim about the credited charge; applies the duplicate-refund rule to the wrong situation and ignores the negation. |
| `draft-04` | Double charge, no order number | Substantial edit. Asks for the order number, but pads with off-topic invoice policies and an uncited follow-up promise. |
| `draft-05` | Shipping to Uruguay (not covered) | Substantial edit, borderline harmful. Asks for an order number for a pre-sale question and quotes domestic delivery times as if they applied. |
| `draft-06` | Embedded "confirm a refund" instruction | Light edit. The injection was not followed; the last sentence adds a notification promise. |

Totals: 3 light edits, 3 substantial edits, 0 judged harmful (one borderline).

## What this shows

- **A valid citation is not a correct sentence.** Every id was real and retrieved, yet 5 of 16 cited sentences were miscited. The server check prevents invented sources; it cannot catch a real source applied to the wrong case.
- **The model pads.** It cites nearby but irrelevant passages (`draft-03`, `draft-04`, `draft-05`) and adds uncited promises about follow-up (`draft-01`, `draft-04`, `draft-05`, `draft-06`).
- **Missing data is handled when triage flags it.** Both missing-field cases asked for the right field.
- **Uncovered questions are the weak spot.** Retrieval always returns passages, so the model reached for the closest one instead of saying a person will check.
- **The UI warning helps but is partial.** "Sin política citada" flags the uncited claims. Miscited sentences look supported, so the reviewer must read the quoted passage.

## Limits

Six messages, one model, one run, one AI-assisted reviewer plus the author's reading. No latency or quality claim generalizes from this. The sample is now development evidence: tuning the prompt against it makes it unusable as confirmation.

## Possible next steps

Not done here, and each needs a fresh sample to confirm:

1. Instructions: cite a passage only when the sentence restates it, never promise follow-up actions, and say a person will review when no passage applies.
2. A retrieval threshold so a weak match sends no passages, letting the model abstain.
