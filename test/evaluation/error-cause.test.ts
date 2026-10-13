import { describe, expect, it } from "vitest";
import { describeError } from "../../src/evaluation/error-cause.js";

describe("describeError", () => {
  it("keeps the name, status code and message of the last retried error", () => {
    const last = Object.assign(new Error("Service unavailable"), { statusCode: 503 });
    const retryError = Object.assign(new Error("Failed after 3 attempts"), {
      name: "AI_RetryError",
      lastError: last,
    });

    expect(describeError(retryError)).toEqual({
      name: "AI_RetryError",
      statusCode: 503,
      message: "Service unavailable",
    });
  });

  it("redacts provider organization ids from the message", () => {
    const error = Object.assign(new Error("Rate limit reached in organization `org_01abcXYZ` on tokens"), {
      statusCode: 429,
    });

    expect(describeError(error).message).toBe("Rate limit reached in organization `org_<redacted>` on tokens");
  });

  it("describes a value that is not an Error", () => {
    expect(describeError("boom")).toEqual({ name: "UnknownError", message: "boom" });
  });
});
