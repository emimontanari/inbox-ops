import { createHash } from "node:crypto";
import { z } from "zod";
import { bundleSchema, replayDrafts } from "./draft-replay.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const hash = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const sentencesSchema = z.object({ sentences: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()) })) });

export const rubricVersionSchema = z.enum(["draft-semantic-v1", "draft-semantic-v2"]);
export type RubricVersion = z.infer<typeof rubricVersionSchema>;

export function buildSemanticPacket(input: unknown, version: RubricVersion = "draft-semantic-v1") {
  const rubricVersion = rubricVersionSchema.parse(version);
  const bundle = bundleSchema.parse(input);
  if (bundle.capture && (!bundle.capture.complete || bundle.capture.inFlightCaseId !== undefined)) throw new Error("Incomplete capture");
  if (bundle.capture && (bundle.capture.plannedCaseIds.length !== bundle.cases.length || bundle.cases.some((item, i) => item.id !== bundle.capture!.plannedCaseIds[i]))) throw new Error("Incomplete case coverage");
  const replay = replayDrafts(bundle);
  const responses: Array<{ responseId: string; context: typeof bundle.cases[number]["context"]; sentences: Array<{ text: string; sourceIds: string[] }> }> = [];
  const excluded: Array<{ responseId: string; outcome: string }> = [];
  for (const [caseIndex, item] of bundle.cases.entries()) {
    for (const [attemptIndex, attempt] of item.attempts.entries()) {
      const responseId = `response-${caseIndex + 1}-${attemptIndex + 1}`;
      const outcome = replay.cases[caseIndex]!.attempts[attemptIndex]!.outcome;
      if (outcome !== "valid" || attempt.status !== "returned") { excluded.push({ responseId, outcome }); continue; }
      responses.push({ responseId, context: item.context, sentences: sentencesSchema.parse(attempt.output).sentences });
    }
  }
  const core = { version: 1, rubricVersion, captureHash: hash(bundle), responses, excluded };
  return { ...core, packetHash: hash(core) };
}

const reason = z.string().trim().min(1);
export const reviewSchema = z.strictObject({
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  reviewer: z.strictObject({ id: reason, kind: z.enum(["human", "ai"]), exposure: z.enum(["blind", "unblinded"]) }),
  responses: z.array(z.strictObject({
    responseId: reason,
    abstention: z.strictObject({ label: z.enum(["appropriate", "inappropriate", "not_needed", "uncertain"]), rationale: reason }),
    sentences: z.array(z.strictObject({
      index: z.number().int().nonnegative(), support: z.enum(["supported", "unsupported", "not_applicable", "uncertain"]),
      citations: z.enum(["applicable", "misapplied", "none", "uncertain"]), rationale: reason, evidenceIds: z.array(reason),
    })),
  })),
});

export function summarizeSemanticReviews(input: unknown, rawReviews: unknown[], version: RubricVersion = "draft-semantic-v1") {
  const packet = buildSemanticPacket(input, version);
  if (packet.responses.length === 0) throw new Error("No structurally valid responses to review");
  const reviews = z.array(reviewSchema).length(2).parse(rawReviews);
  if (reviews[0]!.reviewer.id === reviews[1]!.reviewer.id) throw new Error("Distinct declared reviewer IDs required");
  for (const review of reviews) {
    if (review.packetHash !== packet.packetHash) throw new Error("Review belongs to a different packet");
    if (review.responses.length !== packet.responses.length || new Set(review.responses.map(item => item.responseId)).size !== packet.responses.length) throw new Error("Missing or duplicated responses");
    for (const response of packet.responses) {
      const assessed = review.responses.find(item => item.responseId === response.responseId);
      if (!assessed || assessed.sentences.length !== response.sentences.length || new Set(assessed.sentences.map(item => item.index)).size !== response.sentences.length) throw new Error("Missing or duplicated sentences");
      for (const [index, sentence] of response.sentences.entries()) {
        const judgment = assessed.sentences.find(item => item.index === index);
        if (!judgment) throw new Error("Incorrect sentence index");
        if ((judgment.citations === "none") !== (sentence.sourceIds.length === 0)) throw new Error("Citation-presence mismatch");
        if (judgment.evidenceIds.some(id => !response.context.passages.some(passage => passage.id === id))) throw new Error("Unknown evidence passage");
      }
    }
  }
  let disagreements = 0;
  function agreement<T extends string>(a: T, b: T): T | "uncertain" {
    if (a !== b) { disagreements++; return "uncertain"; }
    return a;
  }
  const responses = packet.responses.map(response => {
    const a = reviews[0]!.responses.find(item => item.responseId === response.responseId)!;
    const b = reviews[1]!.responses.find(item => item.responseId === response.responseId)!;
    return {
      responseId: response.responseId, abstention: agreement(a.abstention.label, b.abstention.label),
      sentences: response.sentences.map((_, index) => {
        const left = a.sentences.find(item => item.index === index)!; const right = b.sentences.find(item => item.index === index)!;
        return { index, support: agreement(left.support, right.support), citations: agreement(left.citations, right.citations) };
      }),
    };
  });
  return { version: 1, rubricVersion: packet.rubricVersion, status: "reviewer_agreement_not_ground_truth", packetHash: packet.packetHash, captureHash: packet.captureHash, reviews, responses, excluded: packet.excluded, disagreements };
}
