import { z } from "zod";
import { fail, ok, type Result } from "./result.js";
export type ReceivedAtError = "invalid_received_at" | "future_received_at";
const timestamp = z.iso.datetime({ offset: true });
// Require an explicit timezone and a real calendar date; Date.parse alone rolls invalid dates forward.
export function parseReceivedAt(value: string, now?: string): Result<string, ReceivedAtError> {
  if (!timestamp.safeParse(value).success) return fail("invalid_received_at");
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return fail("invalid_received_at");
  if (now !== undefined && time > Date.parse(now)) return fail("future_received_at");
  return ok(new Date(time).toISOString());
}
