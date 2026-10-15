import { describe, expect, it, vi } from "vitest";
import { captureDrafts } from "../src/evaluation/draft-capture.js";
import { replayDrafts } from "../src/evaluation/draft-replay.js";
const context = { customerMessage: "¿Seguimiento 0042?", category: "shipping", extracted: { orderNumber: "0042" }, missingFields: [], passages: [] };
const seed = { version: 1, provenance: "synthetic", cases: ["one", "two"].map(id => ({ id, context, attempts: [{ status: "returned", output: { sentences: [] } }] })) };
const meta = { provider: "groq", modelId: "test-model", instructions: "instructions", outputSchema: { type: "object" }, maxRetries: 0, timeoutMs: 30000 };
describe("bounded draft capture", () => {
  it("accepts frozen inputs without inventing previous attempts and records only new calls", async () => {
    const frozen = { version: 1, provenance: "synthetic", kind: "frozen_inputs", cases: seed.cases.map(({ id, context }) => ({ id, context })) };
    const call = vi.fn().mockResolvedValue({ status: "returned", output: { sentences: [{ text: "Hola", sourceIds: [] }] } });
    expect(() => replayDrafts(frozen)).toThrow();
    const result = await captureDrafts(frozen, meta, call, async () => {});
    expect(call).toHaveBeenCalledTimes(2);
    expect(result.cases.every(item => item.attempts.length === 1)).toBe(true);
    expect(replayDrafts(result).counts.attempts).toBe(2);
    expect(result.cases.map(item => item.context)).toEqual(frozen.cases.map(item => item.context));
  });
  it("rejects duplicate frozen IDs, more than two inputs and attempts disguised as frozen inputs", async () => {
    const frozen = { version: 1, provenance: "synthetic", kind: "frozen_inputs", cases: seed.cases.map(({ id, context }) => ({ id, context })) };
    const call = vi.fn();
    for (const cases of [[frozen.cases[0], frozen.cases[0]], [...frozen.cases, { ...frozen.cases[0], id: "third" }], seed.cases]) {
      await expect(captureDrafts({ ...frozen, cases }, meta, call, async () => {})).rejects.toThrow();
    }
    expect(call).not.toHaveBeenCalled();
  });
  it("captures fixed contexts once each, checkpoints failures, preserves metadata and replays", async () => {
    const call = vi.fn().mockResolvedValueOnce({ status: "error", error: "invalid_output", evidence: { rawText: '{"bad":true}', statusCode: 400 } }).mockResolvedValueOnce({ status: "returned", output: { sentences: [{ text: "Hola", sourceIds: [] }] }, evidence: { rawText: '{"sentences":[{"text":"Hola","sourceIds":[]}]}' } });
    const checkpoints: unknown[] = [];
    const result = await captureDrafts(seed, meta, call, async value => { checkpoints.push(structuredClone(value)); });
    expect(call).toHaveBeenCalledTimes(2);
    expect(call.mock.calls[0]?.[0]).toEqual(context);
    expect(result.cases.map(c => c.context)).toEqual([context, context]);
    expect(result.capture).toMatchObject(meta);
    expect(result.capture.caseOrigin).toBe("synthetic");
    expect(result.cases[0]?.attempts[0]).toMatchObject({ status: "error", error: "invalid_output", evidence: { rawText: '{"bad":true}', statusCode: 400, prompt: expect.any(String), startedAt: expect.any(String), finishedAt: expect.any(String), latencyMs: expect.any(Number) } });
    expect(checkpoints).toHaveLength(5);
    expect(checkpoints[1]).toMatchObject({ capture: { complete: false, inFlightCaseId: "one", inFlightContext: context, inFlightPrompt: expect.any(String) } });
    expect(replayDrafts(result).counts).toEqual({ attempts: 2, valid: 1, invalid: 0, errors: 1, usageMissing: 2 });
    expect(replayDrafts(result).capture).toEqual(result.capture);
  });
  it("prevalidates all inputs and budget before any provider call", async () => {
    const call = vi.fn();
    await expect(captureDrafts({ ...seed, cases: [...seed.cases, { ...seed.cases[0], id: "three" }] }, meta, call, async () => {})).rejects.toThrow();
    await expect(captureDrafts(seed, { ...meta, maxRetries: 2 }, call, async () => {})).rejects.toThrow();
    expect(call).not.toHaveBeenCalled();
  });
  it("does not continue spending if a checkpoint cannot be saved", async () => {
    const call = vi.fn().mockResolvedValue({ status: "error", error: "unavailable" });
    let writes = 0;
    await expect(captureDrafts(seed, meta, call, async () => { if (++writes === 3) throw new Error("disk failed"); })).rejects.toThrow("disk failed");
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("records unexpected transport throws as a failed attempt without leaking error text or retrying", async () => {
    const call = vi.fn().mockRejectedValue(new Error("secret raw error"));
    const result = await captureDrafts(seed, meta, call, async () => {});
    expect(call).toHaveBeenCalledTimes(2);
    expect(result.cases.every(c => c.attempts[0]?.status === "error")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret raw error");
  });
});
