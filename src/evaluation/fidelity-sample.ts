import { z } from "zod";

const sampleSchema = z.object({
  version: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  cases: z.array(z.object({
    id: z.string().trim().min(1),
    body: z.string().trim().min(1).max(4000),
    facts: z.array(z.string().trim().min(1)).min(1),
    tags: z.array(z.string().trim().min(1)),
  })).min(1).max(50),
}).superRefine((sample, context) => {
  if (new Set(sample.cases.map((item) => item.id)).size !== sample.cases.length) {
    context.addIssue({ code: "custom", message: "Duplicate fidelity case ids" });
  }
});

// Only versioned diagnostic samples can be selected; never arbitrary/holdout paths.
export function parseFidelityArgs(args: string[]) {
  const selections = args.filter((arg) => arg.startsWith("--sample="));
  if (selections.length > 1 || args.filter((arg) => arg === "--dry-run").length > 1 ||
    args.some((arg) => !["--dry-run", "--sample=sample-v1", "--sample=injection-v1"].includes(arg))) {
    throw new Error("Unsupported fidelity arguments");
  }
  return {
    samplePath: selections[0] === "--sample=injection-v1" ? "eval/fidelity/injection-v1.json" : "eval/fidelity/sample-v1.json",
    dryRun: args.includes("--dry-run"),
  };
}

// Validate the complete source-fact sample before making any provider call.
export function parseFidelitySample(input: unknown) {
  return sampleSchema.parse(input);
}
