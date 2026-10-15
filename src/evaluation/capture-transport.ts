import { APICallError, generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { draftSchema, INSTRUCTIONS, toPromptData } from "../adapters/ai-sdk-reply-drafter.js";
import type { DraftContext } from "../application/reply-drafter.js";
import type { CaptureResponse } from "./draft-capture.js";

// Evaluation deliberately bypasses the UI adapter's recovery and unknown-usage-as-zero mapping.
export function createCaptureTransport(model: LanguageModel) {
  return async (context: DraftContext): Promise<CaptureResponse> => {
    try {
      const result = await generateText({ model, instructions: INSTRUCTIONS, prompt: JSON.stringify(toPromptData(context)), output: Output.object({ schema: draftSchema }), maxRetries: 0, timeout: 30000, maxOutputTokens: 4096 });
      let output: unknown;
      try { output = JSON.parse(result.text); } catch { output = result.text; }
      const usage = result.usage;
      if (typeof output === "object" && output !== null && !Array.isArray(output) && usage.inputTokens !== undefined && usage.outputTokens !== undefined) {
        output = { ...output, usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } };
      }
      return { status: "returned", output, evidence: { rawText: result.text } };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) return { status: "error", error: "invalid_output", evidence: { rawText: error.text ?? "" } };
      if (APICallError.isInstance(error)) {
        let rawText: string | undefined;
        // Keep rejected generation, not arbitrary provider response bodies, headers or credentials.
        try {
          const body = JSON.parse(error.responseBody ?? "{}") as { error?: { failed_generation?: unknown } };
          if (typeof body.error?.failed_generation === "string") rawText = body.error.failed_generation;
        } catch { /* No recoverable generation in the response. */ }
        return { status: "error", error: rawText !== undefined ? "invalid_output" : "provider_error", evidence: { ...(rawText !== undefined ? { rawText } : {}), ...(error.statusCode !== undefined ? { statusCode: error.statusCode } : {}) } };
      }
      return { status: "error", error: "unavailable" };
    }
  };
}
