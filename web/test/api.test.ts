import { describe, expect, it } from "vitest";
import { ApiError, createApiClient } from "../src/api.js";
import { awaitingTicket, reviewedTicket } from "./fixtures.js";

type Call = { url: string; method: string; body: unknown };

// Fake fetch: records each call and answers with a canned status and body.
function fakeFetch(status: number, body: unknown, contentType = "application/json") {
  const calls: Call[] = [];
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status, headers: { "content-type": contentType } });
  };
  return { fetchFn, calls };
}

describe("api client", () => {
  it("lists tickets", async () => {
    const { fetchFn, calls } = fakeFetch(200, { tickets: [awaitingTicket] });

    const tickets = await createApiClient(fetchFn).listTickets();

    expect(tickets).toEqual([awaitingTicket]);
    expect(calls).toEqual([{ url: "/api/tickets", method: "GET", body: undefined }]);
  });

  it("accepts a ticket, encoding its id in the URL", async () => {
    const { fetchFn, calls } = fakeFetch(200, { ticket: reviewedTicket });

    const ticket = await createApiClient(fetchFn).accept("t 1/2");

    expect(ticket).toEqual(reviewedTicket);
    expect(calls[0]).toMatchObject({ url: "/api/tickets/t%201%2F2/accept", method: "POST" });
  });

  it("requests a reply draft for a ticket, encoding its id", async () => {
    const draft = { sentences: [{ text: "Hola.", sourceIds: [] }], sources: [] };
    const { fetchFn, calls } = fakeFetch(200, { draft });

    expect(await createApiClient(fetchFn).draftReply("t 1/2")).toEqual(draft);
    expect(calls).toEqual([{ url: "/api/tickets/t%201%2F2/draft", method: "POST", body: undefined }]);
  });

  it("sends a correction as JSON", async () => {
    const { fetchFn, calls } = fakeFetch(200, { ticket: reviewedTicket });

    await createApiClient(fetchFn).correct("t-1", { category: "returns", extracted: { orderNumber: "4821" } });

    expect(calls[0]).toEqual({
      url: "/api/tickets/t-1/correct",
      method: "POST",
      body: { category: "returns", extracted: { orderNumber: "4821" } },
    });
  });

  it("adds requests and triggers triage", async () => {
    const add = fakeFetch(201, { added: ["gen-1"], rejected: [] });
    const triage = fakeFetch(200, { triaged: 1, failed: 0 });

    expect(await createApiClient(add.fetchFn).addRequests([{ body: "Hola" }])).toEqual({
      added: ["gen-1"],
      rejected: [],
    });
    expect(await createApiClient(triage.fetchFn).triage({ retryFailed: true })).toEqual({ triaged: 1, failed: 0 });
    expect(add.calls[0]).toEqual({ url: "/api/tickets", method: "POST", body: { requests: [{ body: "Hola" }] } });
    expect(triage.calls[0]).toEqual({ url: "/api/triage", method: "POST", body: { retryFailed: true } });
  });

  it("turns an API error into an ApiError with status and code", async () => {
    const { fetchFn } = fakeFetch(409, { error: "not_reviewable" });

    const failure = createApiClient(fetchFn).accept("t-1");

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, code: "not_reviewable" });
  });

  it("reports a non-JSON error response as http_error", async () => {
    const { fetchFn } = fakeFetch(502, "<html>Bad gateway</html>", "text/html");

    await expect(createApiClient(fetchFn).listTickets()).rejects.toMatchObject({ status: 502, code: "http_error" });
  });
});
