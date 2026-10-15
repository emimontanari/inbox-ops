import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const cli = "src/evaluation/run-draft-capture.ts";
const seed = "eval/drafts/replay/synthetic-v1.json";
const run = (args: string[], key = "") => spawnSync(process.execPath, ["--import", "tsx", cli, ...args], { encoding: "utf8", env: { ...process.env, GROQ_API_KEY: key } });
describe("capture CLI guards without network", () => {
  it("requires the explicit call-budget flag and a key", () => {
    expect(run([seed, "unused-output.json"]).status).toBe(2);
    expect(run(["--confirm-provider-calls=2", seed, "unused-output.json"]).status).toBe(2);
  });
  it("refuses to overwrite previous evidence even when a key is configured", () => {
    const dir = mkdtempSync(join(tmpdir(), "capture-guard-"));
    try {
      const output = join(dir, "evidence.json"); writeFileSync(output, "keep-me");
      expect(run(["--confirm-provider-calls=2", seed, output], "not-a-real-key").status).toBe(2);
      expect(readFileSync(output, "utf8")).toBe("keep-me");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
