import { fail, ok, type Result } from "./result.js";

// Upper bound on what we send to a model: keeps cost and latency predictable.
export const MAX_BODY_LENGTH = 4000;

export type SupportRequest = {
  readonly id: string;
  readonly body: string;
};

export type SupportRequestError = "empty_id" | "empty_body" | "body_too_long";

export function createSupportRequest(input: {
  id: string;
  body: string;
}): Result<SupportRequest, SupportRequestError> {
  const id = input.id.trim();
  const body = input.body.trim();

  if (id === "") return fail("empty_id");
  if (body === "") return fail("empty_body");
  if (body.length > MAX_BODY_LENGTH) return fail("body_too_long");

  return ok({ id, body });
}
