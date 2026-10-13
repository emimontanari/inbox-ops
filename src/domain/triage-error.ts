import type { SupportRequestError } from "./support-request.js";
import type { TriageSuggestionError } from "./triage-suggestion.js";

// Every way triaging a request can fail, as seen by the business.
export type TriageError =
  | SupportRequestError
  | "classifier_unavailable"
  | "classifier_invalid_output"
  | TriageSuggestionError;
