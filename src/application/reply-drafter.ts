import type { Category } from "../domain/category.js";
import type { PolicyPassage } from "../domain/policy.js";
import type { Result } from "../domain/result.js";
import type { ExtractedData, MissingField } from "../domain/triage-suggestion.js";
import type { ClassifierError, TokenUsage } from "./classifier.js";

// Everything the drafter may rely on: the original message, the current triage and the retrieved passages.
export type DraftContext = {
  customerMessage: string;
  category: Category;
  summary?: string;
  extracted: ExtractedData;
  missingFields: readonly MissingField[];
  passages: readonly PolicyPassage[];
};

// Raw drafter output. Citations are plain strings: the domain checks them against the passages.
export type DrafterOutput = {
  sentences: Array<{ text: string; sourceIds: string[] }>;
  usage?: TokenUsage;
};

export type DrafterError = ClassifierError;

export type DrafterResult = Result<DrafterOutput, DrafterError>;

// Port: what the application needs to draft a reply, independent of any AI provider.
export interface ReplyDrafter {
  draft(context: DraftContext): Promise<DrafterResult>;
}
