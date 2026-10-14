# 0003. Measure with a labeled dataset and a holdout split

- **Status:** accepted
- **Date:** 2026-10-13

## Context

A demo that works on a few examples says little about how often the model is right. Prompt changes can fix one case and break another, and an LLM gives different answers across runs.

## Decision

- Keep 30 hand-labeled requests in `eval/dataset.json`: 20 `dev` cases to iterate on, 10 `holdout` cases run once at the end.
- Score category, order number extraction (including hallucinations), return reason, summary language, latency and tokens.
- Save every run with its error causes, so failures can be diagnosed instead of guessed.
- Pace the run under the provider's tokens-per-minute limit, so rate limiting is not counted as a quality failure.

## Consequences

- Every prompt change is compared on the same cases. The summary-language decision went from 2/20 to 18/18 Spanish summaries, measured.
- Measuring before optimizing disproved a wrong hypothesis: the long latency tail came from rate-limit retries, not from model reasoning.
- The holdout only stays honest if nobody tunes the prompt on it. Its prompt injection finding was documented, not fixed by editing the prompt.
- 30 cases is a small sample; the numbers are a baseline, not proof.
