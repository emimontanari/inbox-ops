import type { Result } from "../domain/result.js";
import type { SupportRequest } from "../domain/support-request.js";
import type { ExtractedData } from "../domain/triage-suggestion.js";

// Raw classifier output. The category is a plain string on purpose:
// the domain validates it, adapters must not be trusted to do so.
export type ClassifierOutput = {
  category: string;
  summary: string;
  extracted: ExtractedData;
  // Operational metadata for measuring cost; not part of the business result.
  usage?: TokenUsage;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ClassifierError = "unavailable" | "invalid_output";

export type ClassifierResult = Result<ClassifierOutput, ClassifierError>;

// Port: what the application needs from a classifier, independent of any AI provider.
export interface Classifier {
  classify(request: SupportRequest): Promise<ClassifierResult>;
}
