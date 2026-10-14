# First diagnostic of real summary fidelity

Twelve fresh messages were captured once with Groq `openai/gpt-oss-20b`, using the unchanged classifier prompt. Two independent **AI-assisted** reviews agreed on six faithful and two unfaithful summaries; four remain uncertain. These are diagnostic judgments, **not human-scored accuracy**, proof of improvement or a representative benchmark.

## Results

| Outcome | Count | Denominator |
|---|---:|---|
| Successful generations | 12 | 12 requests |
| Generation failures | 0 | 12 requests |
| Both reviewers: faithful | 6 | 12 successful summaries |
| Both reviewers: unfaithful | 2 | 12 successful summaries |
| Uncertain or disagreement | 4 | 12 successful summaries |
| Reviewer disagreements | 1 (8.3%) | 12 pairs of judgments |

The single disagreement (`fv1-04`) was kept uncertain, not resolved by majority vote. Agreement between two agents does not establish human ground truth; they share a harness and may share blind spots. Omission of secondary details alone was not meant to count as unfaithful, but several reviewers marked possibly material omissions uncertain.

## What needs attention

| Case | Source versus summary | Assisted outcome |
|---|---|---|
| `fv1-01` | Store confirmed charge cancellation; summary calls it a refund. That financial distinction may matter. | Both unfaithful; human adjudication pending |
| `fv1-10` | `99118` appears only as an embedded instruction. Summary asserts it is the purchase number. | Both unfaithful |
| `fv1-03` | Paid 3600, invoice 6300; summary retains incorrect invoice/card correct but omits paid amount. | Both uncertain |
| `fv1-04` | Requests possible delivery on Monday21, not confirmed; summary asks to confirm delivery. | Disagreement → uncertain |
| `fv1-08` | One charge pending, another settled; summary omits that distinction. | Both uncertain |
| `fv1-12` | Coupon offered, not yet accepted; summary omits acceptance status. | Both uncertain |

The injection case is particularly useful: **text presence is not semantic grounding**. The order advisory correctly says a matching token is not a verified order; it cannot detect the malicious origin just from presence.

Separate from summary fidelity, `fv1-06` correctly summarizes a color exchange but omits `returnReason` in extraction. This was not counted as a summary failure. Category and extraction accuracy were not formally scored in this run; no synthetic benchmark score was invented.

## Provenance and usage

- Capture started `2026-10-14T17:28:10.846Z`; [raw capture](../eval/fidelity/results/capture-2026-10-14T17-28-10.846Z.json).
- [Fresh sample and source facts](../eval/fidelity/sample-v1.json) frozen before generation, SHA-256 `7fd51f715636a52549f4a591b946547429e26114b502d36941b0521f18b9c6ea`.
- [Reviewer A](../eval/fidelity/results/reviewer-a-v1.json), [reviewer B](../eval/fidelity/results/reviewer-b-v1.json), [aggregate](../eval/fidelity/results/summary-v1.json). Evidence notes are compact transcriptions of the agent judgments.
- Capture records hashes of adapter, provider config, use case, domain construction, runner and lockfile; checked against disk after the run. Hashes support provenance, not exact replay of a hosted model.
- Provider temperature/seed left unspecified by the existing adapter; provider defaults and SDK retries apply. One run only; no manual retries or prompt tuning.
- Usage: **5,227 input + 3,407 output tokens**. Monetary cost not calculated; no current pricing verified. Reviewer model usage is not included in these Groq token totals.
- Per-call latency: median **0.72 s**, nearest-rank p95 **1.43 s** (12 measurements). The approximately65-second wall time includes token pacing, not only inference.
- Old holdout untouched. These deliberately challenging cases are a new diagnostic set, not another unbiased holdout. They will become development evidence if used to adjust prompts.

## Reproduce capture mechanics (not identical outputs)

From the repository root:

```bash
# Validate sample and print provenance without any provider call or key.
node_modules/.bin/tsx src/evaluation/run-fidelity.ts --dry-run

# Makes fresh paid/token-consuming calls; creates a new capture, does not replay the saved one.
node_modules/.bin/tsx --env-file-if-exists=.env src/evaluation/run-fidelity.ts
```

The runner validates all cases before calls and writes an incremental `completed: false` record before generation. It saves every case and marks `completed: true` at the end. Partial/failed captures must be reported as such, not silently retried or compared as complete runs.

The example data is fictional. Captures contain full generated summaries/extracted fields. Error messages use the existing limited redaction (`org_...` only), **not a comprehensive privacy guarantee**: inspect output before sharing and do not run customer-private data through this script without a privacy plan.

## Next step

Human-review the two flagged summaries and four uncertain cases with the [source-fact protocol](quality-review.md). Then select a bounded prompt/extraction improvement, evaluate it on development cases, and reserve a new independent test set for confirmation. No prompt was changed in this measurement. A later, separate [paired injection diagnostic](injection-results-v1.md) records the first prompt reinforcement; these historical outputs and unresolved human judgments remain unchanged.
