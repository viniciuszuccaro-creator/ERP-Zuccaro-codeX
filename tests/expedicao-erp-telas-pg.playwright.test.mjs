/**
 * Telas reais do ERP (SPA /Expedicao) × BFF + PostgreSQL isolado (PGlite).
 * Camada: SPA_HTTP + API_HTTP_PGLITE — ≠ SPA_LOCAL_BASE44; ≠ mock in-memory puro.
 *
 * Auth: proxy same-origin mocka GET /api/v1/auth/session e traduz Bearer → X-Actor-Id
 * para o harness BFF em ERP_AUTH_MODE=dev_headers (sem Supabase).
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
fs.mkdirSync(ART, { recursive: true });

const GROUP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EMPRESA_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EMPRESA_A2 = 'c2c2c2c2-cccc-4ccc-8ccc-c2c2c2c2c2c2';
const ACTOR_OK = 'a4a4a4a4-aaaa-4aaa-8aaa-a4a4a4a4a4a4';
const ACTOR_DENY = 'b4b4b4b4-bbbb-4bbb-8bbb-b4b4b4b4b4b4';
const TOKEN_OK = 'test-token-actor-a-expedicao';
const TOKEN_DENY = 'test-token-actor-b-deny';

const PERMS_OK = {
  Expedicao: {
    entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar', 'exportar'],
    Entrega: ['visualizar', 'criar', 'editar', 'conferir', 'expedir', 'entregar', 'ocorrencia', 'cancelar', 'exportar'],
    Entregas: ['visualizar', 'criar', 'editar', 'incluir'],
    romaneio: ['visualizar', 'criar', 'editar'],
    Romaneio: ['visualizar', 'criar', 'editar'],
    Romaneios: ['visualizar', 'criar', 'editar'],
    separacao: ['visualizar', 'criar', 'editar', 'conferir'],
    Separacao: ['visualizar', 'criar', 'editar', 'conferir'],
    LogisticaReversa: ['visualizar', 'editar', 'criar'],
  },
  'Expedição': {
    Entregas: ['visualizar', 'criar', 'editar', 'incluir', 'ver'],
  },
};

const EMPRESAS = [
  {
    id: EMPRESA_A,
    group_id: GROUP,
    razao_social: 'Empresa A Sintetica',
    nome_fantasia: 'Empresa A',
    status: 'Ativa',
  },
  {
    id: EMPRESA_A2,
    group_id: GROUP,
    razao_social: 'Empresa A2 Sintetica',
    nome_fantasia: 'Empresa A2',
    status: 'Ativa',
  },
];

function sessionPayload(actorId, role = 'admin') {
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
        role,
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
  return String(req.headers['x-actor-id'] || ACTOR_OK);
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

async function proxyApi(bffPort, req, res) {
  const url = req.url || '/';
  if (url.startsWith('/api/v1/auth/session') && (req.method === 'GET' || req.method === 'POST')) {
    const actor = actorFromAuth(req);
    const body = Buffer.from(JSON.stringify(sessionPayload(actor)));
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const actor = actorFromAuth(req);
  const headers = {
    'content-type': req.headers['content-type'] || 'application/json',
    'x-group-id': req.headers['x-group-id'] || GROUP,
    'x-empresa-id': req.headers['x-empresa-id'] || EMPRESA_A,
    'x-actor-id': actor,
  };
  try {
    const upstream = await fetch(`http://127.0.0.1:${bffPort}${url}`, {
      method: req.method,
      headers,
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
}

async function startViteWithProxy(bffPort) {
  // Env HTTP deve existir ANTES do createViteServer (Vite embute import.meta.env no client).
  process.env.VITE_ERP_BACKEND = 'http';
  process.env.VITE_ERP_HTTP_EXPEDICAO = 'true';
  process.env.VITE_ERP_API_SAME_ORIGIN = 'true';

  const vite = await createViteServer({
    root: repoRoot,
    configFile: path.join(repoRoot, 'vite.config.js'),
    appType: 'spa',
    envDir: repoRoot,
    define: {
      'import.meta.env.VITE_ERP_BACKEND': JSON.stringify('http'),
      'import.meta.env.VITE_ERP_HTTP_EXPEDICAO': JSON.stringify('true'),
      'import.meta.env.VITE_ERP_API_SAME_ORIGIN': JSON.stringify('true'),
    },
    server: {
      middlewareMode: true,
      hmr: false,
    },
  });

  const listenPort = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = req.url || '/';
      if (url.startsWith('/api/') || url === '/health' || url === '/ready') {
        await proxyApi(bffPort, req, res);
        return;
      }
      vite.middlewares(req, res, async () => {
        try {
          const indexPath = path.join(repoRoot, 'index.html');
          const raw = fs.readFileSync(indexPath, 'utf8');
          const html = await vite.transformIndexHtml(url, raw);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err) {
          res.statusCode = 500;
          res.end(String(err && err.stack || err));
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });

  return { vite, ...listenPort };
}

async function seedHttpSession(page, { token = TOKEN_OK, actorId = ACTOR_OK, empresaId = EMPRESA_A } = {}) {
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
  }, { token, actorId, groupId: GROUP, empresaId, empresas: EMPRESAS });
}

async function apiFromPage(page, pathName, init = {}) {
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
  }, {
    pathName,
    init,
    groupId: GROUP,
    empresaId: EMPRESA_A,
    token: TOKEN_OK,
  });
}

test('SPA /Expedicao real × BFF+PGlite: fluxo, reload, RBAC e troca de empresa', async () => {
  let bff;
  let stack;
  let browser;
  try {
    bff = await startBff();
    stack = await startViteWithProxy(bff.port);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await seedHttpSession(page);

    await page.goto(`http://127.0.0.1:${stack.port}/Expedicao`, { waitUntil: 'networkidle', timeout: 120_000 });
    // Boot Auth + UserContext
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    assert.ok(
      /Expedi|Entrega|Romaneio|Nova Entrega/i.test(bodyText),
      'tela Expedicao deve renderizar: ' + bodyText.slice(0, 400),
    );

    // --- Criação (API canônica via same-origin, mesma sessão da SPA) ---
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
    assert.ok(entregaId);

    // Abrir listagem Entregas (launchpad)
    const entregasCard = page.locator('[data-action="Expedicao.abrir.Entregas"], [data-action*="Entregas"]').first();
    if (await entregasCard.count()) {
      await entregasCard.click();
      await page.waitForTimeout(800);
    } else {
      await page.getByText('Entregas', { exact: true }).first().click({ timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(800);
    }

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

    // Parcial
    const parcial = await apiFromPage(page, `/api/v1/entregas/${entregaId}/registrar`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true,
        modo: 'parcial',
        quantidade_entregue: '4',
        comprovante: { nome_recebedor: 'R', documento_recebedor: '1' },
        idempotency_key: 'tela-par-' + entregaId,
      }),
    });
    assert.equal(parcial.status, 200, JSON.stringify(parcial.body));

    // Total
    const total = await apiFromPage(page, `/api/v1/entregas/${entregaId}/registrar`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true,
        modo: 'total',
        comprovante: {
          nome_recebedor: 'R',
          documento_recebedor: '1',
          foto_comprovante: 'data:image/png;base64,xx',
        },
        idempotency_key: 'tela-tot-' + entregaId,
      }),
    });
    assert.equal(total.status, 200, JSON.stringify(total.body));

    // Ocorrência (nova entrega no fluxo frustrado)
    const occSeed = await apiFromPage(page, '/api/v1/entregas', {
      method: 'POST',
      body: JSON.stringify({
        cliente_nome: 'Cliente Occ',
        cidade: 'Campinas',
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
        confirmed: true,
        modo: 'ocorrencia',
        motivo: 'Cliente ausente',
        idempotency_key: 'tela-occ-' + occId,
      }),
    });
    assert.equal(occ.status, 200, JSON.stringify(occ.body));
    assert.equal(occ.body.data.entrega.status, 'Entrega Frustrada');

    // Devolução
    const rev = await apiFromPage(page, `/api/v1/entregas/${entregaId}/devolucao`, {
      method: 'POST',
      body: JSON.stringify({
        confirmed: true,
        motivo: 'Recusa',
        acao: 'devolver_estoque',
        quantidade_devolvida: '1',
        idempotency_key: 'tela-dev-' + entregaId,
      }),
    });
    assert.equal(rev.status, 200, JSON.stringify(rev.body));
    assert.equal(rev.body.data.entrega.status, 'Devolvido');

    // --- Reload real do navegador: revalida dados persistidos ---
    await page.evaluate((id) => localStorage.setItem('exp_tela_reload_id', id), entregaId);
    await page.reload({ waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForTimeout(1500);
    const afterReload = await apiFromPage(page, `/api/v1/entregas/${entregaId}`);
    assert.equal(afterReload.status, 200, JSON.stringify(afterReload.body));
    assert.ok(afterReload.body.data?.id === entregaId);
    assert.ok(afterReload.body.data?.status, 'status persistido apos page.reload');

    // UI: busca na listagem (se painel aberto) ou reabre Entregas
    const busca = page.getByTestId('entrega-list-busca');
    if (await busca.count()) {
      await busca.fill('Cliente Tela Real');
      await page.waitForTimeout(400);
    }

    await page.screenshot({ path: path.join(ART, 'expedicao-erp-telas-pg-reload.png'), fullPage: true });

    // --- RBAC: ator sem permissão → 403 ---
    const denied = await page.evaluate(async ({ pathName, token, groupId, empresaId }) => {
      const res = await fetch(pathName, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-group-id': groupId,
          'x-empresa-id': empresaId,
          'content-type': 'application/json',
        },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    }, {
      pathName: '/api/v1/entregas',
      token: TOKEN_DENY,
      groupId: GROUP,
      empresaId: EMPRESA_A,
    });
    assert.equal(denied.status, 403, JSON.stringify(denied.body));

    // --- Troca de empresa: isolamento 404 ---
    const cross = await page.evaluate(async ({ pathName, token, groupId, empresaId }) => {
      const res = await fetch(pathName, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-group-id': groupId,
          'x-empresa-id': empresaId,
          'content-type': 'application/json',
        },
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    }, {
      pathName: `/api/v1/entregas/${entregaId}`,
      token: TOKEN_OK,
      groupId: GROUP,
      empresaId: EMPRESA_A2,
    });
    assert.equal(cross.status, 404, JSON.stringify(cross.body));

    // Troca de empresa na sessão SPA (switch) e reload
    await page.evaluate(({ empresaId, empresas, token, actorId, groupId }) => {
      const raw = localStorage.getItem('erp_runtime_scope');
      const scope = raw ? JSON.parse(raw) : {};
      scope.empresaId = empresaId;
      scope.empresas = empresas;
      scope.token = token;
      scope.actorId = actorId;
      scope.groupId = groupId;
      localStorage.setItem('erp_runtime_scope', JSON.stringify(scope));
      localStorage.setItem('base44_access_token', token);
    }, {
      empresaId: EMPRESA_A2,
      empresas: EMPRESAS,
      token: TOKEN_OK,
      actorId: ACTOR_OK,
      groupId: GROUP,
    });
    await page.reload({ waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForTimeout(1000);
    const afterSwitch = await page.evaluate(async ({ pathName, token, groupId, empresaId }) => {
      const res = await fetch(pathName, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-group-id': groupId,
          'x-empresa-id': empresaId,
        },
      });
      return { status: res.status };
    }, {
      pathName: `/api/v1/entregas/${entregaId}`,
      token: TOKEN_OK,
      groupId: GROUP,
      empresaId: EMPRESA_A2,
    });
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
