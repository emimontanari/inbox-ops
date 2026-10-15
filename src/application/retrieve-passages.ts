import type { Category } from "../domain/category.js";
import type { PolicyPassage } from "../domain/policy.js";

export type PassageQuery = {
  text: string;
  category?: Category;
};

const DEFAULT_LIMIT = 3;
const CATEGORY_BOOST = 2;
// A passage needs at least this many shared words to count as relevant. One shared word ("envíos")
// matched uncovered questions to unrelated policies, and the model then applied them as if they fit.
const MIN_SHARED_WORDS = 2;
// Crude stemming: Spanish inflections share a prefix (devolver, devolución -> "devol").
const STEM_LENGTH = 5;
const MIN_WORD_LENGTH = 4;
const STOPWORDS = new Set(["para", "pero", "como", "este", "esta", "esto", "porque", "cual", "cuál", "quiero", "tengo", "hola", "gracias", "with", "that", "this", "have", "from"]);

// Deterministic lexical retrieval: no embeddings or extra dependencies for a handful of passages.
// Shared words decide relevance; the ticket category only ranks passages that already qualify.
// An empty result is meaningful: no policy covers the request, so the drafter must not cite one.
export function retrievePassages(passages: readonly PolicyPassage[], query: PassageQuery, limit = DEFAULT_LIMIT): PolicyPassage[] {
  const queryStems = stems(query.text);
  return passages
    .map((passage) => {
      const passageStems = stems(`${passage.title} ${passage.text}`);
      const shared = [...queryStems].filter((stem) => passageStems.has(stem)).length;
      const boost = query.category && passage.topics.includes(query.category) ? CATEGORY_BOOST : 0;
      return { passage, shared, score: shared + boost };
    })
    .filter((item) => item.shared >= MIN_SHARED_WORDS)
    .sort((a, b) => b.score - a.score || a.passage.id.localeCompare(b.passage.id))
    .slice(0, limit)
    .map((item) => item.passage);
}

function stems(text: string): Set<string> {
  const words = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u);
  return new Set(
    words
      .filter((word) => word.length >= MIN_WORD_LENGTH && !STOPWORDS.has(word))
      .map((word) => word.slice(0, STEM_LENGTH)),
  );
}
