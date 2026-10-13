import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../../src/domain/category.js";
import { loadDataset, parseDataset } from "../../src/evaluation/dataset.js";

const datasetPath = fileURLToPath(new URL("../../eval/dataset.json", import.meta.url));

describe("eval dataset", () => {
  it("loads, has unique ids and covers every category in both splits", async () => {
    const cases = await loadDataset(datasetPath);

    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const split of ["dev", "holdout"] as const) {
      const categories = new Set(cases.filter((c) => c.split === split).map((c) => c.expected.category));
      expect([...categories].sort()).toEqual([...CATEGORIES].sort());
    }
  });

  it("only expects order numbers that appear in the request text", async () => {
    const cases = await loadDataset(datasetPath);

    for (const c of cases) {
      if (c.expected.orderNumber !== null) {
        expect(c.body, c.id).toContain(c.expected.orderNumber);
      }
    }
  });

  it("rejects a case with an unknown category", () => {
    const result = parseDataset([
      {
        id: "x",
        split: "dev",
        tags: [],
        body: "Hi",
        expected: { category: "refunds", orderNumber: null, hasReturnReason: false },
      },
    ]);

    expect(result.ok).toBe(false);
  });
});
