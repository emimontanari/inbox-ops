import { describe, expect, it } from "vitest";
import { parseFidelityArgs } from "../src/evaluation/fidelity-sample.js";

describe("fidelity CLI selection before provider calls", () => {
  it("keeps the original sample as the default", () => {
    expect(parseFidelityArgs([])).toEqual({ samplePath: "eval/fidelity/sample-v1.json", dryRun: false });
  });
  it("selects the new diagnostic sample with dry-run", () => {
    expect(parseFidelityArgs(["--sample=injection-v1", "--dry-run"])).toEqual({ samplePath: "eval/fidelity/injection-v1.json", dryRun: true });
  });
  it.each([ { args: ["--sample=../holdout"] }, { args: ["--sample=unknown"] }, { args: ["--sample=injection-v1", "--sample=sample-v1"] }, { args: ["--dry-run", "--dry-run"] }, { args: ["--anything"] } ])("rejects unsupported or duplicate arguments %#", ({ args }) => {
    expect(() => parseFidelityArgs(args)).toThrow("Unsupported fidelity arguments");
  });
});
