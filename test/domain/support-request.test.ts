import { describe, expect, it } from "vitest";
import { MAX_BODY_LENGTH, createSupportRequest } from "../../src/domain/support-request.js";

describe("createSupportRequest", () => {
  it("creates a request with a trimmed body", () => {
    const result = createSupportRequest({ id: "req-1", body: "  Where is my order?  " });

    expect(result).toEqual({ ok: true, value: { id: "req-1", body: "Where is my order?" } });
  });

  it("rejects an empty id", () => {
    const result = createSupportRequest({ id: "  ", body: "Where is my order?" });

    expect(result).toEqual({ ok: false, error: "empty_id" });
  });

  it("rejects a body with only whitespace", () => {
    const result = createSupportRequest({ id: "req-1", body: " \n\t " });

    expect(result).toEqual({ ok: false, error: "empty_body" });
  });

  it("accepts a body at the maximum length", () => {
    const result = createSupportRequest({ id: "req-1", body: "a".repeat(MAX_BODY_LENGTH) });

    expect(result.ok).toBe(true);
  });

  it("rejects a body longer than the maximum length", () => {
    const result = createSupportRequest({ id: "req-1", body: "a".repeat(MAX_BODY_LENGTH + 1) });

    expect(result).toEqual({ ok: false, error: "body_too_long" });
  });
});
