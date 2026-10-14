import { fail, ok, type Result } from "./result.js";
import type { PolicyPassage } from "./policy.js";

export const MAX_DRAFT_LENGTH = 1500;

// One sentence of the reply and the passages the model says support it.
// An empty sourceIds list means the sentence makes no policy claim (greeting, question) or is unsupported:
// the operator has to check it.
export type DraftSentence = {
  readonly text: string;
  readonly sourceIds: readonly string[];
};

// A suggestion for a person to edit and send; it is never sent by the system.
export type ReplyDraft = {
  readonly sentences: readonly DraftSentence[];
  readonly sources: readonly PolicyPassage[];
};

export type ReplyDraftInput = {
  sentences: ReadonlyArray<{ text: string; sourceIds: readonly string[] }>;
};

export type ReplyDraftError = "empty_draft" | "draft_too_long" | "unknown_source";

// A citation proves which passage the model points to, not that the sentence is correct.
// What can be checked here is that every cited passage really was given to the model.
export function createReplyDraft(input: ReplyDraftInput, passages: readonly PolicyPassage[]): Result<ReplyDraft, ReplyDraftError> {
  const sentences = input.sentences
    .map((sentence) => ({ text: sentence.text.trim(), sourceIds: [...new Set(sentence.sourceIds)] }))
    .filter((sentence) => sentence.text !== "");
  if (sentences.length === 0) return fail("empty_draft");

  const length = sentences.reduce((total, sentence) => total + sentence.text.length + 1, 0);
  if (length > MAX_DRAFT_LENGTH) return fail("draft_too_long");

  const known = new Set(passages.map((passage) => passage.id));
  const cited = new Set(sentences.flatMap((sentence) => sentence.sourceIds));
  if ([...cited].some((id) => !known.has(id))) return fail("unknown_source");

  return ok({ sentences, sources: passages.filter((passage) => cited.has(passage.id)) });
}
