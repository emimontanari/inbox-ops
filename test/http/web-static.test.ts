import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InMemoryTicketRepository } from "../../src/adapters/in-memory-ticket-repository.js";
import { createInbox } from "../../src/application/inbox.js";
import { createTriageRequest } from "../../src/application/triage-request.js";
import { createApp } from "../../src/http/app.js";
import { FakeClassifier } from "../support/fake-classifier.js";

const INDEX_HTML = '<!doctype html><div id="root"></div>';

function createTestApp(webRoot?: string) {
  const inbox = createInbox({
    repository: new InMemoryTicketRepository(),
    triageRequest: createTriageRequest({ classifier: FakeClassifier.returning({ ok: false, error: "unavailable" }) }),
    now: () => "2026-10-13T10:00:00.000Z",
  });
  return createApp({ inbox, generateId: () => "x", ...(webRoot !== undefined && { webRoot }) });
}

describe("serving the web app", () => {
  let webRoot: string;

  beforeAll(() => {
    webRoot = mkdtempSync(join(tmpdir(), "inbox-ops-web-"));
    mkdirSync(join(webRoot, "assets"));
    writeFileSync(join(webRoot, "index.html"), INDEX_HTML);
    writeFileSync(join(webRoot, "assets", "app.js"), "console.log('app')");
  });

  afterAll(() => rmSync(webRoot, { recursive: true, force: true }));

  it("serves index.html at the root", async () => {
    const response = await createTestApp(webRoot).request("/");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(INDEX_HTML);
  });

  it("serves built assets", async () => {
    const response = await createTestApp(webRoot).request("/assets/app.js");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("console.log('app')");
  });

  it("falls back to index.html for client-side routes", async () => {
    const response = await createTestApp(webRoot).request("/tickets/t-1");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(INDEX_HTML);
  });

  it("answers an unknown API route with a JSON 404, never the web app", async () => {
    const response = await createTestApp(webRoot).request("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("keeps the API working next to the web app", async () => {
    const response = await createTestApp(webRoot).request("/api/tickets");

    expect(await response.json()).toEqual({ tickets: [] });
  });

  it("serves only the API when no web root is configured", async () => {
    const response = await createTestApp().request("/");

    expect(response.status).toBe(404);
  });
});
