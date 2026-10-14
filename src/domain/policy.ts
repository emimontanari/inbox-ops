import { z } from "zod";
import { CATEGORIES, type Category } from "./category.js";

// A short, citable fragment of a store policy. Drafts may only cite passages by id.
export type PolicyPassage = {
  readonly id: string;
  readonly title: string;
  readonly topics: readonly Category[];
  readonly text: string;
};

const MAX_PASSAGE_LENGTH = 800;

const passagesSchema = z
  .array(
    z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      topics: z.array(z.enum(CATEGORIES)).min(1),
      text: z.string().trim().min(1).max(MAX_PASSAGE_LENGTH),
    }),
  )
  .min(1)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Duplicate passage ids");

// Validate the knowledge base once at startup, so a broken file fails fast instead of producing uncitable drafts.
export function parsePolicyPassages(input: unknown): PolicyPassage[] {
  const parsed = passagesSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid policy passages: ${parsed.error.message}`);
  return parsed.data;
}
