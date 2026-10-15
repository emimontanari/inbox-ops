import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSemanticPacket } from "../src/evaluation/draft-semantic-review.js";
const capturePath = "eval/drafts/replay/groq-capture-v1.json";
const run = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "src/evaluation/run-draft-semantic.ts", ...args], { encoding: "utf8", env: { ...process.env, GROQ_API_KEY: "" } });
describe("semantic review CLI offline", () => {
  it("selects rubric v2 explicitly and rejects unsupported versions", () => {
    const result = run(["packet", capturePath, "--rubric=draft-semantic-v2"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).rubricVersion).toBe("draft-semantic-v2");
    expect(run(["packet", capturePath, "--rubric=unknown"]).status).toBe(2);
  });
  it("builds a deterministic neutral packet without provider config", () => {
    const a = run(["packet", capturePath]); const b = run(["packet", capturePath]);
    expect(a.status).toBe(0); expect(a.stdout).toBe(b.stdout);
    const packet = JSON.parse(a.stdout);
    expect(packet.responses).toHaveLength(2);
    expect(a.stdout).not.toContain("gpt-oss");
    expect(a.stdout).not.toContain("fixture-sin-politica");
  });
  it("summarizes complete synthetic reviewer fixtures without passing off consensus as truth", () => {
    const packet = buildSemanticPacket(JSON.parse(readFileSync(capturePath, "utf8")));
    const dir = mkdtempSync(join(tmpdir(), "semantic-review-"));
    try {
      const paths = ["synthetic-a", "synthetic-b"].map(id => {
        const path = join(dir, `${id}.json`);
        const review = { packetHash: packet.packetHash, reviewer: { id, kind: "ai", exposure: "unblinded" }, responses: packet.responses.map(response => ({ responseId: response.responseId, abstention: { label: "uncertain", rationale: "Synthetic test, not a semantic verdict." }, sentences: response.sentences.map((sentence, index) => ({ index, support: "uncertain", citations: sentence.sourceIds.length ? "uncertain" : "none", evidenceIds: [], rationale: "Synthetic test, not a semantic verdict." })) })) };
        writeFileSync(path, JSON.stringify(review)); return path;
      });
      const result = run(["report", capturePath, ...paths]);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).status).toBe("reviewer_agreement_not_ground_truth");
      expect(JSON.parse(result.stdout).responses[0].sentences[0].support).toBe("uncertain");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("rejects missing files, missing reviews and invalid modes", () => {
    expect(run(["packet", "no-such-file.json"]).status).toBe(2);
    expect(run(["report", capturePath]).status).toBe(2);
    expect(run(["other", capturePath]).status).toBe(2);
  });
});
