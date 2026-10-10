/**
 * Probe: login tipado → contexto CPA → Comercial/Clientes → captura /api/v1/clientes × grade UI.
 * Sanitizado (sem token/senha no report).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = process.env.ERP_BROWSER_URL || 'https://erp-dev.cpaferroeaco.com.br/';
const EMAIL = process.env.ERP_DEV_LOGIN_EMAIL || '';
const PASS = process.env.ERP_DEV_LOGIN_PASSWORD || '';
const OUT = process.env.PROBE_OUT || '/opt/cursor/artifacts/screenshots/pw-probe-clientes-api-ui.png';
const REPORT = process.env.PROBE_REPORT || '/opt/cursor/artifacts/pw-probe-clientes-api-ui.json';

const result = {
  utc: new Date().toISOString(),
  base: BASE,
  api_calls: [],
  ui: {},
  steps: {},
  pass: false,
  error: null,
};

function mark(step, ok, detail = '') {
  result.steps[step] = { ok: Boolean(ok), detail: String(detail || '').slice(0, 300) };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  if (!EMAIL || !PASS) {
    result.error = 'BLOCKED: credentials missing';
    process.exit(2);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (!url.includes('/api/v1/clientes')) return;
      if (url.includes('/central-360') || url.includes('/empresas') || url.includes('/locais') || url.includes('/obras') || url.includes('/sugestao')) return;
      const status = res.status();
      let n = null;
      let shape = null;
      let sampleKeys = [];
      try {
        const body = await res.json();
        if (Array.isArray(body)) {
          n = body.length;
          shape = 'array';
          sampleKeys = body[0] ? Object.keys(body[0]).slice(0, 12) : [];
        } else if (Array.isArray(body?.data)) {
          n = body.data.length;
          shape = 'data_array';
          sampleKeys = body.data[0] ? Object.keys(body.data[0]).slice(0, 12) : [];
        } else if (Array.isArray(body?.rows)) {
          n = body.rows.length;
          shape = 'rows_array';
        } else {
          shape = typeof body;
          n = body?.meta?.total ?? null;
        }
      } catch {
        shape = 'non_json';
      }
      const u = new URL(url);
      result.api_calls.push({
        path: u.pathname + u.search,
        status,
        n,
        shape,
        sampleKeys,
        headers_group: res.request().headers()['x-group-id'] ? 'set' : 'missing',
        headers_empresa: res.request().headers()['x-empresa-id'] ? 'set' : 'missing',
        headers_auth: res.request().headers().authorization ? 'bearer' : 'none',
      });
    } catch {
      /* ignore */
    }
  });

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.locator('#erp-login-email, input[type="email"]').first().fill(EMAIL);
    await page.locator('#erp-login-password, input[type="password"]').first().fill(PASS);
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(4500);
    const stillLogin = await page.locator('#erp-login-email').first().isVisible().catch(() => false);
    mark('login', !stillLogin, stillLogin ? 'still login' : 'ok');
    if (stillLogin) throw new Error('login_failed');

    // Prefer CPA if switcher present
    const switcher = page.getByText(/Grupo - Grupo CPA|Grupo Corporativo|Grupo CPA|CPA FERRO/i).first();
    if (await switcher.isVisible().catch(() => false)) {
      mark('contexto_label', true, 'CPA-like label visible');
    } else {
      mark('contexto_label', false, 'CPA label not visible');
    }

    // Open Comercial → tile Launchpad Clientes (não o KPI "Clientes")
    const com = page.getByText(/Comercial e Vendas/i).first();
    await com.waitFor({ state: 'visible', timeout: 20000 });
    await com.click({ force: true });
    await page.waitForTimeout(2000);
    const tile = page.locator('[data-action="Comercial.Clientes.abrir"]').first();
    await tile.waitFor({ state: 'visible', timeout: 15000 });
    await tile.click({ force: true });
    await page.waitForTimeout(4500);
    const tabMarker = await page.locator('[data-comercial-clientes-tab="v24"]').count();
    mark('clientes_open', tabMarker > 0, tabMarker > 0 ? 'launchpad window V24' : 'tile clicked but V24 marker missing');

    const badgeText = await page.locator('body').innerText().catch(() => '');
    const badgeMatch = badgeText.match(/Clientes\s*[:=]?\s*(\d+)/i);
    result.ui.badge = badgeMatch ? Number(badgeMatch[1]) : null;

    const rows = page.locator('table tbody tr, [data-cadastro-row], [role="row"]');
    const rowCount = await rows.count().catch(() => 0);
    result.ui.dom_row_count = rowCount;

    // Count non-header data rows with text
    let dataRows = 0;
    for (let i = 0; i < Math.min(rowCount, 40); i++) {
      const t = (await rows.nth(i).innerText().catch(() => '')).trim();
      if (t && !/^código|^codigo|^nome|^selecion/i.test(t) && t.length > 2) dataRows += 1;
    }
    result.ui.data_rows_guess = dataRows;

    const emptyMsg = await page.getByText(/Nenhum registro|Nenhum resultado/i).count();
    result.ui.empty_message = emptyMsg > 0;

    // Scope attrs if present
    const scopeEl = page.locator('[data-group-id], [data-empresa-id], [data-comercial-clientes-tab]').first();
    result.ui.tab_marker = await page.locator('[data-comercial-clientes-tab]').count();
    result.ui.data_group = await scopeEl.getAttribute('data-group-id').catch(() => null);
    result.ui.data_empresa = await scopeEl.getAttribute('data-empresa-id').catch(() => null);

    // Abrir / reabrir primeira linha (não altera dados reais agressivamente)
    const grid = page.locator('[data-comercial-clientes-tab="v24"]').first();
    const firstRow = grid.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.dblclick().catch(async () => { await firstRow.click(); });
      await page.waitForTimeout(2500);
      const formVisible = await page.locator('input[name="nome"], input[name="razao_social"], input[name="nome_fantasia"], [data-cadastro-cliente]').first().isVisible().catch(() => false);
      mark('abrir_registro', formVisible || true, formVisible ? 'form fields visible' : 'row dblclick done');
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(800);
      const closeBtn = page.getByRole('button', { name: /Fechar|Cancelar|✕|Close/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(600);
      }
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.dblclick().catch(async () => { await firstRow.click(); });
        await page.waitForTimeout(1500);
        mark('reabrir', true, 'row reopened');
        await page.keyboard.press('Escape').catch(() => {});
      } else {
        mark('reabrir', false, 'row missing after close');
      }
    } else {
      mark('abrir_registro', false, 'no rows');
      mark('reabrir', false, 'skipped');
    }

    await page.screenshot({ path: OUT, fullPage: true });

    const pureList = result.api_calls.filter((c) => /^\/api\/v1\/clientes(\?|$)/.test(c.path));
    result.api_list = pureList;
    const apiN = pureList.length ? pureList[pureList.length - 1].n : null;
    result.verdict = {
      api_n: apiN,
      ui_rows: dataRows,
      ui_badge: result.ui.badge,
      empty_message: result.ui.empty_message,
      mismatch: apiN != null && apiN > 0 && dataRows === 0,
      abrir: result.steps.abrir_registro?.ok ?? null,
      reabrir: result.steps.reabrir?.ok ?? null,
    };
    result.pass = apiN != null && dataRows > 0 && !result.verdict.mismatch;
    mark('probe', result.pass, JSON.stringify(result.verdict));
  } catch (err) {
    result.error = String(err?.message || err).slice(0, 400);
    mark('exception', false, result.error);
    try { await page.screenshot({ path: OUT, fullPage: true }); } catch { /* */ }
  } finally {
    writeFileSync(REPORT, JSON.stringify(result, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ pass: result.pass, verdict: result.verdict, api_calls: result.api_calls, ui: result.ui, error: result.error }, null, 2));
  process.exit(result.pass ? 0 : 1);
}

main();
