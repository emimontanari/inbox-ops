// Types come straight from the backend domain: a contract change breaks this build, not production.
import type { AddRequestsResult, TriageOutcome } from "../../src/application/inbox.js";
import type { ReplyDraft } from "../../src/domain/reply-draft.js";
import type { CorrectionInput, ReviewedTicket, Ticket } from "../../src/domain/ticket.js";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API request failed with ${status}: ${code}`);
    this.name = "ApiError";
  }
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ApiClient = ReturnType<typeof createApiClient>;

// The client only ever calls this app's own API: an allowlist enforced by type and at runtime.
type ApiPath = `/api/${string}`;

export function createApiClient(fetchFn: FetchFn = (input, init) => fetch(input, init)) {
  async function request<T>(path: ApiPath, init?: { method: "POST"; body?: unknown }): Promise<T> {
    if (!path.startsWith("/api/") || path.includes("//")) throw new Error(`Refusing to call ${path}`);
    const response = await fetchFn(path, {
      method: init?.method ?? "GET",
      ...(init?.body !== undefined && {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(init.body),
      }),
    });
    if (!response.ok) throw new ApiError(response.status, await errorCode(response));
    return (await response.json()) as T;
  }

  const ticketPath = (id: string, action: "accept" | "correct" | "draft"): ApiPath =>
    `/api/tickets/${encodeURIComponent(id)}/${action}`;

  return {
    async listTickets(): Promise<Ticket[]> {
      return (await request<{ tickets: Ticket[] }>("/api/tickets")).tickets;
    },
    addRequests(requests: Array<{ id?: string; body: string; receivedAt?: string }>): Promise<AddRequestsResult> {
      return request("/api/tickets", { method: "POST", body: { requests } });
    },
    triage(options: { retryFailed?: boolean } = {}): Promise<TriageOutcome> {
      return request("/api/triage", { method: "POST", body: options });
    },
    async accept(id: string): Promise<ReviewedTicket> {
      return (await request<{ ticket: ReviewedTicket }>(ticketPath(id, "accept"), { method: "POST" })).ticket;
    },
    async correct(id: string, input: CorrectionInput): Promise<ReviewedTicket> {
      const path = ticketPath(id, "correct");
      return (await request<{ ticket: ReviewedTicket }>(path, { method: "POST", body: input })).ticket;
    },
    // Spends provider tokens: call only on an explicit user action.
    async draftReply(id: string): Promise<ReplyDraft> {
      return (await request<{ draft: ReplyDraft }>(ticketPath(id, "draft"), { method: "POST" })).draft;
    },
  };
}

// The API answers errors as { error: code }; anything else (a proxy page, a crash) is http_error.
async function errorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // Not JSON: fall through to the generic code.
  }
  return "http_error";
}
