// Diagnostic capture only; semantic judgments are recorded separately by reviewers.
// npx tsx --env-file-if-exists=.env src/evaluation/run-fidelity.ts [--sample=injection-v1] [--dry-run]
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createAiSdkClassifier } from "../adapters/ai-sdk-classifier.js";
import { createGroqModelFromEnv } from "../adapters/groq-model.js";
import { createTriageRequest } from "../application/triage-request.js";
import { describeError, type ErrorCause } from "./error-cause.js";
import { parseFidelityArgs, parseFidelitySample } from "./fidelity-sample.js";
import { createMeteredClassifier } from "./metered-classifier.js";
import { createTokenRateLimiter } from "./token-rate-limiter.js";

const root = new URL("../../", import.meta.url);
const hash = (data: string) => createHash("sha256").update(data).digest("hex");
const options = parseFidelityArgs(process.argv.slice(2));
const raw = await readFile(new URL(options.samplePath, root), "utf8");
function decodeSample(text: string): ReturnType<typeof parseFidelitySample> {
  try {
    return parseFidelitySample(JSON.parse(text));
  } catch {
    throw new Error("Invalid fidelity sample JSON or schema; no provider calls made");
  }
}
const sample = decodeSample(raw);
const paths = ["src/adapters/ai-sdk-classifier.ts", "src/adapters/groq-model.ts", "src/application/triage-request.ts", "src/domain/triage-suggestion.ts", "src/evaluation/run-fidelity.ts", "src/evaluation/fidelity-sample.ts", "package-lock.json"];
const sources = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, hash(await readFile(new URL(path, root), "utf8"))])));
if (options.dryRun) {
  console.log(JSON.stringify({ validCases: sample.cases.length, datasetSha256: hash(raw), sources, providerCalls: 0 }, null, 2));
} else {
  const config = createGroqModelFromEnv(process.env);
  if (!config.ok) throw new Error(config.error);
  const tokensPerMinute = Number(process.env["EVAL_TOKENS_PER_MINUTE"] || 8000);
  const estimate = Number(process.env["EVAL_REQUEST_TOKEN_ESTIMATE"] || 2000);
  if (![tokensPerMinute, estimate].every((n) => Number.isInteger(n) && n > 0)) throw new Error("Invalid token pacing configuration");
  const runAt = new Date().toISOString();
  const dir = new URL("eval/fidelity/results/", root);
  await mkdir(dir, { recursive: true });
  const output = new URL(`capture-${runAt.replaceAll(":", "-")}.json`, dir);
  const causes: Record<string, ErrorCause> = {};
  const metered = createMeteredClassifier(createAiSdkClassifier({ model: config.value.model, onError: (id, error) => { causes[id] = describeError(error); } }));
  const triage = createTriageRequest({ classifier: metered.classifier });
  const limiter = createTokenRateLimiter({ tokensPerMinute });
  const cases: Array<{ id: string; result: Awaited<ReturnType<typeof triage>>; measurement: (typeof metered.measurements)[number] | undefined; cause?: ErrorCause }> = [];
  const record = { runAt, purpose: sample.purpose, version: sample.version, datasetSha256: hash(raw), sources, provider: "groq", modelId: config.value.modelId, sampling: "Adapter leaves temperature/seed unspecified; provider defaults apply, not deterministic", sdkRetries: "AI SDK defaults; no additional capture-level retries", pacing: { tokensPerMinute, requestTokenEstimate: estimate }, completed: false, cases };
  // Pin source and dataset identity before spending tokens; preserve partial runs.
  await writeFile(output, JSON.stringify(record, null, 2) + "\n");
  for (const item of sample.cases) {
    await limiter.waitForCapacity(estimate);
    const result = await triage({ id: item.id, body: item.body });
    const measurement = metered.measurements.at(-1);
    const usage = measurement?.usage;
    limiter.record(usage ? usage.inputTokens + usage.outputTokens : 0);
    cases.push({ id: item.id, result, measurement, ...(causes[item.id] && { cause: causes[item.id] }) });
    await writeFile(output, JSON.stringify(record, null, 2) + "\n");
    console.log(`${item.id}: ${result.ok ? "captured" : result.error}`);
  }
  record.completed = true;
  await writeFile(output, JSON.stringify(record, null, 2) + "\n");
  console.log(`Saved ${fileURLToPath(output)}`);
}
