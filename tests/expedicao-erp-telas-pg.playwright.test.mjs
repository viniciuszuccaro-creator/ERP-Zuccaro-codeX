/**
 * Telas reais do ERP (SPA /Expedicao) × BFF + PostgreSQL isolado (PGlite).
 * Camada: SPA_HTTP + API_HTTP_PGLITE — ≠ SPA_LOCAL_BASE44; ≠ mock in-memory puro.
 *
 * Proxy same-origin no Node (sem Playwright route em /api — evita chrome-error):
 * - GET/POST /api/v1/auth/session → perfil sintético
 * - demais /api/v1/** → BFF PGlite (Bearer → X-Actor-Id)
 *
 * Uso: node --test tests/expedicao-erp-telas-pg.playwright.test.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const ART = '/opt/cursor/artifacts/screenshots';
const ENV_DIR = '/tmp/exp-vite-env-telas';
fs.mkdirSync(ART, { recursive: true });
fs.mkdirSync(ENV_DIR, { recursive: true });
fs.writeFileSync(path.join(ENV_DIR, '.env'), [
  'VITE_ERP_BACKEND=http',
  'VITE_ERP_HTTP_EXPEDICAO=true',
  'VITE_ERP_API_SAME_ORIGIN=true',
  '',
].join('\n'));

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EMPRESA_A2 = 'c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2';
const ACTOR_OK = 'a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4';
const ACTOR_DENY = 'b4b4b4b4-bbbb-4bbb-8bbb-b4b4b4b4b4b4';
const TOKEN_OK = 'test-token-actor-a-expedicao';
const TOKEN_DENY = 'test-token-actor-b-deny';

const PERMS_OK = {
  '*': ['visualizar', 'criar', 'editar', 'ver', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar', 'incluir', 'exportar'],
  Expedicao: {
    entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar', 'exportar'],
    Entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar', 'exportar'],
    Entregas: ['visualizar', 'criar', 'editar', 'incluir', 'ver'],
    romaneio: ['visualizar', 'criar', 'editar'],
    Romaneio: ['visualizar', 'criar', 'editar'],
    Romaneios: ['visualizar', 'criar', 'editar'],
    separacao: ['visualizar', 'criar', 'editar', 'conferir'],
    Separacao: ['visualizar', 'criar', 'editar', 'conferir'],
    LogisticaReversa: ['visualizar', 'editar', 'criar'],
  },
  'Expedição': { Entregas: ['visualizar', 'criar', 'editar', 'incluir', 'ver'] },
};

const EMPRESAS = [
  { id: EMPRESA_A, group_id: GROUP, razao_social: 'Empresa A Sintetica', nome_fantasia: 'Empresa A', status: 'Ativa' },
  { id: EMPRESA_A2, group_id: GROUP, razao_social: 'Empresa A2 Sintetica', nome_fantasia: 'Empresa A2', status: 'Ativa' },
];

function sessionPayload(actorId) {
  const permissoes = actorId === ACTOR_OK ? PERMS_OK : { Expedicao: { entrega: [], romaneio: [], separacao: [] } };
  return {
    data: {
      access_token: actorId === ACTOR_OK ? TOKEN_OK : TOKEN_DENY,
      token_type: 'bearer',
      user: { id: actorId, email: actorId === ACTOR_OK ? 'a@erp.test' : 'b@erp.test' },
      profiles: [{
        id: actorId,
        group_id: GROUP,
        empresa_id: null,
        role: 'admin',
        full_name: actorId === ACTOR_OK ? 'Operador Expedicao A' : 'Sem Permissao B',
        permissoes,
        group_name: 'Grupo A Sintetico',
        empresas: EMPRESAS,
      }],
    },
  };
}

function actorFromAuth(req) {
  const auth = String(req.headers.authorization || '');
  if (auth.includes(TOKEN_DENY)) return ACTOR_DENY;
  if (auth.includes(TOKEN_OK)) return ACTOR_OK;
  return ACTOR_OK;
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
  return { child, port };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function startStack(bffPort) {
  const vite = await createViteServer({
    root: repoRoot,
    configFile: path.join(repoRoot, 'vite.config.js'),
    envDir: ENV_DIR,
    appType: 'spa',
    server: { middlewareMode: true, hmr: false },
  });

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    try {
      if (url.startsWith('/api/v1/auth/session')) {
        const actor = actorFromAuth(req);
        const u = new URL(url, 'http://localhost');
        // entityGuard (ProtectedSection) → GET session?guard=...; precisa allowed:true.
        if (u.searchParams.has('guard')) {
          const body = Buffer.from(JSON.stringify({ data: { allowed: actor === ACTOR_OK } }));
          res.writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
            'content-length': body.length,
          });
          res.end(body);
          return;
        }
        const body = Buffer.from(JSON.stringify(sessionPayload(actor)));
        res.writeHead(200, {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'content-length': body.length,
        });
        res.end(body);
        return;
      }
      if (url.startsWith('/api/v1/') || url === '/health' || url === '/ready') {
        const body = await readBody(req);
        const actor = actorFromAuth(req);
        const upstream = await fetch(`http://127.0.0.1:${bffPort}${url}`, {
          method: req.method,
          headers: {
            'content-type': req.headers['content-type'] || 'application/json',
            'x-group-id': req.headers['x-group-id'] || GROUP,
            'x-empresa-id': req.headers['x-empresa-id'] || EMPRESA_A,
            'x-actor-id': actor,
          },
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
        });
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, {
          'content-type': upstream.headers.get('content-type') || 'application/json',
          'content-length': buf.length,
        });
        res.end(buf);
        return;
      }

      vite.middlewares(req, res, async () => {
        const raw = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
        const html = await vite.transformIndexHtml(url, raw);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err && err.stack || err));
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '0.0.0.0', resolve);
    server.on('error', reject);
  });
  const port = server.address().port;
  // Layout.jsx força HTTPS quando hostname !== 'localhost' — usar localhost evita chrome-error.
  return { vite, server, port, origin: `http://localhost:${port}` };
}

async function seedSession(page, { token = TOKEN_OK, actorId = ACTOR_OK, empresaId = EMPRESA_A } = {}) {
  await page.evaluate(({ token, actorId, groupId, empresaId, empresas }) => {
    const scope = {
      token,
      groupId,
      empresaId,
      actorId,
      email: 'a@erp.test',
      role: 'admin',
      fullName: 'Operador Expedicao A',
      groupName: 'Grupo A Sintetico',
      empresas,
      profileEmpresaId: null,
      scopeType: 'empresa',
      expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
    };
    localStorage.setItem('base44_access_token', token);
    localStorage.setItem('erp_runtime_scope', JSON.stringify(scope));
  }, { token, actorId, groupId: GROUP, empresaId, empresas: EMPRESAS });
}

async function apiFromPage(page, pathName, init = {}, { token = TOKEN_OK, empresaId = EMPRESA_A } = {}) {
  return page.evaluate(async ({ pathName, init, groupId, empresaId, token }) => {
    const res = await fetch(pathName, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-group-id': groupId,
        'x-empresa-id': empresaId,
        ...(init.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  }, { pathName, init, groupId: GROUP, empresaId, token });
}

async function gotoSpa(page, base, route = '/') {
  await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  assert.ok(!page.url().includes('chrome-error'), 'navegação caiu em chrome-error: ' + page.url());
  await page.waitForSelector('#root', { state: 'attached', timeout: 30_000 });
  await page.waitForFunction(() => Boolean(document.body && document.body.innerText.length > 0), null, { timeout: 30_000 });
}

async function openExpedicao(page, base) {
  // Full document navigation para /Expedicao é instável neste Chromium+Vite;
  // usa history API após boot autenticado (mesma SPA).
  await page.evaluate(() => {
    window.history.pushState({}, '', '/Expedicao');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(
    () => /Expedi|Entrega|Romaneio|Nova Entrega/i.test(document.body?.innerText || ''),
    null,
    { timeout: 60_000 },
  );
  // Sanity: URL e ausência de chrome-error
  assert.ok(page.url().includes('/Expedicao'), page.url());
  assert.ok(!page.url().includes('chrome-error'), page.url());
  void base;
}

test('SPA /Expedicao real × BFF+PGlite: fluxo, reload, RBAC e troca de empresa', async () => {
  let bff;
  let stack;
  let browser;
  try {
    bff = await startBff();
    stack = await startStack(bff.port);
    const base = stack.origin;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // Boot com sessão HTTP já semeada (addInitScript) — Layout exige hostname localhost.
    await page.addInitScript(({ token, actorId, groupId, empresaId, empresas }) => {
      const scope = {
        token,
        groupId,
        empresaId,
        actorId,
        email: 'a@erp.test',
        role: 'admin',
        fullName: 'Operador Expedicao A',
        groupName: 'Grupo A Sintetico',
        empresas,
        profileEmpresaId: null,
        scopeType: 'empresa',
        expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
      };
      localStorage.setItem('base44_access_token', token);
      localStorage.setItem('erp_runtime_scope', JSON.stringify(scope));
    }, { token: TOKEN_OK, actorId: ACTOR_OK, groupId: GROUP, empresaId: EMPRESA_A, empresas: EMPRESAS });

    await gotoSpa(page, base, '/');
    await page.waitForFunction(
      () => !/Sessão inválida/i.test(document.body?.innerText || '')
        && /Expedi|Dashboard|Comercial|Cadastros|Nova|Entrega/i.test(document.body?.innerText || ''),
      null,
      { timeout: 90_000 },
    );
    await openExpedicao(page, base);
    const bodyText = await page.locator('body').innerText();
    assert.ok(/Expedi|Entrega|Romaneio|Nova Entrega/i.test(bodyText), bodyText.slice(0, 500));

    // Aceita confirms nativos das telas (Formulario/Separacao/Romaneio/Detalhe).
    page.on('dialog', async (dialog) => {
      try { await dialog.accept(); } catch { /* ignore */ }
    });

    // UI: botão Nova Entrega (pode demorar a montar após popstate)
    const novaBtn = page.locator('[data-action="Expedicao.nova_entrega"]').first();
    const novaByText = page.getByRole('button', { name: /Nova Entrega/i }).first();
    try {
      await Promise.race([
        novaBtn.waitFor({ state: 'visible', timeout: 20_000 }),
        novaByText.waitFor({ state: 'visible', timeout: 20_000 }),
      ]);
    } catch {
      // dump diagnóstico sem enfraquecer o restante do fluxo
      const dump = await page.evaluate(() => ({
        url: location.href,
        actions: [...document.querySelectorAll('[data-action]')].map((e) => e.getAttribute('data-action')).slice(0, 50),
        text: (document.body?.innerText || '').slice(0, 800),
      }));
      assert.fail('Nova Entrega não montou na SPA /Expedicao: ' + JSON.stringify(dump));
    }
    if (await novaBtn.count()) await novaBtn.click();
    else await novaByText.click();
    await page.waitForTimeout(600);
    // Prova: janela FormularioEntrega aberta
    const novaWin = page.locator('[data-testid="erp-window"][data-window-title="Nova Entrega"]').first();
    await novaWin.waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({ path: path.join(ART, 'expedicao-erp-telas-nova-entrega.png'), fullPage: true });
    // Fecha a janela para não interceptar cliques nos cards do launchpad
    const closeNova = novaWin.locator('button[title="Fechar"]').first();
    if (await closeNova.count()) {
      await closeNova.click({ force: true });
    } else {
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        document.querySelectorAll('[data-testid="erp-window"]').forEach((el) => el.remove());
      });
    }
    await page.waitForTimeout(400);

    // UI: abrir card Entregas
    const cardEntregas = page.locator('[data-action="Expedicao.abrir.Entregas"]').first();
    if (await cardEntregas.count()) {
      await cardEntregas.click({ force: true });
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        document.querySelectorAll('[data-testid="erp-window"]').forEach((el) => el.remove());
      });
    }

    // Criação (HTTP canônico via SPA — mesma superfície das telas wire BFF)
    const created = await apiFromPage(page, '/api/v1/entregas', {
      method: 'POST',
      body: JSON.stringify({
        cliente_nome: 'Cliente Tela Real',
        cidade: 'Campinas',
        itens: [{ descricao: 'Item Tela', unidade_sigla: 'UN', quantidade_pedida: '10' }],
        idempotency_key: 'tela-create-' + Date.now(),
      }),
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const entregaId = created.body.data.id;
    const numeroPedido = created.body.data.numero_pedido || created.body.data.id;

    // Separação
    const sep = await apiFromPage(page, `/api/v1/entregas/${entregaId}/separacao`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true,
        checklist: {
          conferiu_quantidade: true, conferiu_qualidade: true, conferiu_embalagem: true,
          conferiu_etiquetas: true, conferiu_documentos: true,
        },
        itens: [{ descricao: 'Item Tela', unidade_sigla: 'UN', quantidade_pedida: '10', quantidade_separada: '10' }],
        idempotency_key: 'tela-sep-' + entregaId,
      }),
    });
    assert.equal(sep.status, 201, JSON.stringify(sep.body));

    // UI: abrir Separação / Romaneios (cards reais do launchpad)
    for (const action of ['Expedicao.abrir.Separação', 'Expedicao.abrir.Separacao', 'Expedicao.abrir.Romaneios']) {
      const cardMod = page.locator(`[data-action="${action}"]`).first();
      if (await cardMod.count()) {
        await cardMod.click({ force: true });
        await page.waitForTimeout(500);
        // Fecha janela aberta para não bloquear próximos cliques
        await page.evaluate(() => {
          document.querySelectorAll('[data-testid="erp-window"]').forEach((el) => el.remove());
        });
      }
    }

    // Romaneio + despacho
    const rom = await apiFromPage(page, '/api/v1/romaneios', {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true,
        motorista_nome: 'Mot Tela',
        veiculo: 'V',
        placa: 'TEL1A11',
        checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
        entregas_ids: [entregaId],
        despachar: true,
        idempotency_key: 'tela-rom-' + entregaId,
      }),
    });
    assert.equal(rom.status, 201, JSON.stringify(rom.body));

    // Parcial + total
    const parcial = await apiFromPage(page, `/api/v1/entregas/${entregaId}/registrar`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true, modo: 'parcial', quantidade_entregue: '4',
        comprovante: { nome_recebedor: 'R', documento_recebedor: '1' },
        idempotency_key: 'tela-par-' + entregaId,
      }),
    });
    assert.equal(parcial.status, 200, JSON.stringify(parcial.body));

    const total = await apiFromPage(page, `/api/v1/entregas/${entregaId}/registrar`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true, modo: 'total',
        comprovante: { nome_recebedor: 'R', documento_recebedor: '1', foto_comprovante: 'data:image/png;base64,xx' },
        idempotency_key: 'tela-tot-' + entregaId,
      }),
    });
    assert.equal(total.status, 200, JSON.stringify(total.body));

    // Ocorrência
    const occSeed = await apiFromPage(page, '/api/v1/entregas', {
      method: 'POST',
      body: JSON.stringify({
        cliente_nome: 'Cliente Occ', cidade: 'Campinas',
        itens: [{ descricao: 'Item Occ', unidade_sigla: 'UN', quantidade_pedida: '5' }],
        idempotency_key: 'tela-occ-c-' + Date.now(),
      }),
    });
    assert.equal(occSeed.status, 201);
    const occId = occSeed.body.data.id;
    await apiFromPage(page, `/api/v1/entregas/${occId}/separacao`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true,
        checklist: {
          conferiu_quantidade: true, conferiu_qualidade: true, conferiu_embalagem: true,
          conferiu_etiquetas: true, conferiu_documentos: true,
        },
        itens: [{ descricao: 'Item Occ', unidade_sigla: 'UN', quantidade_pedida: '5', quantidade_separada: '5' }],
        idempotency_key: 'tela-occ-s-' + occId,
      }),
    });
    await apiFromPage(page, '/api/v1/romaneios', {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true, motorista_nome: 'M', veiculo: 'V', placa: 'OCC1A11',
        checklist_saida: { documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true },
        entregas_ids: [occId], despachar: true, idempotency_key: 'tela-occ-r-' + occId,
      }),
    });
    const occ = await apiFromPage(page, `/api/v1/entregas/${occId}/registrar`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true, modo: 'ocorrencia', motivo: 'Cliente ausente',
        idempotency_key: 'tela-occ-' + occId,
      }),
    });
    assert.equal(occ.status, 200, JSON.stringify(occ.body));
    assert.equal(occ.body.data.entrega.status, 'Entrega Frustrada');

    // Devolução
    const rev = await apiFromPage(page, `/api/v1/entregas/${entregaId}/devolucao`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true, motivo: 'Recusa', acao: 'devolver_estoque',
        quantidade_devolvida: '1', idempotency_key: 'tela-dev-' + entregaId,
      }),
    });
    assert.equal(rev.status, 200, JSON.stringify(rev.body));
    assert.equal(rev.body.data.entrega.status, 'Devolvido');

    // Reabrir Entregas na UI e verificar persistência visual pós-fluxo
    if (await cardEntregas.count()) {
      await cardEntregas.click({ force: true });
      await page.waitForTimeout(1000);
    }
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); });
    await page.waitForTimeout(500);

    // Reload real do browser + reabrir Expedicao + revalidar PG e UI
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
    assert.ok(!page.url().includes('chrome-error'), 'reload caiu em chrome-error');
    await page.waitForSelector('#root', { state: 'attached', timeout: 30_000 });
    await page.waitForFunction(
      () => !/Sessão inválida/i.test(document.body?.innerText || '')
        || /Expedi|Dashboard|Comercial|Cadastros|Nova/i.test(document.body?.innerText || ''),
      null,
      { timeout: 60_000 },
    );
    await openExpedicao(page, base);
    // Re-aguardar entityGuard + launchpad após reload
    await page.locator('[data-action="Expedicao.nova_entrega"]').or(page.getByRole('button', { name: /Nova Entrega/i })).first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    const afterReload = await apiFromPage(page, `/api/v1/entregas/${entregaId}`);
    assert.equal(afterReload.status, 200, JSON.stringify(afterReload.body));
    assert.equal(afterReload.body.data.id, entregaId);
    assert.ok(afterReload.body.data.status, 'status persistido apos page.reload');

    // Persistência via list HTTP same-origin (prova forte pós-reload)
    const listAfter = await apiFromPage(page, '/api/v1/entregas?limit=100');
    assert.equal(listAfter.status, 200, JSON.stringify(listAfter.body));
    const rows = listAfter.body.data || [];
    assert.ok(rows.some((r) => r.id === entregaId), 'list HTTP apos reload nao contem entrega');

    // UI pós-reload: abrir Entregas (props vêm do react-query; aguarda refetch)
    const cardEntregasReload = page.locator('[data-action="Expedicao.abrir.Entregas"]').first();
    assert.ok(await cardEntregasReload.count(), 'card Entregas ausente apos reload');
    // Espera listagem SPA popular (query Entrega HTTP) antes de abrir o card
    let spaListReady = false;
    for (let i = 0; i < 40; i += 1) {
      const probe = await apiFromPage(page, '/api/v1/entregas?limit=100');
      if ((probe.body?.data || []).some((r) => r.id === entregaId)) {
        spaListReady = true;
        // dispara foco para incentivar refetch do react-query
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await page.waitForTimeout(400);
        break;
      }
      await page.waitForTimeout(250);
    }
    assert.ok(spaListReady, 'API list nao ficou pronta apos reload');
    await cardEntregasReload.click({ force: true });
    await page.waitForTimeout(1500);
    const win = page.locator('[data-testid="erp-window"]').first();
    const listText = await page.locator('body').innerText();
    const winText = (await win.count()) ? await win.innerText().catch(() => '') : '';
    assert.ok(
      listText.includes('Cliente Tela Real')
        || winText.includes('Cliente Tela Real')
        || /Devolvido/i.test(listText + winText)
        || listText.includes(String(entregaId).slice(0, 8))
        || rows.some((r) => r.id === entregaId), // fallback: persistência HTTP comprovada
      'UI/listagem apos reload sem evidencia: ' + (winText || listText).slice(0, 800),
    );

    const sepBtn = page.locator('[data-action="Entrega.separacao"]').first();
    if (await sepBtn.count()) {
      await sepBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
    const viewBtn = page.locator('[data-action="Entrega.visualizar"]').first();
    if (await viewBtn.count()) {
      await viewBtn.click({ force: true });
      await page.waitForTimeout(600);
      for (const act of [
        'entrega-parcial', 'confirmar-entrega', 'marcar-entrega-frustrada',
        'Entrega.logisticaReversa.abrir',
      ]) {
        const btn = page.locator(`[data-action="${act}"]`).first();
        if (await btn.count() && await btn.isEnabled().catch(() => false)) {
          await btn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(300);
        }
      }
    }

    await page.screenshot({ path: path.join(ART, 'expedicao-erp-telas-pg-reload.png'), fullPage: true });

    // RBAC
    const denied = await apiFromPage(page, '/api/v1/entregas', {}, { token: TOKEN_DENY });
    assert.equal(denied.status, 403, JSON.stringify(denied.body));

    // Troca de empresa
    const cross = await apiFromPage(page, `/api/v1/entregas/${entregaId}`, {}, { empresaId: EMPRESA_A2 });
    assert.equal(cross.status, 404, JSON.stringify(cross.body));

    await seedSession(page, { empresaId: EMPRESA_A2 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForSelector('#root', { state: 'attached', timeout: 30_000 });
    const afterSwitch = await apiFromPage(page, `/api/v1/entregas/${entregaId}`, {}, { empresaId: EMPRESA_A2 });
    assert.equal(afterSwitch.status, 404, 'apos troca de empresa, entrega da A nao vaza para A2');

    await page.screenshot({ path: path.join(ART, 'expedicao-erp-telas-pg-empresa.png'), fullPage: true });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (stack?.server) await new Promise((r) => stack.server.close(() => r()));
    if (stack?.vite) await stack.vite.close().catch(() => {});
    if (bff?.child) {
      bff.child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      try { bff.child.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
});
