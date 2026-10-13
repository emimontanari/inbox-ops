// Evaluation entry point: runs the real triage pipeline over the labeled dataset.
// Usage: npm run eval -- [--split=dev|holdout|all]
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createAiSdkClassifier } from "../adapters/ai-sdk-classifier.js";
import { createGroqModelFromEnv } from "../adapters/groq-model.js";
import { createTriageRequest } from "../application/triage-request.js";
import { loadDataset } from "./dataset.js";
import { describeError, type ErrorCause } from "./error-cause.js";
import { createMeteredClassifier } from "./metered-classifier.js";
import { createTokenRateLimiter } from "./token-rate-limiter.js";
import { scoreCase, summarize, type CaseScore } from "./score.js";

const DATASET_PATH = fileURLToPath(new URL("../../eval/dataset.json", import.meta.url));
const RESULTS_DIR = fileURLToPath(new URL("../../eval/results/", import.meta.url));
const SPLITS = ["dev", "holdout", "all"] as const;
// Groq's on-demand limit for openai/gpt-oss-20b; the provider budgets each request
// by its own estimate (about 1,900 tokens here), not by the tokens finally used.
const DEFAULT_TOKENS_PER_MINUTE = 8000;
const DEFAULT_REQUEST_TOKEN_ESTIMATE = 2000;

type SplitOption = (typeof SPLITS)[number];

function parseSplit(args: readonly string[]): SplitOption | null {
  const value = args.find((arg) => arg.startsWith("--split="))?.slice("--split=".length) ?? "dev";
  return (SPLITS as readonly string[]).includes(value) ? (value as SplitOption) : null;
}

function readPositiveInt(name: string, fallback: number): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function main(): Promise<number> {
  const split = parseSplit(process.argv.slice(2));
  if (split === null) {
    console.error(`Usage: npm run eval -- [--split=${SPLITS.join("|")}]`);
    return 1;
  }

  const config = createGroqModelFromEnv(process.env);
  if (!config.ok) {
    console.error(config.error);
    return 1;
  }

  const tokensPerMinute = readPositiveInt("EVAL_TOKENS_PER_MINUTE", DEFAULT_TOKENS_PER_MINUTE);
  const requestTokenEstimate = readPositiveInt("EVAL_REQUEST_TOKEN_ESTIMATE", DEFAULT_REQUEST_TOKEN_ESTIMATE);
  if (tokensPerMinute === null || requestTokenEstimate === null) {
    console.error("EVAL_TOKENS_PER_MINUTE and EVAL_REQUEST_TOKEN_ESTIMATE must be positive integers.");
    return 1;
  }
  const limiter = createTokenRateLimiter({ tokensPerMinute });

  const cases = (await loadDataset(DATASET_PATH)).filter((c) => split === "all" || c.split === split);
  const errorCauses: Record<string, ErrorCause> = {};
  const metered = createMeteredClassifier(
    createAiSdkClassifier({
      model: config.value.model,
      onError: (requestId, error) => (errorCauses[requestId] = describeError(error)),
    }),
  );
  const triageRequest = createTriageRequest({ classifier: metered.classifier });

  // Sequential and paced: keeps latency numbers clean and stays under the provider's
  // tokens-per-minute limit, so rate limiting is not mistaken for a quality failure.
  const scores: CaseScore[] = [];
  for (const evalCase of cases) {
    await limiter.waitForCapacity(requestTokenEstimate);
    const result = await triageRequest({ id: evalCase.id, body: evalCase.body });
    const usage = metered.measurements.at(-1)?.usage;
    limiter.record(usage ? usage.inputTokens + usage.outputTokens : 0);
    scores.push(scoreCase(evalCase, result));
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  const report = summarize(scores, metered.measurements);
  printReport(scores, report);

  await mkdir(RESULTS_DIR, { recursive: true });
  const runAt = new Date().toISOString();
  const file = `${RESULTS_DIR}${split}-${runAt.replaceAll(":", "-")}.json`;
  const tagsById = Object.fromEntries(cases.map((c) => [c.id, c.tags]));
  await writeFile(
    file,
    `${JSON.stringify({ runAt, split, modelId: config.value.modelId, report, cases: scores.map((s) => ({ ...s, tags: tagsById[s.id], cause: errorCauses[s.id] })) }, null, 2)}\n`,
  );
  console.log(`\nSaved ${file}`);
  return 0;
}

function printReport(scores: readonly CaseScore[], report: ReturnType<typeof summarize>): void {
  console.table(
    scores.map((s) => ({
      id: s.id,
      expected: s.expectedCategory,
      actual: s.actualCategory ?? `error: ${s.error}`,
      category: s.categoryCorrect ? "ok" : "FAIL",
      orderNumber: s.orderNumber,
      returnReason: s.returnReason,
    })),
  );
  console.log(`Category accuracy: ${(report.categoryAccuracy * 100).toFixed(1)}% (${report.total} cases, ${report.errors} errors)`);
  console.log("By expected category:", report.byExpectedCategory);
  console.log("Order number:", report.orderNumber);
  console.log("Return reason:", report.returnReason);
  console.log("Summary language:", report.summaryLanguage);
  const { p50, p95, max } = report.latencyMs;
  console.log(`Latency ms: p50 ${Math.round(p50)}, p95 ${Math.round(p95)}, max ${Math.round(max)}`);
  console.log("Tokens:", report.tokens);
}

process.exitCode = await main();
