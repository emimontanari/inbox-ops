# Reply drafts: JSON repair and v3 retrieval

A third paired diagnostic, on a fresh sample. It covers two changes:

- a repair for answers that Groq rejects for one malformed key;
- v3 retrieval, which searches with the customer message plus the model summary.

It follows the [v2 report](draft-results-v2.md). It is a diagnostic, not a benchmark: eight fictional messages, one run per version, and two blind AI-assisted reviewers.

## Finding 1: two reproduced invalid outputs had one malformed key

On [`sample-v3.json`](../eval/drafts/sample-v3.json) (frozen in `942aaac`), the v2 code produced only 3/8 drafts on the first attempt and 6/8 after one retry. The first attempt had three `502 drafter_invalid_output` and two `503` failures; two retries also returned `502`.

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

## Finding 2: v3 drafts cite relevant policies for paraphrased requests

v3 (`2dd5b75`) searches with the customer message plus the model summary and keeps the threshold of two shared words. Retrieval is the only intended code change versus v2 + repair, but each run generated its triage separately: the recorded triage differs in every case. The capture stores cited sources, not the full retrieved context.

| Case | What it tests | Cited sources, baseline | Cited sources, v3 |
| --- | --- | --- | --- |
| `dv3-01` | Missing charger | missing items | missing items |
| `dv3-02` | "Vino manchada y descosida" | none | damaged products |
| `dv3-03` | Company invoice (uncovered) | none | none |
| `dv3-04` | Warranty (uncovered) | none | none |
| `dv3-05` | Color exchange | exchange | exchange |
| `dv3-06` | "Está parado en el centro de distribución" | none | tracking |
| `dv3-07` | Approved refund not visible | refund visibility, refund timing | same |
| `dv3-08` | Address change, "no quiero cancelarlo" | address change | address change |

v3 cited the relevant policy in both paraphrased cases. Neither version cited a policy for the uncovered questions. An empty citation list does not establish that the model received no passages.

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

**Attribution matters here.** The cited-source lists differed in `dv3-02` and `dv3-06`, and reviewers preferred v3 in both. Identical cited sources in the other cases do not prove identical retrieved context. Separately generated triage, retrieval changes and model variance are confounded; these captures cannot assign the improvements or regressions to one cause.

## Conclusion

- Both runs with the JSON repair produced 8/8 drafts, versus 3/8 on the earlier first attempt. Without a recovered-answer counter or repeated runs, the improvement cannot be attributed entirely to the repair.
- v3 cited relevant policies for two paraphrased requests and did not cite policies for the two uncovered questions. This is promising evidence, not an isolated causal measurement of retrieval.
- One recorded draft invented a company-invoice policy while another for the same customer message did not. Human review stays mandatory.

## Limits

Eight messages, one model, one run per version, two AI-assisted reviewers and no human adjudication. The repaired-answer count is not logged, so the share of recovered drafts is unknown. This sample is now development evidence.

Documentation audit correction: first-attempt status counts and causal claims above were corrected against the archived captures during portfolio preparation. No generations, reviewer verdicts or raw capture files were changed. A future controlled comparison should freeze triage and record every retrieved passage as well as cited sources.
