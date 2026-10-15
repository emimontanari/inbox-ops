import { describe, expect, it } from "vitest";
import { replayDrafts } from "../src/evaluation/draft-replay.js";
const context = { customerMessage: "¿Dónde está el pedido 0042?", category: "shipping", summary: "Consulta por envío", extracted: { orderNumber: "0042" }, missingFields: [], passages: [
  { id: "a", title: "Envíos", topics: ["shipping"], text: "Consulta el seguimiento." },
  { id: "b", title: "Demoras", topics: ["shipping"], text: "Comunica la demora a soporte." },
] };
const bundle = (outputs: unknown[]) => ({ version: 1, provenance: "synthetic", cases: [{ id: "one", context, attempts: outputs.map(output => ({ status: "returned", output })) }] });
const good = { sentences: [{ text: "Consulta el seguimiento.", sourceIds: ["a"] }] };
describe("offline draft replay", () => {
  it("preserves complete ordered context, uncited passages and raw output deterministically", () => {
    const input = bundle([good]); const before = structuredClone(input);
    const report = replayDrafts(input);
    expect(report).toEqual(replayDrafts(input));
    expect(report.cases[0]?.context).toEqual(context);
    expect(report.cases[0]?.attempts[0]?.raw).toEqual({ status: "returned", output: good });
    expect(report.cases[0]?.attempts[0]?.outcome).toBe("valid");
    expect(report.cases[0]?.attempts[0]?.semanticSupport).toBe("not_assessed");
    expect(input).toEqual(before);
  });
  it("records every failure and retry rather than only the final success", () => {
    const input = bundle([good]);
    const mixed = { ...input, cases: [{ ...input.cases[0], attempts: [{ status: "error", error: "unavailable" }, { status: "returned", output: good }] }] };
    const report = replayDrafts(mixed);
    expect(report.counts).toEqual({ attempts: 2, valid: 1, invalid: 0, errors: 1, usageMissing: 2 });
    expect(report.cases[0]?.attempts.map(a => a.outcome)).toEqual(["error", "valid"]);
  });
  it.each([
    [{ sentences: [{ text: "Promesa", sourceIds: ["unknown"] }] }, "unknown_source"],
    [{ sentences: [] }, "empty_draft"],
    [{ sentences: [{ text: "x".repeat(1501), sourceIds: [] }] }, "draft_too_long"],
    [{ "sentences:": [] }, "invalid_format"],
    [{ sentences: [{ text: "Texto", sourceIds: "a" }] }, "invalid_format"],
  ])("reports invalid outputs without silently repairing them", (output, outcome) => {
    expect(replayDrafts(bundle([output])).cases[0]?.attempts[0]?.outcome).toBe(outcome);
  });
  it("does not equate uncited text or an empty draft with unsupported claims or abstention", () => {
    const report = replayDrafts(bundle([{ sentences: [{ text: "Hola", sourceIds: [] }] }, { sentences: [] }]));
    expect(report.cases[0]?.attempts[0]?.uncitedSentences).toBe(1);
    expect(report.cases[0]?.attempts.every(a => a.abstention === "not_assessed")).toBe(true);
  });
  it("preserves known token usage and distinguishes unknown usage from zero", () => {
    const report = replayDrafts(bundle([{ ...good, usage: { inputTokens: 0, outputTokens: 5 } }, good]));
    expect(report.cases[0]?.attempts[0]?.usage).toEqual({ inputTokens: 0, outputTokens: 5 });
    expect(report.cases[0]?.attempts[1]?.usage).toBeNull();
    expect(report.counts.usageMissing).toBe(1);
  });
  it("fingerprints all context, including uncited passages, independent of object-key order", () => {
    const initial = replayDrafts(bundle([good])).cases[0]?.contextHash;
    const input = bundle([good]);
    const changed = structuredClone(input); changed.cases[0]!.context.passages[1]!.text = "Otro contexto";
    expect(replayDrafts(changed).cases[0]?.contextHash).not.toBe(initial);
    const reordered = { ...input, cases: [{ ...input.cases[0], context: { passages: context.passages, missingFields: [], extracted: context.extracted, summary: context.summary, category: context.category, customerMessage: context.customerMessage } }] };
    expect(replayDrafts(reordered).cases[0]?.contextHash).toBe(initial);
  });
  it("rejects duplicate case/source IDs, missing context and missing attempt records", () => {
    const input = bundle([good]);
    expect(() => replayDrafts({ ...input, cases: [...input.cases, ...input.cases] })).toThrow();
    expect(() => replayDrafts({ ...input, cases: [{ ...input.cases[0], context: { ...context, passages: [context.passages[0], context.passages[0]] } }] })).toThrow();
    expect(() => replayDrafts({ ...input, cases: [{ id: "one", attempts: [] }] })).toThrow();
    expect(() => replayDrafts(bundle([]))).toThrow();
  });
});
