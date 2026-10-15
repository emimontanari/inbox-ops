# Reply drafts: JSON repair and v3 retrieval

A third paired diagnostic, on a fresh sample. It covers two changes:

- a repair for answers that Groq rejects for one malformed key;
- v3 retrieval, which searches with the customer message plus the model summary.

It follows the [v2 report](draft-results-v2.md). It is a diagnostic, not a benchmark: eight fictional messages, one run per version, and two blind AI-assisted reviewers.

## Finding 1: most invalid outputs were one malformed key

On [`sample-v3.json`](../eval/drafts/sample-v3.json) (frozen in `942aaac`), the v2 code produced only 3/8 drafts on the first attempt and 6/8 after one retry. Five first-attempt failures were `502 drafter_invalid_output`.

Two failing cases were reproduced directly against the provider. In both, `openai/gpt-oss-20b` wrote the key of the last sentence as `"sourceIds:"`, with the colon inside the key. Groq validates the schema server-side and rejected the whole answer with `json_validate_failed`.

The fix (`b709244`) recovers only that defect:

1. It reads the rejected text (`failed_generation`) from Groq's error.
2. It trims trailing colons or spaces from keys.
3. It accepts the answer only if the result passes the exact strict schema.

A missing field, an unknown key or broken JSON still fails as invalid output. Token usage is unknown for a recovered call and is reported as 0.

| Run on the same sample | First attempt | After one retry |
| --- | --- | --- |
| v2 code (`30b22f5`) | 3/8 | 6/8 |
| v2 code + repair (`c726eee`) | 8/8 | — |
| v3 retrieval + repair (`0cad519`) | 8/8 | — |

Both runs with the repair were paced 6 s between drafts, like the v2 baseline. One run per version cannot give a failure rate, but no answer was rejected after the repair. The same defect probably explains part of the `502`s in the [v1](draft-results-v1.md) and v2 reports. Those runs did not keep the rejected text, so this is not confirmed.

## Finding 2: v3 retrieval reaches paraphrased requests

v3 (`2dd5b75`) searches with the customer message plus the model summary and keeps the threshold of two shared words. The baseline is v2 + repair, so the only difference between the runs is retrieval.

| Case | What it tests | Passages, baseline | Passages, v3 |
| --- | --- | --- | --- |
| `dv3-01` | Missing charger | missing items | missing items |
| `dv3-02` | "Vino manchada y descosida" | none | damaged products |
| `dv3-03` | Company invoice (uncovered) | none | none |
| `dv3-04` | Warranty (uncovered) | none | none |
| `dv3-05` | Color exchange | exchange | exchange |
| `dv3-06` | "Está parado en el centro de distribución" | none | tracking |
| `dv3-07` | Approved refund not visible | refund visibility, refund timing | same |
| `dv3-08` | Address change, "no quiero cancelarlo" | address change | address change |

v3 found the right policy in both paraphrased cases. It sent nothing for either uncovered question.

## Quality (blind consensus)

Each case's two drafts were shuffled into A/B with a fixed hash, in [`blind-v3.json`](../eval/drafts/blind/blind-v3.json). Two independent reviewers judged them; the [key](../eval/drafts/blind/key-v3.json) was applied afterwards. A case counts for one side only when both reviewers agree.

| Case | Consensus | Why |
| --- | --- | --- |
| `dv3-02` | **v3 better** | v3 cites the 7-day photo rule; the baseline cites nothing and promises instructions within 24 hours. |
| `dv3-06` | **v3 better** | v3 applies the carrier-inquiry policy; the baseline is generic. |
| `dv3-03` | **v3 better** | The baseline invented and confirmed a company-invoice policy (both reviewers: harmful if sent); v3 handed off to a person. |
| `dv3-01` | Baseline better | v3 turned "7 days from delivery" into "the next 7 days". |
| `dv3-07` | Baseline better (slim) | v3 added an uncited "contact us after 10 business days". |
| `dv3-04`, `dv3-05` | Tie | Both safe. |
| `dv3-08` | Uncertain | One reviewer tie, one uncertain. |

Totals: v3 better 3, baseline better 2, tie 2, uncertain 1. Harmful if sent: baseline 1, v3 0.

**Attribution matters here.** Retrieval differed only in `dv3-02` and `dv3-06`, and v3 won both. The other six cases sent identical passages in both runs. Their differences, including the harmful baseline answer in `dv3-03` and both baseline wins, come from run-to-run model variance, not from the code. A single run per version does not separate the two any further.

## Conclusion

- The JSON repair removes the main source of failed drafts seen on this sample.
- Searching with the summary fixes the two v2 regressions in kind: paraphrased requests reach their policy again. The threshold still kept both uncovered questions without passages.
- Model variance is as large as the retrieval effect on the other cases. One draft can invent a policy that the next draft on the same input does not. Human review stays mandatory.

## Limits

Eight messages, one model, one run per version, two AI-assisted reviewers and no human adjudication. The repaired-answer count is not logged, so the share of recovered drafts is unknown. This sample is now development evidence.
