import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../../src/domain/category.js";
import { parsePolicyPassages } from "../../src/domain/policy.js";

const passage = { id: "returns-window", title: "Devoluciones", topics: ["returns"], text: "Aceptamos devoluciones dentro de los 30 días." };

describe("policy passages", () => {
  it("keeps valid passages unchanged", () => {
    expect(parsePolicyPassages([passage])).toEqual([passage]);
  });

  it.each([
    { name: "empty list", input: [] },
    { name: "not a list", input: { passages: [passage] } },
    { name: "duplicate id", input: [passage, { ...passage }] },
    { name: "blank id", input: [{ ...passage, id: " " }] },
    { name: "blank text", input: [{ ...passage, text: "" }] },
    { name: "text over 800 characters", input: [{ ...passage, text: "a".repeat(801) }] },
    { name: "unknown topic", input: [{ ...passage, topics: ["refunds"] }] },
    { name: "no topics", input: [{ ...passage, topics: [] }] },
  ])("rejects $name", ({ input }) => {
    expect(() => parsePolicyPassages(input)).toThrow("Invalid policy passages");
  });

  it("ships a valid knowledge base covering shipping, returns and billing", () => {
    const passages = parsePolicyPassages(JSON.parse(readFileSync(new URL("../../knowledge/store-policies.json", import.meta.url), "utf8")));
    const topics = new Set(passages.flatMap((item) => item.topics));
    for (const category of CATEGORIES.filter((category) => category !== "other")) expect(topics).toContain(category);
    expect(passages.length).toBeLessThanOrEqual(12);
  });
});
