import { describe, expect, it, vi } from "vitest";
import { APICallError, generateText, type LanguageModel } from "ai";
import { createCaptureTransport } from "../src/evaluation/capture-transport.js";
vi.mock("ai", async importOriginal => ({ ...await importOriginal<typeof import("ai")>(), generateText: vi.fn() }));
const context = { customerMessage: "Hola", category: "other" as const, extracted: {}, missingFields: [], passages: [] };
describe("unrepaired capture transport", () => {
  it("uses one bounded SDK request and keeps raw text with unknown usage absent", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({ text: '{"sentences":[{"text":"Hola","sourceIds":[]}]}', usage: {} } as Awaited<ReturnType<typeof generateText>>);
    const result = await createCaptureTransport("test" as LanguageModel)(context);
    expect(vi.mocked(generateText).mock.lastCall?.[0]).toMatchObject({ maxRetries: 0, timeout: 30000, maxOutputTokens: 4096 });
    expect(result).toMatchObject({ status: "returned", output: { sentences: [{ text: "Hola", sourceIds: [] }] } });
    expect(result.status === "returned" && (result.output as { usage?: unknown }).usage).toBeUndefined();
  });
  it("retains rejected JSON as evidence without repairing keys or storing arbitrary response data", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new APICallError({ message: "hidden", url: "https://example.invalid", requestBodyValues: {}, statusCode: 400, responseBody: JSON.stringify({ secret: "do-not-store", error: { failed_generation: '{"sentences:":[]}' } }) }));
    const result = await createCaptureTransport("test" as LanguageModel)(context);
    expect(result).toEqual({ status: "error", error: "invalid_output", evidence: { rawText: '{"sentences:":[]}', statusCode: 400 } });
    expect(JSON.stringify(result)).not.toContain("do-not-store");
  });
});
