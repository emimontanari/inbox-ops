export type ErrorCause = { name: string; statusCode?: number; message: string };

const MAX_MESSAGE_LENGTH = 200;

// Provider messages can include account identifiers; results files are meant to be shared.
const SENSITIVE_PATTERNS: ReadonlyArray<[RegExp, string]> = [[/org_[A-Za-z0-9]+/g, "org_<redacted>"]];

// Keeps only what helps diagnose a failure; never stores request bodies or headers.
export function describeError(error: unknown): ErrorCause {
  if (!(error instanceof Error)) return { name: "UnknownError", message: redact(String(error)) };

  const last = (error as { lastError?: unknown }).lastError;
  const source = last instanceof Error ? last : error;
  const statusCode = (source as { statusCode?: unknown }).statusCode;

  return {
    name: error.name,
    ...(typeof statusCode === "number" && { statusCode }),
    message: redact(source.message),
  };
}

function redact(message: string): string {
  const clean = SENSITIVE_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), message);
  return clean.slice(0, MAX_MESSAGE_LENGTH);
}
