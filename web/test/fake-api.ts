import { vi } from "vitest";
import type { ApiClient } from "../src/api.js";

// Every method fails loudly unless a test provides it.
export function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  const unused = (name: string) =>
    vi.fn(async () => {
      throw new Error(`${name} is not used in this test`);
    });
  return {
    listTickets: unused("listTickets"),
    addRequests: unused("addRequests"),
    triage: unused("triage"),
    accept: unused("accept"),
    correct: unused("correct"),
    ...overrides,
  };
}
