/**
 * Homologação SPA Expedição (localBase44) via Playwright.
 * Camada: backend LOCAL (IndexedDB/localStorage) — NÃO substitui API/PostgreSQL real.
 *
 * Pré-requisito: Vite em https://127.0.0.1:5173 com VITE_ERP_BACKEND=local
 * Uso: node --test tests/expedicao-spa-launchpad.playwright.test.mjs
 *      (ou) node tests/expedicao-spa-hml-flow.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.HML_BASE || 'https://127.0.0.1:5173';
const ART = '/opt/cursor/artifacts/screenshots';
const OUT = '/tmp/hml-exp-flow';
fs.mkdirSync(ART, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const SEED = `
(() => {
  const STORAGE_KEY = 'erp_integra_local_db_v1';
  const USER_KEY = 'erp_integra_local_user_v1';
  const AUTH_STATE = 'erp_integra_local_auth_state_v1';
  const now = () => new Date().toISOString();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('DB local ausente');
  const db = JSON.parse(raw);
  const groups = db.GrupoEmpresarial || [];
  const empresas = db.Empresa || [];
  const G = String(groups[0]?.id || '');
  const E = String(empresas[0]?.id || '');
  if (!G || !E) throw new Error('Topologia ausente');
  db.Empresa = empresas.map((e) => ({
    ...e,
    group_id: e.group_id || e.grupo_id || G,
    grupo_id: e.grupo_id || e.group_id || G,
    grupo_empresarial_id: e.grupo_empresarial_id || G,
  }));
  const ensure = (entity, row) => {
    const list = Array.isArray(db[entity]) ? db[entity] : [];
    const idx = list.findIndex((x) => String(x.id) === String(row.id));
    if (idx >= 0) list[idx] = { ...list[idx], ...row, updated_date: now() };
    else list.push({ ...row, created_date: now(), updated_date: now() });
    db[entity] = list;
  };
  ensure('PerfilAcesso', {
    id: 'local_perfil_admin', nome: 'Administrador Local', ativo: true, group_id: G, grupo_id: G,
    permissoes: { '*': ['visualizar','ver','criar','editar','excluir','aprovar','conferir','entregar','ocorrencia','exportar','importar','configurar','administrar'] },
  });
  const prev = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  const user = {
    ...prev,
    id: 'local-admin-user', email: 'admin@erp-local.test', full_name: 'Administrador Local',
    role: 'admin', _app_role: 'admin', perfil_acesso_id: 'local_perfil_admin', mestre_local: true,
    disabled: false, is_verified: true, ativo: true,
    contexto_atual: 'empresa', empresa_atual_id: E, empresa_padrao_id: E,
    grupo_atual_id: G, grupo_padrao_id: G, pode_operar_em_grupo: true, pode_ver_todas_empresas: true,
    empresas_vinculadas: db.Empresa.map((e) => ({ empresa_id: e.id, ativo: true })),
    grupos_vinculados: [{ grupo_id: G, ativo: true }],
  };
  ensure('User', user);
  const itens = [{
    produto_id: 'hml_prod_exp_001', codigo: 'HML-P01', descricao: 'PRODUTO HML EXP',
    quantidade: 10, quantidade_pedida: 10, quantidade_separada: 0, unidade: 'UN', peso_kg: 1, valor_unitario: 50,
  }];
  ensure('Cliente', { id: 'hml_cli_exp_001', nome: 'CLIENTE HML EXP', group_id: G, grupo_id: G, empresa_id: E, status: 'Ativo', cidade: 'Sao Paulo', uf: 'SP' });
  ensure('Produto', { id: 'hml_prod_exp_001', codigo: 'HML-P01', descricao: 'PRODUTO HML EXP', group_id: G, grupo_id: G, empresa_id: E, estoque_atual: 100, ativo: true });
  ensure('Pedido', {
    id: 'hml_ped_exp_001', numero_pedido: 'HML-PED-001', status: 'Em Separação', tipo_frete: 'CIF',
    group_id: G, grupo_id: G, empresa_id: E, cliente_id: 'hml_cli_exp_001', cliente_nome: 'CLIENTE HML EXP',
    valor_total: 500, peso_total_kg: 10, itens, endereco_entrega_completo: 'Rua HML 100', data_entrega_solicitada: '2026-10-05', historico_status: [],
  });
  ensure('Pedido', {
    id: 'hml_ped_exp_002', numero_pedido: 'HML-PED-002', status: 'Pronto para Expedir', tipo_frete: 'CIF',
    group_id: G, grupo_id: G, empresa_id: E, cliente_id: 'hml_cli_exp_001', cliente_nome: 'CLIENTE HML EXP',
    valor_total: 300, peso_total_kg: 6,
    itens: [{ ...itens[0], quantidade: 6, quantidade_pedida: 6, quantidade_separada: 6 }],
    endereco_entrega_completo: 'Rua HML 200', data_entrega_solicitada: '2026-10-06', historico_status: [],
  });
  ensure('Entrega', {
    id: 'hml_ent_exp_sep_001', numero_entrega: 'HML-ENT-SEP-001', status: 'Aguardando Separação',
    group_id: G, grupo_id: G, empresa_id: E, pedido_id: 'hml_ped_exp_001', numero_pedido: 'HML-PED-001',
    cliente_id: 'hml_cli_exp_001', cliente_nome: 'CLIENTE HML EXP', itens, peso_total_kg: 10, valor_mercadoria: 500,
    endereco_entrega_completo: 'Rua HML 100', historico_status: [],
  });
  ensure('Entrega', {
    id: 'hml_ent_exp_ready_001', numero_entrega: 'HML-ENT-RDY-001', status: 'Pronto para Expedir',
    group_id: G, grupo_id: G, empresa_id: E, pedido_id: 'hml_ped_exp_002', numero_pedido: 'HML-PED-002',
    cliente_id: 'hml_cli_exp_001', cliente_nome: 'CLIENTE HML EXP',
    itens: [{ ...itens[0], quantidade: 6, quantidade_pedida: 6, quantidade_separada: 6 }],
    peso_total_kg: 6, valor_mercadoria: 300,
    endereco_entrega_completo: 'Rua HML 200', historico_status: [],
  });
  db.SessaoUsuario = [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_STATE, JSON.stringify({ logged_in: true, sessao_id: null, bootstrapped: true }));
  localStorage.removeItem('sessao_id');
  localStorage.setItem('contexto_atual', 'empresa');
  localStorage.setItem('empresa_atual_id', E);
  localStorage.setItem('group_atual_id', G);
  console.log('[HML] seed', { G, E });
  location.href = '/Expedicao';
})();
`;

async function shot(page, name) {
  const p = `${ART}/hml-flow-${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  return p;
}

function countsFromDb(db) {
  const entregas = (db.Entrega || []).filter((e) => String(e.id || '').includes('hml') || String(e.pedido_id || '').includes('hml'));
  const romaneios = db.Romaneio || [];
  const audit = (db.AuditLog || []).filter((a) => JSON.stringify(a).includes('hml') || JSON.stringify(a).includes('HML') || JSON.stringify(a).includes('Romaneio'));
  const movs = db.MovimentacaoEstoque || [];
  return {
    entregas: entregas.map((e) => ({ id: e.id, status: e.status, romaneio_id: e.romaneio_id, pedido_id: e.pedido_id })),
    romaneios: romaneios.length,
    romaneioIds: romaneios.map((r) => r.id),
    auditHml: audit.length,
    movs: movs.length,
  };
}

test('SPA local: launchpad card abre openWindow (Playwright)', async (t) => {
  // Skip if SPA unreachable
  let reachable = false;
  try {
    const res = await fetch(BASE + '/', { method: 'HEAD' });
    reachable = res.ok || res.status === 200;
  } catch {
    try {
      // node fetch may fail on self-signed; still try playwright
      reachable = true;
    } catch {
      reachable = false;
    }
  }
  if (!reachable && process.env.HML_REQUIRE_SPA !== '1') {
    t.skip('SPA local não disponível');
    return;
  }

  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } })).newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

  try {
    await page.goto(`${BASE}/?reset-local=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2000);
    await page.evaluate(SEED);
    await page.waitForURL(/\/Expedicao/, { timeout: 30000 });
    await page.waitForSelector('[data-action="Expedicao.abrir.Entregas"]', { timeout: 30000 });
    await page.waitForTimeout(500);
    await shot(page, '01-launchpad');

    const card = page.locator('[data-action="Expedicao.abrir.Entregas"]').first();
    assert.equal(await card.count(), 1, 'card Entregas deve existir');
    await card.click();
    await page.waitForSelector('[data-testid="erp-window"]', { timeout: 10000 });
    const title = await page.locator('[data-testid="erp-window"]').first().getAttribute('data-window-title');
    assert.match(String(title || ''), /Entregas/i);
    await shot(page, '02-window-entregas');
    assert.equal(pageErrors.length, 0, `pageerrors: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
});
