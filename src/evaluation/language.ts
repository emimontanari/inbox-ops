export type Language = "es" | "en" | "unknown";

// Frequent function words that exist in only one of the two languages.
// Shared words such as "a", "no" or "me" are left out on purpose.
const SPANISH_WORDS = new Set([
  "el", "la", "los", "las", "del", "de", "que", "y", "en", "por", "porque", "para",
  "un", "una", "su", "sus", "se", "con", "al", "le", "lo", "pero", "quiere", "pide",
]);
const ENGLISH_WORDS = new Set([
  "the", "to", "and", "of", "is", "it", "for", "with", "because", "wants", "was",
  "has", "their", "his", "her", "an", "in", "on", "asks", "but",
]);
const SPANISH_CHARACTERS = /[áéíóúñ¿¡]/i;

// Heuristic detector for short summaries; good enough for an eval metric, not for production.
export function detectLanguage(text: string): Language {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let spanish = words.filter((word) => SPANISH_WORDS.has(word)).length;
  const english = words.filter((word) => ENGLISH_WORDS.has(word)).length;
  if (SPANISH_CHARACTERS.test(text)) spanish++;

  if (spanish > english) return "es";
  if (english > spanish) return "en";
  return "unknown";
}
