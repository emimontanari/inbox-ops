import { createHash } from "node:crypto";
import { z } from "zod";
import { CATEGORIES } from "../domain/category.js";
import { createReplyDraft } from "../domain/reply-draft.js";

const passage = z.strictObject({
  id: z.string().min(1), title: z.string().min(1), topics: z.array(z.enum(CATEGORIES)).min(1), text: z.string().min(1),
});
const context = z.strictObject({
  customerMessage: z.string().min(1), category: z.enum(CATEGORIES), summary: z.string().optional(),
  extracted: z.strictObject({ orderNumber: z.string().optional(), returnReason: z.string().optional() }),
  missingFields: z.array(z.enum(["order_number", "return_reason"])),
  passages: z.array(passage).refine(items => new Set(items.map(item => item.id)).size === items.length, "Duplicate source IDs"),
});
const evidence = z.strictObject({
  prompt: z.string(), startedAt: z.iso.datetime(), finishedAt: z.iso.datetime(), latencyMs: z.number().nonnegative(),
  rawText: z.string().optional(), statusCode: z.number().int().optional(),
});
export const captureMetadataSchema = z.strictObject({
  provider: z.literal("groq"), modelId: z.string().min(1), instructions: z.string().min(1), outputSchema: z.unknown(),
  maxRetries: z.literal(0), timeoutMs: z.literal(30000), maxOutputTokens: z.literal(4096).default(4096),
});
const captureMetadata = captureMetadataSchema.extend({
  startedAt: z.iso.datetime(), finishedAt: z.iso.datetime().optional(), complete: z.boolean(),
  caseOrigin: z.enum(["synthetic", "provider_capture"]), plannedCaseIds: z.array(z.string()).min(1).max(2), inFlightCaseId: z.string().optional(), inFlightContext: context.optional(), inFlightPrompt: z.string().optional(),
});
const attempt = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("returned"), output: z.unknown(), evidence: evidence.optional() }),
  z.strictObject({ status: z.literal("error"), error: z.string().min(1), evidence: evidence.optional() }),
]);
export const bundleSchema = z.strictObject({
  version: z.literal(1), provenance: z.enum(["synthetic", "provider_capture"]), capture: captureMetadata.optional(),
  cases: z.array(z.strictObject({ id: z.string().min(1), context, attempts: z.array(attempt).min(1) })).min(1)
    .refine(items => new Set(items.map(item => item.id)).size === items.length, "Duplicate case IDs"),
});
const usageSchema = z.strictObject({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() });
const outputSchema = z.strictObject({
  sentences: z.array(z.strictObject({ text: z.string(), sourceIds: z.array(z.string()) })),
  usage: usageSchema.optional(),
});

// Canonical keys, ordered arrays: passage order is part of the exact context.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function replayDrafts(input: unknown) {
  const bundle = bundleSchema.parse(input);
  const counts = { attempts: 0, valid: 0, invalid: 0, errors: 0, usageMissing: 0 };
  const cases = bundle.cases.map(item => ({
    id: item.id, context: item.context,
    contextHash: createHash("sha256").update(canonical(item.context)).digest("hex"),
    attempts: item.attempts.map((raw, index) => {
      counts.attempts++;
      const parsed = raw.status === "returned" ? outputSchema.safeParse(raw.output) : null;
      const validated = parsed?.success ? createReplyDraft(parsed.data, item.context.passages) : null;
      const outcome = raw.status === "error" ? "error" : !parsed?.success ? "invalid_format" : validated?.ok ? "valid" : validated?.error ?? "invalid_format";
      if (outcome === "error") counts.errors++;
      else if (outcome === "valid") counts.valid++;
      else counts.invalid++;
      // Unknown usage is never converted to zero, including adapter/error records without usage.
      const usage = parsed?.success ? parsed.data.usage ?? null : null;
      if (usage === null) counts.usageMissing++;
      return {
        attempt: index + 1, raw, outcome, usage,
        uncitedSentences: parsed?.success ? parsed.data.sentences.filter(sentence => sentence.text.trim() !== "" && sentence.sourceIds.length === 0).length : null,
        semanticSupport: "not_assessed" as const, abstention: "not_assessed" as const,
      };
    }),
  }));
  return { version: 1, mode: "offline_replay", provenance: bundle.provenance, ...(bundle.capture ? { capture: bundle.capture } : {}), counts, cases };
}
