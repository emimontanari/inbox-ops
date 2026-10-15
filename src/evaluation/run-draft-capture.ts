import { closeSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { createGroqModelFromEnv } from "../adapters/groq-model.js";
import { draftSchema, INSTRUCTIONS } from "../adapters/ai-sdk-reply-drafter.js";
import { captureDrafts, captureInputSchema } from "./draft-capture.js";
import { createCaptureTransport } from "./capture-transport.js";
import { replayDrafts } from "./draft-replay.js";

try {
  const [flag, input, output, ...extra] = process.argv.slice(2);
  if (flag !== "--confirm-provider-calls=2" || !input || !output || extra.length) throw new Error("Uso: npm run eval:drafts:capture -- --confirm-provider-calls=2 <entrada.json> <salida-nueva.json>");
  const seed = captureInputSchema.parse(JSON.parse(readFileSync(input, "utf8")));
  if (seed.cases.length > 2) throw new Error("Máximo dos casos.");
  const model = createGroqModelFromEnv(process.env);
  if (!model.ok) throw new Error(model.error);
  // Refuse to overwrite any existing evidence, including the input file.
  closeSync(openSync(output, "wx", 0o600));
  const result = await captureDrafts(seed, {
    provider: "groq", modelId: model.value.modelId, instructions: INSTRUCTIONS, outputSchema: z.toJSONSchema(draftSchema),
    maxRetries: 0, timeoutMs: 30000, maxOutputTokens: 4096,
  }, createCaptureTransport(model.value.model), async bundle => {
    const temporary = `${output}.checkpoint`;
    writeFileSync(temporary, `${JSON.stringify(bundle, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, output);
  });
  const report = replayDrafts(result);
  console.log(JSON.stringify({ output, counts: report.counts }, null, 2));
  if (report.counts.invalid || report.counts.errors) process.exitCode = 1;
} catch {
  // Do not dump SDK error objects or environment values into logs.
  console.error("Captura detenida: revisa argumentos, archivo nuevo, contrato y configuración GROQ_API_KEY. Conserva cualquier checkpoint; no reintentes automáticamente.");
  process.exitCode = 2;
}
