import { readFileSync } from "node:fs";
import { replayDrafts } from "./draft-replay.js";

// Deliberately no provider imports, environment-file loading, retries or network calls.
try {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("Uso: npm run eval:drafts:replay -- <captura.json>");
  const report = replayDrafts(JSON.parse(readFileSync(args[0]!, "utf8")));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.counts.invalid > 0 || report.counts.errors > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Captura inválida");
  process.exitCode = 2;
}
