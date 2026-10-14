import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";

// Distinguishes "the model answered, but the answer was invalid" from "the provider could not answer".
export function isInvalidOutput(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) return true;
  // Providers that enforce the schema server-side (Groq) reject an invalid generation
  // with HTTP 400 instead of returning it: the model answered, the answer was invalid.
  return (
    APICallError.isInstance(error) &&
    error.statusCode === 400 &&
    (error.responseBody?.includes("json_validate_failed") === true ||
      /failed to generate json/i.test(error.message))
  );
}
