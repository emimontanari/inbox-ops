import type { DraftContext } from "../application/reply-drafter.js";
import { toPromptData } from "../adapters/ai-sdk-reply-drafter.js";
import { bundleSchema, captureMetadataSchema } from "./draft-replay.js";
import { z } from "zod";

export const frozenInputSchema = z.strictObject({
  version: z.literal(1), provenance: z.literal("synthetic"), kind: z.literal("frozen_inputs"),
  cases: z.array(bundleSchema.shape.cases.element.omit({ attempts: true })).min(1).max(2)
    .refine(items => new Set(items.map(item => item.id)).size === items.length, "Duplicate case IDs"),
});
export const captureInputSchema = z.union([frozenInputSchema, bundleSchema]);

type Attempt = z.infer<typeof bundleSchema>["cases"][number]["attempts"][number];
export type CaptureResponse =
  | { status: "returned"; output: unknown; evidence?: { rawText?: string; statusCode?: number } }
  | { status: "error"; error: string; evidence?: { rawText?: string; statusCode?: number } };
export type CaptureBundle = {
  version: 1; provenance: "provider_capture";
  capture: z.infer<typeof captureMetadataSchema> & { startedAt: string; finishedAt?: string; complete: boolean; caseOrigin: "synthetic" | "provider_capture"; plannedCaseIds: string[]; inFlightCaseId?: string; inFlightContext?: DraftContext; inFlightPrompt?: string };
  cases: Array<{ id: string; context: DraftContext; attempts: Attempt[] }>;
};

export async function captureDrafts(
  input: unknown, metadata: unknown,
  call: (context: DraftContext) => Promise<CaptureResponse>,
  checkpoint: (bundle: CaptureBundle) => Promise<void>,
): Promise<CaptureBundle> {
  const seed = captureInputSchema.parse(input);
  const config = captureMetadataSchema.parse(metadata);
  if (seed.cases.length > 2) throw new Error("La captura admite como máximo dos casos por corrida.");
  const result: CaptureBundle = {
    version: 1, provenance: "provider_capture",
    capture: { ...config, startedAt: new Date().toISOString(), complete: false, caseOrigin: seed.provenance, plannedCaseIds: seed.cases.map(item => item.id) }, cases: [],
  };
  // Reserve/check the output before spending; persist each attempt before making another call.
  await checkpoint(result);
  for (const item of seed.cases) {
    // Zod optional properties permit undefined; JSON inputs do not. Rebuild the typed port value explicitly.
    const context: DraftContext = {
      customerMessage: item.context.customerMessage, category: item.context.category,
      ...(item.context.summary !== undefined ? { summary: item.context.summary } : {}),
      extracted: {
        ...(item.context.extracted.orderNumber !== undefined ? { orderNumber: item.context.extracted.orderNumber } : {}),
        ...(item.context.extracted.returnReason !== undefined ? { returnReason: item.context.extracted.returnReason } : {}),
      }, missingFields: item.context.missingFields, passages: item.context.passages,
    };
    const prompt = JSON.stringify(toPromptData(context));
    result.capture.inFlightCaseId = item.id;
    result.capture.inFlightContext = context;
    result.capture.inFlightPrompt = prompt;
    await checkpoint(result);
    const startedAt = new Date().toISOString(); const start = performance.now();
    let response: CaptureResponse;
    try { response = await call(structuredClone(context)); }
    catch { response = { status: "error", error: "unexpected_transport_error" }; }
    const { evidence, ...raw } = response;
    result.cases.push({ id: item.id, context, attempts: [{ ...raw, evidence: { ...evidence, prompt, startedAt, finishedAt: new Date().toISOString(), latencyMs: performance.now() - start } }] });
    delete result.capture.inFlightCaseId;
    delete result.capture.inFlightContext;
    delete result.capture.inFlightPrompt;
    const final = result.cases.length === seed.cases.length;
    result.capture.complete = final;
    if (final) result.capture.finishedAt = new Date().toISOString();
    await checkpoint(result);
  }
  return result;
}
