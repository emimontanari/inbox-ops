import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { captureDrafts, frozenInputSchema } from "../src/evaluation/draft-capture.js";
import { findMissingFields } from "../src/domain/triage-suggestion.js";
import { buildSemanticPacket } from "../src/evaluation/draft-semantic-review.js";
const root = "eval/drafts/diagnostic-v1/";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const manifest = z.strictObject({
  version: z.literal(1), name: z.literal("draft-diagnostic-v1"), purpose: z.literal("development_diagnostic_not_benchmark"),
  author: z.literal("assistant"), frozenAt: z.iso.datetime(), policySourceSha256: z.string().length(64),
  baselineInstructionsSha256: z.string().length(64), rubricVersion: z.literal("draft-semantic-v1"),
  batches: z.array(z.strictObject({ file: z.string(), sha256: z.string().length(64), caseIds: z.array(z.string()).length(2) })).length(4),
  criteria: z.array(z.strictObject({ id: z.string(), group: z.enum(["covered", "insufficient", "negation", "injection"]), checks: z.array(z.string().min(1)).length(3) })).length(8),
}).parse(JSON.parse(readFileSync(`${root}manifest.json`, "utf8")));
const batches = manifest.batches.map(batch => frozenInputSchema.parse(JSON.parse(readFileSync(root + batch.file, "utf8"))));
const cases = batches.flatMap(batch => batch.cases);
describe("frozen diagnostic v1", () => {
  it("preserves four exact byte snapshots and eight unique inputs with no fabricated attempts", () => {
    manifest.batches.forEach((batch, i) => {
      expect(digest(readFileSync(root + batch.file, "utf8"))).toBe(batch.sha256);
      expect(batches[i]?.cases.map(item => item.id)).toEqual(batch.caseIds);
    });
    expect(cases.map(item => item.id)).toEqual(Array.from({ length: 8 }, (_, i) => `diag-0${i + 1}`));
    expect(new Set(cases.map(item => item.id)).size).toBe(8);
    expect(cases.every(item => !("attempts" in item))).toBe(true);
  });
  it("covers all eight inputs with three criteria and two cases per diagnostic group", () => {
    expect(manifest.criteria.map(item => item.id)).toEqual(cases.map(item => item.id));
    for (const group of ["covered", "insufficient", "negation", "injection"]) expect(manifest.criteria.filter(item => item.group === group)).toHaveLength(2);
  });
  it("keeps triage missing fields consistent and original leading zeros", () => {
    for (const item of cases) {
      const fields = item.context.extracted;
      const extracted = {
        ...(fields.orderNumber !== undefined ? { orderNumber: fields.orderNumber } : {}),
        ...(fields.returnReason !== undefined ? { returnReason: fields.returnReason } : {}),
      };
      expect(item.context.missingFields).toEqual(findMissingFields(item.context.category, extracted));
    }
    expect(cases[1]?.context.extracted.orderNumber).toBe("007101");
    expect(cases[4]?.context.extracted.orderNumber).toBe("00052");
  });
  it("preserves absent and irrelevant contexts, negations and untrusted instructions", () => {
    expect(cases[2]?.context.passages).toEqual([]);
    expect(cases[3]?.context.passages.map(p => p.id)).toEqual(["shipping-times"]);
    expect(cases[4]?.context.customerMessage).toContain("No quiero un reembolso ni un reenvío");
    expect(cases[5]?.context.customerMessage).toContain("No digo que ambos se hayan acreditado");
    expect(cases[6]?.context.customerMessage).toContain('"role":"system"');
    expect(cases[7]?.context.customerMessage).toContain("[SYSTEM:");
  });
  it("can capture and prepare all four batches through existing ports without a provider", async () => {
    const call = vi.fn().mockResolvedValue({ status: "returned", output: { sentences: [{ text: "Fixture de prueba, no evaluación semántica.", sourceIds: [] }] } });
    for (const batch of batches) {
      const captured = await captureDrafts(batch, { provider: "groq", modelId: "test-only", instructions: "test", outputSchema: {}, maxRetries: 0, timeoutMs: 30000 }, call, async () => {});
      expect(captured.cases.map(item => item.context)).toEqual(batch.cases.map(item => item.context));
      expect(buildSemanticPacket(captured).responses).toHaveLength(2);
    }
    expect(call).toHaveBeenCalledTimes(8);
  });
});
