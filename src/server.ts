// Composition root for the web inbox: SQLite storage, Groq classifier and the HTTP API.
// Usage: npm run serve
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { createAiSdkClassifier } from "./adapters/ai-sdk-classifier.js";
import { createGroqModelFromEnv } from "./adapters/groq-model.js";
import { SqliteTicketRepository } from "./adapters/sqlite-ticket-repository.js";
import { createInbox } from "./application/inbox.js";
import { createTriageRequest } from "./application/triage-request.js";
import { createApp } from "./http/app.js";

const DEFAULT_PORT = 3000;
// The API has no authentication and triage spends provider tokens, so it only
// listens on this machine unless HOST says otherwise.
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_DB_PATH = "data/inbox.db";

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
    onError: (requestId, error) =>
      console.error(`Triage failed for ${requestId}:`, error instanceof Error ? error.name : "UnknownError"),
  });
  const inbox = createInbox({
    repository,
    triageRequest: createTriageRequest({ classifier }),
    now: () => new Date().toISOString(),
  });
  const app = createApp({ inbox, generateId: randomUUID });

  const server = serve({ fetch: app.fetch, port, hostname }, () => {
    console.log(`InboxOps API on http://${hostname}:${port} (database: ${dbPath}, model: ${config.value.modelId})`);
  });

  const shutdown = () => {
    server.close();
    repository.close();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return 0;
}

process.exitCode = main();
