import { describe, expect, it } from "vitest";
import { parseFidelitySample } from "../src/evaluation/fidelity-sample.js";

const sample = { version: "fidelity-v1", purpose: "Diagnostic sample", cases: [{ id: "f-1", body: "Consulta real", facts: ["Pide información"], tags: ["other"] }] };

describe("fidelity sample validation before spending tokens", () => {
  it("preserves source facts and case identifiers", () => {
    expect(parseFidelitySample(sample)).toEqual(sample);
  });
  it("rejects duplicate ids", () => {
    expect(() => parseFidelitySample({ ...sample, cases: [...sample.cases, ...sample.cases] })).toThrow();
  });
  it.each([
    { ...sample, cases: [] },
    { ...sample, cases: [{ ...sample.cases[0], body: " " }] },
    { ...sample, cases: [{ ...sample.cases[0], body: "a".repeat(4001) }] },
    { ...sample, cases: [{ ...sample.cases[0], facts: [] }] },
    { ...sample, cases: [{ ...sample.cases[0], facts: [""] }] },
  ])("rejects unusable sample %#", (input) => {
    expect(() => parseFidelitySample(input)).toThrow();
  });
});
