import { readFileSync } from "node:fs";
import { buildSemanticPacket, reviewSchema, rubricVersionSchema, summarizeSemanticReviews } from "./draft-semantic-review.js";
import { bundleSchema } from "./draft-replay.js";

try {
  const args = process.argv.slice(2);
  const flags = args.filter(arg => arg.startsWith("--rubric="));
  if (flags.length > 1) throw new Error("Solo se admite una versión de rúbrica.");
  const version = rubricVersionSchema.parse(flags[0]?.slice("--rubric=".length) ?? "draft-semantic-v1");
  const [mode, capturePath, ...reviews] = args.filter(arg => !arg.startsWith("--rubric="));
  if (!capturePath || !((mode === "packet" && reviews.length === 0) || (mode === "report" && reviews.length === 2))) {
    throw new Error("Uso: npm run eval:drafts:semantic -- packet <captura.json> | report <captura.json> <revision-a.json> <revision-b.json> [--rubric=draft-semantic-v1|draft-semantic-v2]");
  }
  const capture = bundleSchema.parse(JSON.parse(readFileSync(capturePath, "utf8")));
  const parsedReviews = reviews.map(path => {
    const json: unknown = JSON.parse(readFileSync(path, "utf8"));
    return reviewSchema.parse(json);
  });
  const result = mode === "packet"
    ? buildSemanticPacket(capture, version)
    : summarizeSemanticReviews(capture, parsedReviews, version);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Entrada inválida");
  process.exitCode = 2;
}
