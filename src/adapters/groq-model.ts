import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { fail, ok, type Result } from "../domain/result.js";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export type ModelConfig = { model: LanguageModel; modelId: string };

// Reads provider settings from the environment; shared by every entry point.
export function createGroqModelFromEnv(env: NodeJS.ProcessEnv): Result<ModelConfig, string> {
  const apiKey = env["GROQ_API_KEY"];
  if (!apiKey) return fail("Missing GROQ_API_KEY. Set it in .env (see README, Configuration).");

  const modelId = env["GROQ_MODEL"] ?? DEFAULT_GROQ_MODEL;
  return ok({ model: createGroq({ apiKey })(modelId), modelId });
}
