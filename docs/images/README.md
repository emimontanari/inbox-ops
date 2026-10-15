# Screenshot provenance

These screenshots show the real React UI with **authored fictional API responses**, not a live model run. Ticket messages, classification suggestions, review decisions and the reply draft are display fixtures in [`scripts/capture-portfolio.cjs`](../../scripts/capture-portfolio.cjs). The quoted return policy is loaded from the shipped knowledge file.

Every image includes a visible simulation label. Do not use these images as model-quality evidence. Real model measurements are linked from the [technical case study](../case-study.md).

| Image | What it illustrates |
| --- | --- |
| `inbox-review.png` | SLA order, human review and missing return reason |
| `reply-sources.png` | Per-sentence sources, quoted policy and editable reply |
| `related-request.png` | A related reviewed ticket opened outside list filters, with a return link |
| `mobile-review.png` | The same workspace at 390 px |

The fixed browser time is `2026-10-15T12:00:00Z`, timezone UTC. Relative ticket ages produce overdue, due-soon and on-time examples reproducibly. This is a staged scenario, not customer data. [`capture.json`](capture.json) records source revision, mocked calls and browser checks.

## Reproduce (optional documentation tooling)

From the repository root, after installing the app dependencies:

```bash
# Optional local browser tooling; does not update package.json or the lockfile.
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run build:web
node scripts/capture-portfolio.cjs
```

The script launches a local Vite preview on `127.0.0.1:65048`, intercepts every `/api/` request, blocks external requests, captures four images and closes its browser and preview. It never starts the backend, reads `.env`, accesses SQLite or calls Groq. No API key is needed. It asserts exactly one fixture list request and one fixture draft request.

If Playwright is installed elsewhere, set `PLAYWRIGHT_MODULE_PATH` to its module path. To use an existing Chromium/Chrome binary, set `CAPTURE_BROWSER` to its absolute executable path instead of installing Chromium. Use `CAPTURE_PORT` to choose another free port. Small rendering differences across browser or OS versions are expected.
