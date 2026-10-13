import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { createAiSdkClassifier } from "../../src/adapters/ai-sdk-classifier.js";

const request = { id: "req-1", body: "I want to return order 1234, it arrived broken." };

function modelAnswering(text: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 40, text: 40, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

function modelThrowing(error: Error): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => {
      throw error;
    },
  });
}

describe("AiSdkClassifier", () => {
  it("maps a valid model answer to classifier output, dropping null fields and reporting usage", async () => {
    const model = modelAnswering(
      JSON.stringify({
        category: "returns",
        summary: "Customer wants to return order 1234 because it arrived broken.",
        orderNumber: "1234",
        returnReason: null,
      }),
    );

    const result = await createAiSdkClassifier({ model }).classify(request);

    expect(result).toEqual({
      ok: true,
      value: {
        category: "returns",
        summary: "Customer wants to return order 1234 because it arrived broken.",
        extracted: { orderNumber: "1234" },
        usage: { inputTokens: 120, outputTokens: 40 },
      },
    });
  });

  it("keeps the customer text out of the instructions", async () => {
    const model = modelAnswering(
      JSON.stringify({ category: "other", summary: "Greeting.", orderNumber: null, returnReason: null }),
    );

    await createAiSdkClassifier({ model }).classify(request);

    const prompt = model.doGenerateCalls[0]?.prompt ?? [];
    const system = prompt.find((message) => message.role === "system");
    const user = prompt.find((message) => message.role === "user");
    expect(JSON.stringify(system)).not.toContain(request.body);
    expect(JSON.stringify(user)).toContain(request.body);
  });

  it("asks for the summary in Spanish whatever the customer's language", async () => {
    const model = modelAnswering(
      JSON.stringify({ category: "other", summary: "Saludo.", orderNumber: null, returnReason: null }),
    );

    await createAiSdkClassifier({ model }).classify(request);

    const system = model.doGenerateCalls[0]?.prompt.find((message) => message.role === "system");
    expect(JSON.stringify(system)).toContain("Always write the summary in Spanish");
  });

  it("reports an answer that is not JSON as invalid output", async () => {
    const model = modelAnswering("Sure! This looks like a return request.");

    const result = await createAiSdkClassifier({ model }).classify(request);

    expect(result).toEqual({ ok: false, error: "invalid_output" });
  });

  it("reports an answer outside the schema as invalid output", async () => {
    const model = modelAnswering(
      JSON.stringify({ category: "refunds", summary: "Refund.", orderNumber: null, returnReason: null }),
    );

    const result = await createAiSdkClassifier({ model }).classify(request);

    expect(result).toEqual({ ok: false, error: "invalid_output" });
  });

  it("reports a provider failure as unavailable", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("connection refused");
      },
    });

    const result = await createAiSdkClassifier({ model }).classify(request);

    expect(result).toEqual({ ok: false, error: "unavailable" });
  });

  it("reports a provider-side JSON validation failure as invalid output", async () => {
    const model = modelThrowing(
      new APICallError({
        message: "Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
        url: "https://api.groq.com/openai/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 400,
        responseBody: '{"error":{"code":"json_validate_failed"}}',
        isRetryable: false,
      }),
    );

    const result = await createAiSdkClassifier({ model }).classify(request);

    expect(result).toEqual({ ok: false, error: "invalid_output" });
  });

  it("keeps any other bad request as unavailable", async () => {
    const model = modelThrowing(
      new APICallError({
        message: "Invalid API parameter",
        url: "https://api.groq.com/openai/v1/chat/completions",
        requestBodyValues: {},
        statusCode: 400,
        isRetryable: false,
      }),
    );

    const result = await createAiSdkClassifier({ model }).classify(request);

    expect(result).toEqual({ ok: false, error: "unavailable" });
  });

  it("hands the original error to onError so the cause is not lost", async () => {
    const failure = new Error("connection refused");
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw failure;
      },
    });
    const seen: Array<{ requestId: string; error: unknown }> = [];

    await createAiSdkClassifier({
      model,
      onError: (requestId, error) => seen.push({ requestId, error }),
    }).classify(request);

    expect(seen).toEqual([{ requestId: "req-1", error: failure }]);
  });
});
