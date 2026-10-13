// Composition root: the only place that picks a real provider and wires dependencies.
// Usage: npm run triage -- "Where is my order 1234?"
import { createAiSdkClassifier } from "./adapters/ai-sdk-classifier.js";
import { createGroqModelFromEnv } from "./adapters/groq-model.js";
import { createTriageRequest } from "./application/triage-request.js";

async function main(): Promise<number> {
  const body = process.argv.slice(2).join(" ");
  if (body.trim() === "") {
    console.error('Usage: npm run triage -- "<customer request text>"');
    return 1;
  }

  const config = createGroqModelFromEnv(process.env);
  if (!config.ok) {
    console.error(config.error);
    return 1;
  }

  const classifier = createAiSdkClassifier({ model: config.value.model });
  const triageRequest = createTriageRequest({ classifier });

  const result = await triageRequest({ id: "cli-1", body });
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

process.exitCode = await main();
