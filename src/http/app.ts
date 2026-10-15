import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { DraftReply } from "../application/draft-reply.js";
import type { Inbox } from "../application/inbox.js";
import type { ExtractedData } from "../domain/triage-suggestion.js";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_REQUESTS_PER_BATCH = 200;

// HTTP input is untrusted: shapes are validated here, business rules stay in the domain.
const addRequestsSchema = z.object({
  requests: z
    .array(z.object({ id: z.string().min(1).max(100).optional(), body: z.string(), receivedAt: z.string().optional() }))
    .min(1)
    .max(MAX_REQUESTS_PER_BATCH),
});

const triageSchema = z.object({ retryFailed: z.boolean().optional() });

const correctionSchema = z.object({
  category: z.string(),
  extracted: z.object({
    orderNumber: z.string().max(100).optional(),
    returnReason: z.string().max(500).optional(),
  }),
});

const REVIEW_ERROR_STATUS = {
  not_found: 404,
  not_reviewable: 409,
  invalid_category: 400,
} as const;

// The provider failing is a gateway problem, not a client error.
const DRAFT_ERROR_STATUS = {
  not_found: 404,
  not_draftable: 409,
  drafter_unavailable: 503,
  drafter_invalid_output: 502,
} as const;

type ReadBody<T> = { ok: true; value: T } | { ok: false; response: Response };

export function createApp(deps: {
  inbox: Inbox;
  draftReply: DraftReply;
  generateId: () => string;
  logError?: (error: unknown) => void;
  // Folder with the built web app (web/dist). Without it only the API is served.
  webRoot?: string;
}): Hono {
  const { inbox } = deps;
  const app = new Hono();

  app.use("/api/*", bodyLimit({ maxSize: MAX_BODY_BYTES }));

  app.onError((error, c) => {
    (deps.logError ?? console.error)(error);
    return c.json({ error: "internal_error" }, 500);
  });

  app.get("/api/tickets", async (c) => c.json({ tickets: await inbox.list() }));

  app.post("/api/tickets", async (c) => {
    const body = await readBody(c, addRequestsSchema);
    if (!body.ok) return body.response;

    const requests = body.value.requests.map((r) => ({ id: r.id ?? deps.generateId(), body: r.body, ...(r.receivedAt !== undefined && { receivedAt: r.receivedAt }) }));
    return c.json(await inbox.addRequests(requests), 201);
  });

  app.post("/api/triage", async (c) => {
    const body = await readBody(c, triageSchema);
    if (!body.ok) return body.response;
    return c.json(await inbox.triagePending({ retryFailed: body.value.retryFailed === true }));
  });

  app.post("/api/tickets/:id/accept", async (c) => {
    const result = await inbox.accept(c.req.param("id"));
    return result.ok
      ? c.json({ ticket: result.value })
      : c.json({ error: result.error }, REVIEW_ERROR_STATUS[result.error]);
  });

  app.post("/api/tickets/:id/correct", async (c) => {
    const body = await readBody(c, correctionSchema);
    if (!body.ok) return body.response;

    const result = await inbox.correct(c.req.param("id"), {
      category: body.value.category,
      extracted: toExtractedData(body.value.extracted),
    });
    return result.ok
      ? c.json({ ticket: result.value })
      : c.json({ error: result.error }, REVIEW_ERROR_STATUS[result.error]);
  });

  // Spends provider tokens; the draft is returned, never stored or sent.
  app.post("/api/tickets/:id/draft", async (c) => {
    const result = await deps.draftReply(c.req.param("id"));
    return result.ok
      ? c.json({ draft: result.value })
      : c.json({ error: result.error }, DRAFT_ERROR_STATUS[result.error]);
  });

  // A mistyped API path must fail as an API error, never return the web app's HTML.
  app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

  if (deps.webRoot !== undefined) {
    app.use("/*", serveStatic({ root: deps.webRoot }));
    // Single-page app: unknown non-API paths load index.html and the client decides what to show.
    app.get("*", serveStatic({ root: deps.webRoot, path: "index.html" }));
  }

  return app;
}

// An empty body counts as {} so endpoints with only optional fields can be called without one.
async function readBody<T>(c: Context, schema: z.ZodType<T>): Promise<ReadBody<T>> {
  const text = await c.req.text();
  let data: unknown;
  try {
    data = text.trim() === "" ? {} : JSON.parse(text);
  } catch {
    return { ok: false, response: c.json({ error: "invalid_body", details: "Body is not valid JSON" }, 400) };
  }

  const parsed = schema.safeParse(data);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, response: c.json({ error: "invalid_body", details: z.prettifyError(parsed.error) }, 400) };
}

// Form fields arrive as optional strings; blank values mean "not provided".
function toExtractedData(input: { orderNumber?: string | undefined; returnReason?: string | undefined }): ExtractedData {
  const orderNumber = input.orderNumber?.trim();
  const returnReason = input.returnReason?.trim();
  return {
    ...(orderNumber && { orderNumber }),
    ...(returnReason && { returnReason }),
  };
}
