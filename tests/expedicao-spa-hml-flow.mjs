/**
 * Roteiro HML Expedição completo (SPA localBase44 + Playwright).
 * Camada: LOCAL only — não prova API/PostgreSQL.
 *
 * Uso (SPA HTTPS local rodando):
 *   HML_REQUIRE_SPA=1 node tests/expedicao-spa-hml-flow.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.HML_BASE || 'https://127.0.0.1:5173';
const ART = '/opt/cursor/artifacts/screenshots';
const OUT = '/tmp/hml-exp-flow';
fs.mkdirSync(ART, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const report = {
  camada: 'SPA_LOCAL_BASE44',
  nao_substitui: ['API_HTTP', 'PostgreSQL_real', 'VPS'],
  diagnostico_cards: 'LIMITACAO_COMPUTERUSE__PLAYWRIGHT_OK',
  steps: {},
  counts: {},
  pageErrors: [],
  probe: {},
};

const SEED = fs.readFileSync(new URL('./expedicao-spa-launchpad.playwright.test.mjs', import.meta.url), 'utf8')
  .match(/const SEED = `([\s\S]*?)`;/)?.[1];
if (!SEED) throw new Error('SEED não extraído do teste launchpad');

async function shot(page, name) {
  await page.screenshot({ path: `${ART}/hml-flow-${name}.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function readDb(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('erp_integra_local_db_v1') || '{}'));
}

function summarize(db) {
  const entregas = (db.Entrega || []).filter((e) => String(e.id || '').includes('hml') || String(e.numero_pedido || '').includes('HML'));
  return {
    entregas: entregas.map((e) => ({ id: e.id, status: e.status, romaneio_id: e.romaneio_id, pedido_id: e.pedido_id })),
    romaneios: (db.Romaneio || []).length,
    romaneioIds: (db.Romaneio || []).map((r) => r.id),
    movs: (db.MovimentacaoEstoque || []).length,
    audit: (db.AuditLog || []).length,
  };
}

async function closeAllWindows(page) {
  const closes = page.locator('[data-testid="erp-window"] button[title="Fechar"]');
  const n = await closes.count();
  for (let i = 0; i < n; i += 1) {
    try {
      await closes.nth(0).click({ timeout: 2000, force: true });
      await page.waitForTimeout(300);
    } catch {
      break;
    }
  }
}

async function maximizeActiveWindow(page) {
  await page.evaluate(() => {
    const wins = [...document.querySelectorAll('[data-testid="erp-window"]')];
    const win = wins.at(-1);
    if (!win) return;
    const maxBtn = win.querySelector('button[title="Maximizar"]');
    if (maxBtn) maxBtn.click();
  });
  await page.waitForTimeout(400);
}

async function openModule(page, actionSuffix) {
  await closeAllWindows(page);
  const card = page.locator(`[data-action="Expedicao.abrir.${actionSuffix}"]`).first();
  await card.click({ force: true });
  await page.waitForSelector('[data-testid="erp-window"]', { timeout: 15000 });
  await maximizeActiveWindow(page);
}

  async function fillRomaneioForm(page) {
  const rom = page.locator('[data-testid="erp-window"]').last();
  await rom.locator('input').nth(0).waitFor({ state: 'visible', timeout: 10000 });
  // Aguardar pedidos elegíveis na lista (props+query)
  await page.waitForFunction(() => {
    const root = [...document.querySelectorAll('[data-testid="erp-window"]')].at(-1);
    const title = root?.innerText || '';
    return /disponivel\(is\)/i.test(title) && !/Selecionar Pedidos \(0 disponivel/i.test(title);
  }, { timeout: 15000 }).catch(() => null);
  const disabled = await rom.locator('input').nth(0).isDisabled();
  if (disabled) {
    const probe = await page.evaluate(() => {
      const win = [...document.querySelectorAll('[data-testid="erp-window"]')].at(-1);
      return {
        text: (win?.innerText || '').slice(0, 500),
        contexto: localStorage.getItem('contexto_atual'),
        empresa: localStorage.getItem('empresa_atual_id'),
        group: localStorage.getItem('group_atual_id'),
      };
    });
    report.probe.romaneioBloqueado = probe;
    throw new Error(`Romaneio inputs disabled: ${JSON.stringify(probe)}`);
  }
  await rom.locator('input').nth(0).fill('Motorista HML');
  await rom.locator('input').nth(1).fill('Caminhao HML');
  await rom.locator('input').nth(2).fill('HML1A23');
  await page.evaluate(() => {
    const root = [...document.querySelectorAll('[data-testid="erp-window"]')].at(-1);
    if (!root) return;
    root.querySelectorAll('button[role="checkbox"], input[type="checkbox"]').forEach((b) => {
      const state = b.getAttribute?.('data-state');
      if (state === 'checked') return;
      if (b.checked === true) return;
      b.click();
    });
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelector('[data-action="Romaneio.integracao"]')?.click();
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.pageErrors.push(String(e.message || e)));
  page.on('dialog', async (d) => {
    report.steps.lastDialog = d.message();
    if (d.type() === 'prompt') await d.accept('3');
    else await d.accept();
  });

  await page.goto(`${BASE}/?reset-local=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SEED);
  await page.waitForURL(/\/Expedicao/, { timeout: 30000 });
  // Bootstrap carrega Empresa/Grupo de forma assíncrona — aguardar cards
  await page.waitForSelector('[data-action="Expedicao.abrir.Entregas"]', { timeout: 30000 });
  await page.waitForTimeout(1000);

  report.probe.afterSeed = await page.evaluate(() => ({
    contexto: localStorage.getItem('contexto_atual'),
    empresa: localStorage.getItem('empresa_atual_id'),
    group: localStorage.getItem('group_atual_id'),
    userCtx: JSON.parse(localStorage.getItem('erp_integra_local_user_v1') || '{}').contexto_atual,
  }));
  await shot(page, '01-launchpad');
  report.steps.A_selecao = 'PASS_launchpad';

  // A) Entregas listagem
  await openModule(page, 'Entregas');
  await page.waitForTimeout(1500);
  const body = await page.locator('[data-testid="erp-window"]').innerText();
  assert.match(body, /HML-ENT-SEP-001|HML-PED-001|Aguardando/i);
  await shot(page, '02-entregas');
  report.steps.A_listagem = 'PASS';

  // B) Separação
  const sepClicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="entrega-list-abrir-separacao"]');
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center', inline: 'center' });
    btn.click();
    return true;
  });
  if (sepClicked) {
    await page.waitForTimeout(1500);
    await maximizeActiveWindow(page);
    await page.evaluate(() => {
      const root = [...document.querySelectorAll('[data-testid="erp-window"]')].at(-1);
      if (!root) return;
      root.querySelectorAll('input').forEach((input) => {
        const v = input.value;
        if (v === '0' || v === '') {
          input.focus();
          input.value = '10';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      root.querySelectorAll('button[role="checkbox"]').forEach((b) => {
        if (b.getAttribute('data-state') !== 'checked') b.click();
      });
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.querySelector('[data-action="SeparacaoConferencia.concluir"]')?.click();
    });
    await page.waitForTimeout(2000);
    await shot(page, '03-separacao');
    report.steps.B_separacao = 'PASS_attempted';
  } else {
    report.steps.B_separacao = 'BLOCKED_no_button';
  }

  // C) Romaneio + despacho
  await openModule(page, 'Romaneios');
  await page.waitForTimeout(2000);
  await fillRomaneioForm(page);
  await page.waitForTimeout(3000);
  await shot(page, '04-romaneio');
  const afterRom = summarize(await readDb(page));
  report.counts.afterRomaneio = afterRom;
  report.steps.C_romaneio = afterRom.romaneios >= 1 ? 'PASS' : 'FAIL';

  // D) Retry — não duplicar
  await openModule(page, 'Romaneios');
  await page.waitForTimeout(1500);
  await fillRomaneioForm(page);
  await page.waitForTimeout(2500);
  const afterRetry = summarize(await readDb(page));
  report.counts.afterRetry = afterRetry;
  const ped1 = afterRetry.entregas.filter((e) => e.pedido_id === 'hml_ped_exp_001').length;
  const ped2 = afterRetry.entregas.filter((e) => e.pedido_id === 'hml_ped_exp_002').length;
  report.steps.D_retry = (ped1 <= 1 && ped2 <= 1 && afterRetry.romaneios <= afterRom.romaneios + 1) ? 'PASS' : 'FAIL';
  report.counts.entregasPorPedido = { ped1, ped2, romaneios: afterRetry.romaneios };

  // E/F) Detalhe — parcial / total
  await openModule(page, 'Entregas');
  await page.waitForTimeout(1000);
  await shot(page, '05-entregas-pos-despacho');
  // Abrir detalhe da entrega despachada (Saiu para Entrega)
  const openedDetail = await page.evaluate(() => {
    const buttons = [
      ...document.querySelectorAll('[data-testid="entrega-list-abrir-detalhe"]'),
      ...document.querySelectorAll('[data-action="Entrega.visualizar"]'),
    ];
    const btn = buttons.at(-1) || buttons[0];
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    return true;
  });
  if (openedDetail) {
    await page.waitForTimeout(1500);
    await maximizeActiveWindow(page);
    await page.waitForSelector('[data-action="entrega-parcial"], [data-action="marcar-entrega-frustrada"], [data-action="confirmar-entrega"]', { timeout: 10000 }).catch(() => null);
  }
  const parcial = page.locator('[data-testid="entrega-detalhe-parcial"], [data-action="entrega-parcial"]');
  if (await parcial.count()) {
    await parcial.first().click();
    await page.waitForTimeout(1500);
    report.steps.E_parcial = 'PASS_attempted';
  } else {
    report.steps.E_parcial = openedDetail ? 'BLOCKED_sem_botao_parcial' : 'BLOCKED_ui_detalhe_nao_aberto';
  }
  await shot(page, '06-parcial');

  // I) Falha estoque ANTES da ocorrência (enquanto status ainda permite confirmar)
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('erp_integra_local_db_v1') || '{}');
    db.Produto = (db.Produto || []).map((p) => (
      String(p.id) === 'hml_prod_exp_001' ? { ...p, estoque_atual: 0 } : p
    ));
    localStorage.setItem('erp_integra_local_db_v1', JSON.stringify(db));
  });
  const confirmEntrega = page.locator('[data-action="confirmar-entrega"]');
  if (await confirmEntrega.count()) {
    const beforeStatus = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('erp_integra_local_db_v1') || '{}');
      return (db.Entrega || []).find((e) => e.id === 'hml_ent_exp_ready_001')?.status;
    });
    await confirmEntrega.first().click();
    await page.waitForTimeout(2000);
    const afterStatus = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('erp_integra_local_db_v1') || '{}');
      return (db.Entrega || []).find((e) => e.id === 'hml_ent_exp_ready_001')?.status;
    });
    const toastText = await page.locator('[data-sonner-toast], [role="alert"], li[data-type]').allTextContents();
    const joined = toastText.join(' | ');
    const hasSuccessFull = /Entrega confirmada e estoque baixado|status.*Entregue/i.test(joined)
      || afterStatus === 'Entregue';
    const hasParcialOrBlock = /Estado parcial|estoque|falha|erro|bloque|obrigator/i.test(joined)
      || afterStatus === beforeStatus;
    report.steps.I_falha_parcial = hasSuccessFull ? 'FAIL_falso_sucesso' : (hasParcialOrBlock ? 'PASS_sem_falso_sucesso' : 'BLOCKED_sem_toast');
    report.steps.I_toasts = joined.slice(0, 300);
    report.counts.statusAposFalhaEstoque = { beforeStatus, afterStatus };
  } else {
    report.steps.I_falha_parcial = 'BLOCKED_comprovante_ui_nao_aberta__coberto_por_integracao_telas_41';
  }
  await shot(page, '07-falha-estoque');

  // G) Ocorrência — reabrir detalhe se necessário (parcial/confirm podem fechar/desabilitar)
  let frust = page.locator('[data-action="marcar-entrega-frustrada"]');
  if (!(await frust.count()) || await frust.first().isDisabled()) {
    await openModule(page, 'Entregas');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="entrega-list-abrir-detalhe"], [data-action="Entrega.visualizar"]');
      btn?.click();
    });
    await page.waitForTimeout(1200);
    await maximizeActiveWindow(page);
    frust = page.locator('[data-action="marcar-entrega-frustrada"]');
  }
  if (await frust.count() && !(await frust.first().isDisabled())) {
    await frust.first().click();
    await page.waitForTimeout(1000);
    report.steps.G_ocorrencia = 'PASS_attempted';
  } else {
    report.steps.G_ocorrencia = 'BLOCKED_no_ui';
  }

  // H) Devolução — LogisticaReversa não ligada na listagem (gap existente documentado)
  report.steps.H_devolucao = 'BLOCKED_LogisticaReversa_nao_ligada_na_UI_listagem';

  // J) Recuperação estoque
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('erp_integra_local_db_v1') || '{}');
    db.Produto = (db.Produto || []).map((p) => (
      String(p.id) === 'hml_prod_exp_001' ? { ...p, estoque_atual: 100 } : p
    ));
    localStorage.setItem('erp_integra_local_db_v1', JSON.stringify(db));
  });
  report.steps.J_recuperacao = 'PASS_estoque_restaurado';
  report.counts.final = summarize(await readDb(page));
  report.probe.finalContexto = await page.evaluate(() => ({
    contexto: localStorage.getItem('contexto_atual'),
    empresa: localStorage.getItem('empresa_atual_id'),
  }));

  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${ART}/hml-flow-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();

  assert.equal(report.steps.A_listagem, 'PASS');
  assert.equal(report.probe.afterSeed?.contexto, 'empresa', 'seed deve preservar contexto empresa após hydrate parcial');
  if (report.steps.C_romaneio !== 'PASS') {
    throw new Error('Romaneio não persistiu no localBase44');
  }
  assert.equal(report.steps.D_retry, 'PASS', 'retry duplicou entrega/romaneio');
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(`${OUT}/error.txt`, String(e?.stack || e));
  process.exit(1);
});
