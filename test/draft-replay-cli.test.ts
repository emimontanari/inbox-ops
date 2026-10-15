import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const cli = "src/evaluation/run-draft-replay.ts";
const run = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8" });
describe("draft replay CLI", () => {
  it("replays the labelled synthetic fixture identically without a provider key", () => {
    const args = ["--import", "tsx", cli, "eval/drafts/replay/synthetic-v1.json"];
    const env = { ...process.env, GROQ_API_KEY: "" };
    const first = execFileSync(process.execPath, args, { encoding: "utf8", env });
    expect(first).toBe(execFileSync(process.execPath, args, { encoding: "utf8", env }));
    const report = JSON.parse(first);
    expect(report.provenance).toBe("synthetic");
    expect(report.counts).toEqual({ attempts: 2, valid: 2, invalid: 0, errors: 0, usageMissing: 2 });
    expect(report.cases[0].context.passages).toHaveLength(2);
  });
  it("fails closed on missing arguments or files", () => {
    expect(run([]).status).toBe(2);
    expect(run(["nonexistent-file.json"]).status).toBe(2);
  });
  it("prints failure evidence and exits 1 rather than hiding errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "draft-replay-"));
    try {
      const file = join(dir, "input.json");
      writeFileSync(file, JSON.stringify({ version: 1, provenance: "synthetic", cases: [{ id: "fail", context: { customerMessage: "Hola", category: "other", extracted: {}, missingFields: [], passages: [] }, attempts: [{ status: "error", error: "unavailable" }] }] }));
      const result = run([file]);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).counts.errors).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
