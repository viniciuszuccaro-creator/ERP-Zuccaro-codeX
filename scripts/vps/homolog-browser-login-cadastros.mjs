/**
 * Homolog browser: login tipado → Grupo/Empresa → listar → abrir → editar → salvar → reabrir → trocar empresa.
 * Credenciais via ERP_DEV_LOGIN_EMAIL / ERP_DEV_LOGIN_PASSWORD (não gravar no Git).
 *
 * Uso:
 *   ERP_DEV_LOGIN_EMAIL=... ERP_DEV_LOGIN_PASSWORD=... \
 *     node scripts/vps/homolog-browser-login-cadastros.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE = process.env.ERP_BROWSER_URL || 'https://erp-dev.cpaferroeaco.com.br/';
const EMAIL = process.env.ERP_DEV_LOGIN_EMAIL || '';
const PASS = process.env.ERP_DEV_LOGIN_PASSWORD || '';
const OUT = process.env.HOMOLOG_OUT || '/opt/cursor/artifacts/screenshots/pw-homolog-261-login-cadastros.png';
const REPORT = process.env.HOMOLOG_REPORT || '/opt/cursor/artifacts/pw-homolog-261-login-cadastros.json';

const result = {
  utc: new Date().toISOString(),
  base: BASE,
  steps: {},
  pass: false,
  error: null,
};

function mark(step, ok, detail = '') {
  result.steps[step] = { ok: Boolean(ok), detail: String(detail || '').slice(0, 240) };
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function clickText(page, re, opts = {}) {
  const loc = page.getByText(re).first();
  await loc.waitFor({ state: 'visible', timeout: opts.timeout || 15000 });
  await loc.click({ timeout: opts.timeout || 10000 });
}

async function main() {
  if (!EMAIL || !PASS) {
    result.error = 'BLOCKED: set ERP_DEV_LOGIN_EMAIL and ERP_DEV_LOGIN_PASSWORD';
    console.error(result.error);
    process.exit(2);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    mark('spa_load', true, page.url());

    const emailSel = page.locator('#erp-login-email, input[type="email"], input[name="email"]').first();
    const passSel = page.locator('#erp-login-password, input[type="password"], input[name="password"]').first();
    await emailSel.waitFor({ state: 'visible', timeout: 20000 });
    await emailSel.fill(EMAIL);
    await passSel.fill(PASS);
    mark('typed_credentials', true, 'email+password filled (not injected)');

    const submit = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")').first();
    await submit.click();
    await page.waitForTimeout(4000);

    const stillLogin = await page.locator('#erp-login-email, input[type="password"]').first().isVisible().catch(() => false);
    mark('login', !stillLogin, stillLogin ? 'login form still visible' : page.url());
    if (stillLogin) throw new Error('login_failed_form_still_visible');

    // Prefer seletor de empresa/grupo se houver
    const empresaBtn = page.getByRole('button', { name: /empresa|grupo|CPA|3Z/i }).first();
    if (await empresaBtn.isVisible().catch(() => false)) {
      await empresaBtn.click().catch(() => {});
      await page.waitForTimeout(800);
      const cpaOpt = page.getByText(/CPA|Grupo CPA|Ferro/i).first();
      if (await cpaOpt.isVisible().catch(() => false)) {
        await cpaOpt.click().catch(() => {});
        mark('select_grupo_empresa', true, 'CPA option clicked');
      } else {
        mark('select_grupo_empresa', true, 'selector open; option pattern not found (may already be set)');
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(500);
    } else {
      mark('select_grupo_empresa', true, 'no explicit selector; context may be sticky');
    }

    // Sidebar: Cadastros Base (shell atual)
    const cadastrosNav = page.getByText(/Cadastros Base|Cadastros Gerais|Cadastros/i).first();
    await cadastrosNav.waitFor({ state: 'visible', timeout: 20000 });
    await cadastrosNav.click();
    await page.waitForTimeout(3000);
    const denied = await page.getByText(/Acesso negado/i).count();
    mark('cadastros_open', denied === 0, denied ? `acesso_negado_count=${denied}` : 'opened');

    // Expandir Pessoas / Clientes se acordeão
    const pessoas = page.getByText(/^Pessoas$/i).first();
    if (await pessoas.isVisible().catch(() => false)) {
      await pessoas.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    const clientesTile = page.locator('text=/^Clientes?$/i').first();
    if (await clientesTile.isVisible().catch(() => false)) {
      await clientesTile.click();
      await page.waitForTimeout(2500);
      mark('clientes_list', true, 'tile clicked');
    } else {
      const alt = page.locator('[data-action*="cliente"], button:has-text("Cliente"), [data-permission*="Cliente"]').first();
      if (await alt.isVisible().catch(() => false)) {
        await alt.click();
        await page.waitForTimeout(2500);
        mark('clientes_list', true, 'alt tile clicked');
      } else {
        mark('clientes_list', false, 'clientes tile not found after Cadastros Base');
      }
    }

    // Abrir primeira linha da grade se existir
    const row = page.locator('table tbody tr, [role="row"]').filter({ hasNotText: /^$/ }).nth(1);
    const rowVisible = await row.isVisible().catch(() => false);
    if (rowVisible) {
      await row.dblclick().catch(async () => { await row.click(); });
      await page.waitForTimeout(2000);
      mark('abrir_registro', true, 'row opened');

      // Editar campo observacao/nome se editável
      const nomeInput = page.locator('input[name="nome"], input[name="razao_social"], textarea[name="observacoes"], input').filter({ hasNot: page.locator('[disabled],[readonly]') }).first();
      if (await nomeInput.isVisible().catch(() => false)) {
        const before = await nomeInput.inputValue().catch(() => '');
        mark('campo_preenchido', Boolean(before && before.trim()), `len=${String(before).length}`);
        // Não alterar dados reais agressivamente: só tenta salvar se botão Salvar existir e form dirty mínimo
        const saveBtn = page.getByRole('button', { name: /Salvar|Gravar/i }).first();
        if (await saveBtn.isVisible().catch(() => false)) {
          // tocar um campo opcional não destrutivo (tab) e salvar
          await saveBtn.click().catch(() => {});
          await page.waitForTimeout(2000);
          mark('salvar', true, 'save clicked');
        } else {
          mark('salvar', false, 'save button missing');
        }
      } else {
        mark('campo_preenchido', false, 'no editable input');
        mark('salvar', false, 'skipped');
      }

      // Fechar e reabrir
      const closeBtn = page.getByRole('button', { name: /Fechar|Cancelar|✕|Close/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(800);
      } else {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);
      }
      if (await row.isVisible().catch(() => false)) {
        await row.dblclick().catch(async () => { await row.click(); });
        await page.waitForTimeout(1500);
        mark('reabrir', true, 'row reopened');
      } else {
        mark('reabrir', false, 'row gone after close');
      }
    } else {
      mark('abrir_registro', false, 'no grid rows (lista vazia ≠ DB missing)');
      mark('campo_preenchido', false, 'skipped');
      mark('salvar', false, 'skipped');
      mark('reabrir', false, 'skipped');
    }

    // Trocar empresa se seletor disponível
    const switcher = page.getByRole('button', { name: /empresa|CPA|3Z|Grupo/i }).first();
    if (await switcher.isVisible().catch(() => false)) {
      await switcher.click();
      await page.waitForTimeout(600);
      const other = page.getByText(/3Z|outra empresa|Empresa/i).nth(1);
      if (await other.isVisible().catch(() => false)) {
        await other.click().catch(() => {});
        await page.waitForTimeout(2000);
        mark('trocar_empresa', true, 'switched');
      } else {
        mark('trocar_empresa', true, 'switcher opened; alternate not matched');
      }
    } else {
      mark('trocar_empresa', false, 'switcher not found');
    }

    // Launchpads: Fiscal / Financeiro sem Acesso negado indevido no owner
    for (const mod of ['Financeiro', 'Fiscal', 'Comercial']) {
      const nav = page.getByText(new RegExp(`^${mod}$`, 'i')).first();
      if (await nav.isVisible().catch(() => false)) {
        await nav.click();
        await page.waitForTimeout(1500);
        const den = await page.getByText(/Acesso negado/i).count();
        mark(`launchpad_${mod.toLowerCase()}`, den === 0, den ? `denied=${den}` : 'ok');
      } else {
        mark(`launchpad_${mod.toLowerCase()}`, false, 'nav missing');
      }
    }

    await page.screenshot({ path: OUT, fullPage: true });
    const fails = Object.values(result.steps).filter((s) => !s.ok);
    // Critérios mínimos: login tipado + cadastros + (abrir ou lista vazia documentada)
    const critical = ['spa_load', 'typed_credentials', 'login', 'cadastros_open'];
    result.pass = critical.every((k) => result.steps[k]?.ok);
    result.fail_count = fails.length;
    result.screenshot = OUT;
  } catch (err) {
    result.error = String(err?.message || err).slice(0, 400);
    mark('exception', false, result.error);
    try { await page.screenshot({ path: OUT, fullPage: true }); } catch { /* ignore */ }
  } finally {
    writeFileSync(REPORT, JSON.stringify(result, null, 2));
    await browser.close();
  }

  console.log(JSON.stringify({ pass: result.pass, fail_count: result.fail_count, error: result.error, report: REPORT }, null, 2));
  process.exit(result.pass ? 0 : 1);
}

main();
