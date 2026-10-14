// Composition root for the web inbox: SQLite storage, Groq classifier, HTTP API and the built web app.
// Usage: npm run serve (API only until the web app is built), or npm run demo (builds it first)
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createAiSdkClassifier } from "./adapters/ai-sdk-classifier.js";
import { createAiSdkReplyDrafter } from "./adapters/ai-sdk-reply-drafter.js";
import { createGroqModelFromEnv } from "./adapters/groq-model.js";
import { SqliteTicketRepository } from "./adapters/sqlite-ticket-repository.js";
import { createDraftReply } from "./application/draft-reply.js";
import { createInbox } from "./application/inbox.js";
import { createTriageRequest } from "./application/triage-request.js";
import { parsePolicyPassages, type PolicyPassage } from "./domain/policy.js";
import { createApp } from "./http/app.js";

const DEFAULT_PORT = 3000;
// The API has no authentication and triage spends provider tokens, so it only
// listens on this machine unless HOST says otherwise.
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_DB_PATH = "data/inbox.db";
const WEB_ROOT = fileURLToPath(new URL("../web/dist", import.meta.url));
const POLICIES_FILE = new URL("../knowledge/store-policies.json", import.meta.url);

function main(): number {
  const config = createGroqModelFromEnv(process.env);
  if (!config.ok) {
    console.error(config.error);
    return 1;
  }

  const port = Number(process.env["PORT"] ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    console.error("PORT must be an integer between 1 and 65535.");
    return 1;
  }
  const hostname = process.env["HOST"] ?? DEFAULT_HOST;
  const dbPath = process.env["INBOX_DB_PATH"] ?? DEFAULT_DB_PATH;

  mkdirSync(dirname(dbPath), { recursive: true });
  const repository = SqliteTicketRepository.open(dbPath);
  const classifier = createAiSdkClassifier({
    model: config.value.model,
    // Constant format string: request ids come from users and must not be read as format specifiers.
    onError: (requestId, error) =>
      console.error("Triage failed for %s: %s", JSON.stringify(requestId), error instanceof Error ? error.name : "UnknownError"),
  });
  const inbox = createInbox({
    repository,
    triageRequest: createTriageRequest({ classifier }),
    now: () => new Date().toISOString(),
  });
  const passages = loadPolicies();
  if (!passages) {
    console.error("Store policies are missing or invalid: check knowledge/store-policies.json.");
    repository.close();
    return 1;
  }
  const draftReply = createDraftReply({
    repository,
    passages,
    drafter: createAiSdkReplyDrafter({
      model: config.value.model,
      onError: (error) => console.error("Draft failed: %s", error instanceof Error ? error.name : "UnknownError"),
    }),
  });
  const webBuilt = existsSync(join(WEB_ROOT, "index.html"));
  const app = createApp({ inbox, draftReply, generateId: randomUUID, ...(webBuilt && { webRoot: WEB_ROOT }) });

  const server = serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`InboxOps on http://${hostname}:${port} (database: ${dbPath}, model: ${config.value.modelId})`);
    if (!webBuilt) console.log("Web app not built: serving the API only. Run npm run build:web to include it.");
  });

  const shutdown = () => {
    server.close();
    repository.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return 0;
}

// Invalid policies stop the server: drafts must never cite an unchecked knowledge base.
function loadPolicies(): PolicyPassage[] | undefined {
  try {
    return parsePolicyPassages(JSON.parse(readFileSync(POLICIES_FILE, "utf8")));
  } catch {
    return undefined;
  }
}

process.exitCode = main();
