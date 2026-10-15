# Reply drafts: paired v1 vs v2 diagnostic

A paired check of the v2 changes on a fresh sample. It is a diagnostic, not a benchmark: eight fictional messages, one run per version, and two blind AI-assisted reviewers. The [v1 report](draft-results-v1.md) motivated the changes.

## What changed in v2

- **Retrieval threshold** (`86623a2`): a passage needs at least two words in common with the message; the ticket category only ranks passages that already qualify. Retrieval uses only the customer message, no longer the model summary.
- **Instructions** (`9876ac6`): cite a passage only in a sentence that restates it, ignore passages that do not apply, ask for missing fields only for an existing order, keep what the customer says they do not want, promise no follow-up, and say a person will review when no passage applies.

## Method

1. Froze [`sample-v2.json`](../eval/drafts/sample-v2.json) in `2c4069c`, before any v2 change.
2. Captured the v1 baseline at that commit, then the v2 candidate at `9876ac6`. Each run used an isolated temporary SQLite, Groq `openai/gpt-oss-20b`, one triage batch and one draft per ticket. The same retry rule applied to both runs: one retry about 20 s after a failed first attempt, recorded separately.
3. Shuffled each case's two final drafts into A/B with a fixed hash, in [`blind-v2.json`](../eval/drafts/blind/blind-v2.json). Two independent AI-assisted reviewers judged them from that file and the policies only. The [key](../eval/drafts/blind/key.json) was applied afterwards.
4. Consensus is conservative: a case counts for one side only when both reviewers agree; any disagreement is uncertain.

## Availability

| | v1 baseline | v2 candidate |
| --- | --- | --- |
| Drafts on the first attempt | 5/8 | 4/8 |
| Drafts after one retry | 7/8 | 7/8 |
| First-attempt failures | 2× `502` invalid output, 1× `503` | 1× `502`, 3× `503` (provider retries exhausted) |

`dv2-02`, an installments question no policy covers, failed in both versions even after the retry: the provider rejected the structured output. Most `503`s came from provider retry exhaustion during back-to-back calls. With eight cases and this noise, the runs do not show either version as more available.

## Quality (blind consensus)

| Case | What it tests | Consensus | Why |
| --- | --- | --- | --- |
| `dv2-01` | Pickup store (uncovered) | **v2 better** | v1 stated, with no source, that there is no store in Córdoba and asked for an order number (both reviewers: harmful if sent). v2 handed off to a person. |
| `dv2-02` | Installments (uncovered) | Tie | Both failed. |
| `dv2-03` | Size exchange | **v2 better** | v1 added an unsupported "request registered" claim and an off-topic privacy passage. |
| `dv2-04` | Missing item | **v1 better** | v2 never asked for the photo and asked for a return reason instead. |
| `dv2-05` | Where to download an invoice | Tie | Both answered correctly; both asked for an unnecessary order number. |
| `dv2-06` | Address change, "no quiero cancelar" | Uncertain | One reviewer slightly preferred v2, the other called it a tie. |
| `dv2-07` | Damaged item | **v1 better** | v2 gave a generic hand-off with no photo request; v1 cited the damaged-products policy (and also a misapplied return window). |
| `dv2-08` | Embedded "refund already credited" | Tie | Both gave the 10 business days and ignored the injection. |

Totals: v2 better 2, v1 better 2, tie 3, uncertain 1. Cases judged harmful if sent: v1 1, v2 0. Cited sentences: v1 11 of 23, v2 7 of 24.

## Why the two regressions happened

Both v2 losses come from retrieval, not from the instructions:

- `dv2-04` ("vino una sola taza") shares only "pedido" with the missing-items policy ("si falta un producto"), but shares "pedido" and "compra" with the privacy policy. The threshold kept the wrong passage and dropped the right one.
- `dv2-07` ("llegó con la lámpara rota") shares no word with "si un producto llega dañado". With no passage, the model correctly handed off, but the customer gets no useful answer.

The v1 search also used the model summary, which tends to paraphrase into the policies' vocabulary ("producto faltante", "dañado"). Removing it reduced noise on the v1 sample, but on this sample it removed the words that made the right passage reachable. Word overlap cannot tell "rota" from "dañado", or a store question from a domestic shipping question.

## Conclusion

v2 is **not** a clear improvement. It fixed what it targeted: abstention on an uncovered question, padding with off-topic citations, and the harmful case. Its stricter retrieval lost two cases where a policy did apply. The instructions look helpful; the retrieval change is a trade-off between precision and recall that eight cases cannot settle.

## Limits

Eight messages, one model, one run per version, two AI-assisted reviewers and no human adjudication. Provider rate limits added failures unrelated to the code. This sample is now development evidence; confirming any further change needs a new frozen sample.
