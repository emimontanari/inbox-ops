import { fail, type Result } from "../domain/result.js";
import { createSupportRequest, type SupportRequest } from "../domain/support-request.js";
import type { TriageError } from "../domain/triage-error.js";
import { createTriageSuggestion, type TriageSuggestion } from "../domain/triage-suggestion.js";
import type { Classifier, ClassifierResult } from "./classifier.js";

export type { TriageError };

export type TriageRequest = (input: {
  id: string;
  body: string;
}) => Promise<Result<TriageSuggestion, TriageError>>;

export function createTriageRequest(deps: { classifier: Classifier }): TriageRequest {
  return async (input) => {
    const request = createSupportRequest(input);
    // Validate before calling the model: an invalid request must not cost a model call.
    if (!request.ok) return request;

    const classified = await classifySafely(deps.classifier, request.value);
    if (!classified.ok) {
      return fail(classified.error === "unavailable" ? "classifier_unavailable" : "classifier_invalid_output");
    }

    const { category, summary, extracted } = classified.value;
    return createTriageSuggestion({ requestId: request.value.id, category, summary, extracted });
  };
}

// Adapters talk to networks and parse untrusted output; a bug or outage there
// must become an expected error, not crash the inbox.
async function classifySafely(
  classifier: Classifier,
  request: SupportRequest,
): Promise<ClassifierResult> {
  try {
    return await classifier.classify(request);
  } catch {
    return fail("unavailable");
  }
}
