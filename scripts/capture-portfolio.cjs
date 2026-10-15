// Optional documentation tooling, not a product entry point. All API responses are fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/images');
const port = Number(process.env.CAPTURE_PORT || 65048);
const origin = `http://127.0.0.1:${port}`;
const fixedNow = '2026-10-15T12:00:00.000Z';
const hour = 3600000;
const date = age => new Date(Date.parse(fixedNow) - age * hour).toISOString();
const pending = (id, age, category, body, summary, order, missing = []) => ({
  id, receivedAt: date(age), body, status: 'awaiting_review',
  suggestion: { requestId: id, category, summary, extracted: order ? { orderNumber: order } : {}, missingFields: missing },
});
const selected = pending('demo-return', 4, 'returns', 'Quiero devolver el pedido 64132.', 'Solicita devolver el pedido 64132; falta el motivo.', '64132', ['return_reason']);
const tickets = [
  selected,
  pending('demo-billing', 5, 'billing', 'Veo dos cargos acreditados del pedido 85210.', 'Consulta por dos cargos acreditados del pedido 85210.', '85210'),
  pending('demo-shipping', 7, 'shipping', 'El seguimiento del pedido 77340 no cambia.', 'Consulta por seguimiento sin novedades del pedido 77340.', '77340'),
  { id: 'demo-new', receivedAt: date(1), body: '¿Tienen local para retirar?', status: 'new' },
  { id: 'demo-related', receivedAt: date(28), body: 'El pedido 64132 llegó ayer. Quería consultar cómo devolverlo.', status: 'reviewed',
    review: { decision: 'manual', reviewedAt: date(27), final: { category: 'returns', extracted: { orderNumber: '64132' }, missingFields: ['return_reason'] } } },
];
let policies;
try {
  policies = JSON.parse(fs.readFileSync(path.join(root, 'knowledge/store-policies.json'), 'utf8'));
} catch (error) {
  console.error('Cannot read portfolio policy fixtures:', error.message);
  process.exit(1);
}
const returnsPolicy = policies.find(policy => policy.id === 'returns-window');
assert(returnsPolicy, 'returns-window passage exists');
// Authored display fixture, not a model generation or a model-quality measurement.
const draft = {
  sentences: [
    { text: 'Gracias por escribirnos sobre el pedido 64132.', sourceIds: [] },
    { text: 'Aceptamos devoluciones dentro de los 30 días desde la entrega, con el producto sin uso y con sus etiquetas.', sourceIds: ['returns-window'] },
    { text: '¿Podrías indicarnos el motivo de la devolución?', sourceIds: [] },
  ],
  sources: [returnsPolicy],
};
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: path.join(root, 'web'), stdio: 'pipe' });
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
let browser;
(async () => {
  try {
    const deadline = Date.now() + 10000;
    while (true) {
      if (server.exitCode !== null) throw Error('Preview exited: ' + logs);
      try { if ((await fetch(origin)).ok) break; } catch {}
      if (Date.now() > deadline) throw Error('Preview startup timed out: ' + logs);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const launch = { headless: true };
    if (process.env.CAPTURE_BROWSER) launch.executablePath = process.env.CAPTURE_BROWSER;
    browser = await chromium.launch(launch);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, timezoneId: 'UTC', locale: 'es-ES', deviceScaleFactor: 1 });
    await page.clock.install({ time: new Date(fixedNow) });
    const errors = []; const requests = [];
    page.on('pageerror', error => errors.push(error.message));
    // Block non-local networking, so a future unexpected provider call cannot spend tokens.
    await page.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin !== origin) throw Error('External request blocked: ' + url.origin);
      if (!url.pathname.startsWith('/api/')) return route.continue();
      requests.push(request.method() + ' ' + url.pathname);
      let body;
      if (request.method() === 'GET' && url.pathname === '/api/tickets') body = { tickets };
      else if (request.method() === 'POST' && url.pathname === '/api/tickets/demo-return/draft') body = { draft };
      else throw Error('Unexpected API request: ' + request.method() + ' ' + url.pathname);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(origin);
    await page.evaluate(() => {
      const label = document.createElement('p');
      label.textContent = 'ESCENARIO FICTICIO · Clasificación y borrador simulados · No mide calidad del modelo';
      label.style.cssText = 'margin:0;padding:12px;background:#312e81;color:white;font:600 14px system-ui;text-align:center';
      document.body.prepend(label);
    });
    const list = page.getByRole('region', { name: 'Solicitudes', exact: true });
    await list.getByText(selected.suggestion.summary, { exact: true }).click();
    assert.deepEqual(await list.locator('.ticket-id').allTextContents(), ['demo-billing', 'demo-shipping', 'demo-return', 'demo-new', 'demo-related']);
    await page.screenshot({ path: path.join(output, 'inbox-review.png'), fullPage: true });
    const draftPanel = page.getByRole('region', { name: 'Borrador de respuesta', exact: true });
    await draftPanel.getByRole('button', { name: 'Generar borrador', exact: true }).click();
    await draftPanel.getByRole('textbox', { name: 'Texto para enviar' }).waitFor();
    assert.equal(await draftPanel.getByRole('list', { name: 'Políticas citadas' }).getByRole('listitem').count(), 1);
    await page.screenshot({ path: path.join(output, 'reply-sources.png'), fullPage: true });
    // Demonstrate global related navigation even when the list is filtered to shipping.
    await page.getByLabel('Filtrar por categoría').selectOption('shipping');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Abrir solicitud demo-related', exact: true }).click();
    await page.getByRole('button', { name: 'Volver a solicitud demo-return', exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'related-request.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile overflow');
    await page.screenshot({ path: path.join(output, 'mobile-review.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, ['GET /api/tickets', 'POST /api/tickets/demo-return/draft']);
    fs.writeFileSync(path.join(output, 'capture.json'), JSON.stringify({
      schema: 'inboxops-portfolio-capture/v1', sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      fixedNow, timezone: 'UTC', scenario: 'Authored fictional ticket, triage, review and reply fixtures; all API calls intercepted',
      providerCalls: 0, requests, pageErrors: errors, mobileNoOverflow: true,
      screenshots: ['inbox-review.png', 'reply-sources.png', 'related-request.png', 'mobile-review.png'],
    }, null, 2) + '\n');
    console.log('PASS: 4 labelled screenshots, 2 mocked API calls, no provider calls, no page errors, mobile 390px without overflow.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { await browser?.close(); server.kill(); }
})();
