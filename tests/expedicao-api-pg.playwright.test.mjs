/**
 * Navegador (Playwright) × API Expedição + PostgreSQL isolado (PGlite).
 * Camada: API_HTTP + PGLITE — NÃO é SPA_LOCAL_BASE44; NÃO é mock in-memory.
 *
 * Uso: node --test tests/expedicao-api-pg.playwright.test.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const ART = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(ART, { recursive: true });

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACTOR = 'a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4';

function harnessHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Expedicao API+PG harness</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:1.5rem;background:#0f172a;color:#e2e8f0}
    button{margin:.25rem;padding:.5rem .9rem;cursor:pointer}
    #log{white-space:pre-wrap;background:#020617;padding:1rem;border-radius:8px;min-height:12rem}
    .ok{color:#4ade80}.err{color:#f87171}
  </style>
</head>
<body>
  <h1 data-testid="harness-title">Expedicao — API + PostgreSQL (PGlite)</h1>
  <p data-testid="harness-layer">LAYER=API_HTTP_PGLITE</p>
  <p>Proxy same-origin → BFF PGlite</p>
  <div>
    <button data-testid="btn-ciclo" id="btn-ciclo">Rodar ciclo</button>
    <button data-testid="btn-retry" id="btn-retry">Despacho repetido</button>
    <button data-testid="btn-rollback" id="btn-rollback">Meta migration 036</button>
    <button data-testid="btn-reload" id="btn-reload">Prova reload</button>
    <button data-testid="btn-rbac" id="btn-rbac">Prova RBAC</button>
    <button data-testid="btn-isolamento" id="btn-isolamento">Prova isolamento</button>
    <button data-testid="btn-erro" id="btn-erro">Prova erro 404</button>
  </div>
  <pre id="log" data-testid="harness-log"></pre>
  <script>
    const API = '';
    const H = {
      'content-type': 'application/json',
      'x-group-id': ${JSON.stringify(GROUP)},
      'x-empresa-id': ${JSON.stringify(EMPRESA)},
      'x-actor-id': ${JSON.stringify(ACTOR)},
    };
    const logEl = document.getElementById('log');
    const state = { entregaId: null, lastRomaneioId: null, results: [] };
    window.__EXP_HARNESS__ = state;

    function log(msg, ok) {
      const line = document.createElement('div');
      line.className = ok === false ? 'err' : ok ? 'ok' : '';
      line.textContent = msg;
      logEl.appendChild(line);
      state.results.push({ msg, ok });
    }

    async function api(path, init = {}) {
      const res = await fetch(API + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    }

    async function seedPronto(key) {
      const created = await api('/api/v1/entregas', {
        method: 'POST',
        body: JSON.stringify({
          cliente_nome: 'Browser PG',
          cidade: 'Campinas',
          itens: [{ descricao: 'Item PG', unidade_sigla: 'UN', quantidade_pedida: '10' }],
          idempotency_key: 'br-ent-' + key,
        }),
      });
      if (created.status !== 201) throw new Error('create ' + created.status + ' ' + JSON.stringify(created.body));
      const id = created.body.data.id;
      const sep = await api('/api/v1/entregas/' + id + '/separacao', {
        method: 'POST',
        body: JSON.stringify({
          confirmed: true,
          checklist: {
            conferiu_quantidade: true, conferiu_qualidade: true, conferiu_embalagem: true,
            conferiu_etiquetas: true, conferiu_documentos: true,
          },
          itens: [{ descricao: 'Item PG', unidade_sigla: 'UN', quantidade_pedida: '10', quantidade_separada: '10' }],
          idempotency_key: 'br-sep-' + key,
        }),
      });
      if (sep.status !== 201) throw new Error('sep ' + sep.status + ' ' + JSON.stringify(sep.body));
      return id;
    }

    document.getElementById('btn-ciclo').onclick = async () => {
      try {
        logEl.textContent = '';
        state.results = [];
        const id = await seedPronto('ciclo-' + Date.now());
        state.entregaId = id;
        log('entrega ' + id, true);
        const rom = await api('/api/v1/romaneios', {
          method: 'POST',
          body: JSON.stringify({
            confirmed: true, motorista_nome: 'Mot Browser', veiculo: 'V', placa: 'BRW1A11',
            checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
            entregas_ids: [id], despachar: true, idempotency_key: 'br-rom-' + id,
          }),
        });
        if (rom.status !== 201) throw new Error('rom ' + rom.status + ' ' + JSON.stringify(rom.body));
        state.lastRomaneioId = rom.body.data.romaneio.id;
        log('despacho ' + rom.body.data.entregas[0].status + ' side=' + rom.body.data.estoqueSideEffect, true);
        const parcial = await api('/api/v1/entregas/' + id + '/registrar', {
          method: 'POST',
          body: JSON.stringify({
            confirmed: true, modo: 'parcial', quantidade_entregue: '4',
            comprovante: { nome_recebedor: 'R', documento_recebedor: '1' },
            idempotency_key: 'br-par-' + id,
          }),
        });
        if (parcial.status !== 200) throw new Error('parcial ' + parcial.status);
        log('parcial ' + parcial.body.data.entrega.status, true);
        const total = await api('/api/v1/entregas/' + id + '/registrar', {
          method: 'POST',
          body: JSON.stringify({
            confirmed: true, modo: 'total',
            comprovante: { nome_recebedor: 'R', documento_recebedor: '1', foto_comprovante: 'data:image/png;base64,xx' },
            idempotency_key: 'br-tot-' + id,
          }),
        });
        if (total.status !== 200) throw new Error('total ' + total.status);
        log('total ' + total.body.data.entrega.status, true);
        state.cicloOk = true;
        log('CICLO_OK', true);
      } catch (e) {
        state.cicloOk = false;
        log(String(e && e.message || e), false);
      }
    };

    document.getElementById('btn-retry').onclick = async () => {
      try {
        const id = state.entregaId || await seedPronto('retry-' + Date.now());
        state.entregaId = id;
        const key = 'br-retry-' + id;
        const payload = {
          confirmed: true, motorista_nome: 'Mot Retry', veiculo: 'V', placa: 'RTY1A11',
          checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
          entregas_ids: [id], despachar: true, idempotency_key: key,
        };
        const a = await api('/api/v1/romaneios', { method: 'POST', body: JSON.stringify(payload) });
        const b = await api('/api/v1/romaneios', { method: 'POST', body: JSON.stringify(payload) });
        if (a.status !== 201 || b.status !== 201) throw new Error('retry status ' + a.status + '/' + b.status);
        if (!b.body.data.reused) throw new Error('retry not reused');
        if (a.body.data.romaneio.id !== b.body.data.romaneio.id) throw new Error('retry id mismatch');
        state.retryOk = true;
        log('RETRY_OK reused=' + b.body.data.reused, true);
      } catch (e) {
        state.retryOk = false;
        log(String(e && e.message || e), false);
      }
    };

    document.getElementById('btn-rollback').onclick = async () => {
      try {
        const meta = await api('/api/v1/meta');
        if (!meta.body.expedicao || meta.body.expedicao.pedidoEstoqueSideEffects !== 'reserved') {
          throw new Error('meta side-effects ' + JSON.stringify(meta.body.expedicao));
        }
        if (meta.body.expedicao.migration !== '036_expedicao_entregas_romaneios.sql') {
          throw new Error('meta migration ' + meta.body.expedicao.migration);
        }
        state.rollbackMetaOk = true;
        log('ROLLBACK_META_OK migration=036 side=reserved', true);
      } catch (e) {
        state.rollbackMetaOk = false;
        log(String(e && e.message || e), false);
      }
    };

    document.getElementById('btn-reload').onclick = async () => {
      try {
        const id = state.entregaId || await seedPronto('reload-' + Date.now());
        state.entregaId = id;
        const before = await api('/api/v1/entregas/' + id);
        if (before.status !== 200) throw new Error('get before ' + before.status);
        sessionStorage.setItem('exp_reload_id', id);
        sessionStorage.setItem('exp_reload_status', before.body.data.status);
        const afterId = sessionStorage.getItem('exp_reload_id');
        const after = await api('/api/v1/entregas/' + afterId);
        if (after.status !== 200) throw new Error('get after ' + after.status);
        if (after.body.data.status !== sessionStorage.getItem('exp_reload_status')) {
          throw new Error('status mudou apos reload simulado');
        }
        state.reloadOk = true;
        log('RELOAD_OK status=' + after.body.data.status, true);
      } catch (e) {
        state.reloadOk = false;
        log(String(e && e.message || e), false);
      }
    };

    document.getElementById('btn-rbac').onclick = async () => {
      try {
        const denied = await api('/api/v1/entregas', {
          headers: { 'x-actor-id': 'b4b4b4b4-bbbb-4bbb-8bbb-b4b4b4b4b4b4' },
        });
        if (denied.status !== 403) throw new Error('esperado 403, got ' + denied.status);
        state.rbacOk = true;
        log('RBAC_OK code=' + (denied.body.error && denied.body.error.code), true);
      } catch (e) {
        state.rbacOk = false;
        log(String(e && e.message || e), false);
      }
    };

    document.getElementById('btn-isolamento').onclick = async () => {
      try {
        const id = state.entregaId || await seedPronto('iso-' + Date.now());
        state.entregaId = id;
        const cross = await api('/api/v1/entregas/' + id, {
          headers: { 'x-empresa-id': 'c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2' },
        });
        if (cross.status !== 404) throw new Error('esperado 404 cross-empresa, got ' + cross.status);
        state.isolamentoOk = true;
        log('ISOLAMENTO_OK', true);
      } catch (e) {
        state.isolamentoOk = false;
        log(String(e && e.message || e), false);
      }
    };

    document.getElementById('btn-erro').onclick = async () => {
      try {
        const missing = await api('/api/v1/entregas/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
        if (missing.status !== 404) throw new Error('esperado 404, got ' + missing.status);
        const code = missing.body.error && missing.body.error.code;
        if (!code) throw new Error('erro sem code');
        state.erroOk = true;
        log('ERRO_OK code=' + code, true);
      } catch (e) {
        state.erroOk = false;
        log(String(e && e.message || e), false);
      }
    };
  </script>
</body>
</html>`;
}

async function startProxy(bffPort) {
  const html = harnessHtml();
  const server = createServer(async (req, res) => {
    const url = req.url || '/';
    if (url.startsWith('/api/') || url === '/health' || url === '/ready' || url.startsWith('/api')) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      try {
        const upstream = await fetch(`http://127.0.0.1:${bffPort}${url}`, {
          method: req.method,
          headers: {
            'content-type': req.headers['content-type'] || 'application/json',
            'x-group-id': req.headers['x-group-id'] || '',
            'x-empresa-id': req.headers['x-empresa-id'] || '',
            'x-actor-id': req.headers['x-actor-id'] || '',
          },
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        });
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') || 'application/json',
        });
        res.end(buf);
      } catch (err) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: String(err) } }));
      }
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  return { server, port: addr.port };
}

async function startBff() {
  const serverDir = path.join(repoRoot, 'server');
  const harness = path.join(serverDir, 'scripts/expedicao-pglite-bff-harness.ts');
  const child = spawn(process.execPath, ['--import', 'tsx', harness], {
    cwd: serverDir,
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('BFF harness timeout\n' + buf)), 120_000);
    const onData = (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/EXPEDICAO_PGLITE_BFF_PORT=(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('BFF exited ' + code + '\n' + buf));
    });
  });
  return { child, port, log: buf };
}

test('Playwright: navegador contra API+PGlite (ciclo, retry, meta 036)', async () => {
  let bff;
  let proxy;
  let browser;
  try {
    bff = await startBff();
    proxy = await startProxy(bff.port);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${proxy.port}/`, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.getByTestId('harness-layer').innerText(), 'LAYER=API_HTTP_PGLITE');

    await page.getByTestId('btn-ciclo').click();
    await page.waitForFunction(() => window.__EXP_HARNESS__?.cicloOk === true || window.__EXP_HARNESS__?.cicloOk === false, null, { timeout: 60_000 });
    const ciclo = await page.evaluate(() => window.__EXP_HARNESS__);
    assert.equal(ciclo.cicloOk, true, JSON.stringify(ciclo.results));

    await page.getByTestId('btn-retry').click();
    await page.waitForFunction(() => window.__EXP_HARNESS__?.retryOk === true || window.__EXP_HARNESS__?.retryOk === false, null, { timeout: 60_000 });
    const retry = await page.evaluate(() => window.__EXP_HARNESS__);
    assert.equal(retry.retryOk, true, JSON.stringify(retry.results));

    await page.getByTestId('btn-rollback').click();
    await page.waitForFunction(() => window.__EXP_HARNESS__?.rollbackMetaOk === true || window.__EXP_HARNESS__?.rollbackMetaOk === false, null, { timeout: 30_000 });
    const meta = await page.evaluate(() => window.__EXP_HARNESS__);
    assert.equal(meta.rollbackMetaOk, true, JSON.stringify(meta.results));

    await page.getByTestId('btn-reload').click();
    await page.waitForFunction(() => window.__EXP_HARNESS__?.reloadOk === true || window.__EXP_HARNESS__?.reloadOk === false, null, { timeout: 30_000 });
    assert.equal((await page.evaluate(() => window.__EXP_HARNESS__)).reloadOk, true);

    await page.getByTestId('btn-rbac').click();
    await page.waitForFunction(() => window.__EXP_HARNESS__?.rbacOk === true || window.__EXP_HARNESS__?.rbacOk === false, null, { timeout: 30_000 });
    assert.equal((await page.evaluate(() => window.__EXP_HARNESS__)).rbacOk, true);

    await page.getByTestId('btn-isolamento').click();
    await page.waitForFunction(() => window.__EXP_HARNESS__?.isolamentoOk === true || window.__EXP_HARNESS__?.isolamentoOk === false, null, { timeout: 30_000 });
    assert.equal((await page.evaluate(() => window.__EXP_HARNESS__)).isolamentoOk, true);

    await page.getByTestId('btn-erro').click();
    await page.waitForFunction(() => window.__EXP_HARNESS__?.erroOk === true || window.__EXP_HARNESS__?.erroOk === false, null, { timeout: 30_000 });
    assert.equal((await page.evaluate(() => window.__EXP_HARNESS__)).erroOk, true);

    await page.screenshot({ path: path.join(ART, 'expedicao-api-pg-harness.png'), fullPage: true });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (proxy) await new Promise((r) => proxy.server.close(() => r()));
    if (bff?.child) {
      bff.child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      try { bff.child.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
});
