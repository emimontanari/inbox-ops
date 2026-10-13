import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CATEGORIES } from "../domain/category.js";
import { fail, ok, type Result } from "../domain/result.js";

// The dataset is a file anyone can edit, so it is validated like any other untrusted input.
const evalCaseSchema = z.object({
  id: z.string().min(1),
  split: z.enum(["dev", "holdout"]),
  tags: z.array(z.string()),
  body: z.string().min(1),
  expected: z.object({
    category: z.enum(CATEGORIES),
    orderNumber: z.string().nullable(),
    hasReturnReason: z.boolean(),
  }),
});

export type EvalCase = z.infer<typeof evalCaseSchema>;

export type Split = EvalCase["split"];

export function parseDataset(data: unknown): Result<EvalCase[], string> {
  const parsed = z.array(evalCaseSchema).safeParse(data);
  return parsed.success ? ok(parsed.data) : fail(z.prettifyError(parsed.error));
}

export async function loadDataset(path: string): Promise<EvalCase[]> {
  const text = await readFile(path, "utf8");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`Dataset at ${path} is not valid JSON`, { cause: error });
  }

  const parsed = parseDataset(data);
  if (!parsed.ok) throw new Error(`Invalid dataset at ${path}:\n${parsed.error}`);
  return parsed.value;
}
