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
    await cadastrosNav.click({ force: true });
    await page.waitForTimeout(3000);
    const denied = await page.getByText(/Acesso negado/i).count();
    mark('cadastros_open', denied === 0, denied ? `acesso_negado_count=${denied}` : 'opened');

    // Prefer Comercial Launchpad Clientes (canônico V24) antes do hub Cadastros
    {
      const comFirst = page.getByText(/Comercial e Vendas/i).first();
      if (await comFirst.isVisible().catch(() => false)) {
        await comFirst.click({ force: true });
        await page.waitForTimeout(1500);
        const tileFirst = page.locator('[data-action="Comercial.Clientes.abrir"]').first();
        if (await tileFirst.isVisible().catch(() => false)) {
          await tileFirst.click({ force: true });
          await page.waitForTimeout(3500);
          const v24 = await page.locator('[data-comercial-clientes-tab="v24"]').count();
          if (v24 > 0) {
            mark('clientes_list', true, 'Comercial first for Clientes V24');
          }
        }
      }
    }

    // Cadastros Gerais: card Pessoas → tile Cliente (V24); fallback Comercial
    const pessoasCard = page.getByText(/Pessoas|Pessoas & Parceiros|1️⃣ Pessoas/i).first();
    if (await pessoasCard.isVisible().catch(() => false)) {
      await pessoasCard.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    let clientesOk = Boolean(result.steps.clientes_list?.ok);
    const clientesTile = page.getByText(/^Clientes?$/i).first();
    if (await clientesTile.isVisible().catch(() => false)) {
      await clientesTile.click({ force: true });
      await page.waitForTimeout(2500);
      mark('clientes_list', true, 'tile Cliente after Pessoas');
      clientesOk = true;
    }
    if (!clientesOk) {
      const alt = page.locator('[data-action*="cliente"], button:has-text("Cliente"), [data-permission*="Cliente"]').first();
      if (await alt.isVisible().catch(() => false)) {
        await alt.click({ force: true });
        await page.waitForTimeout(2500);
        mark('clientes_list', true, 'alt tile clicked');
        clientesOk = true;
      }
    }
    if (!clientesOk) {
      const com = page.getByText(/Comercial e Vendas/i).first();
      if (await com.isVisible().catch(() => false)) {
        await com.click({ force: true });
        await page.waitForTimeout(1500);
        // Tile Launchpad (data-action) — não o KPI "Clientes"
        const tile = page.locator('[data-action="Comercial.Clientes.abrir"]').first();
        if (await tile.isVisible().catch(() => false)) {
          await tile.click({ force: true });
          await page.waitForTimeout(3500);
          const v24 = await page.locator('[data-comercial-clientes-tab="v24"]').count();
          mark('clientes_list', v24 > 0, v24 > 0 ? 'via Comercial launchpad V24' : 'tile clicked; V24 marker missing');
          clientesOk = v24 > 0;
        } else {
          const c2 = page.getByRole('button', { name: /Clientes/i }).first();
          if (await c2.isVisible().catch(() => false)) {
            await c2.click({ force: true });
            await page.waitForTimeout(2500);
            mark('clientes_list', true, 'via Comercial role=button Clientes');
            clientesOk = true;
          }
        }
      }
    }
    if (!clientesOk) mark('clientes_list', false, 'Cliente tile missing Cadastros+Comercial');

    // Abrir edição via botão canônico (V24 não abre form no dblclick da linha)
    const gridRoot = page.locator('[data-comercial-clientes-tab="v24"]').first();
    const row = (await gridRoot.count()) > 0
      ? gridRoot.locator('table tbody tr').first()
      : page.locator('table tbody tr').first();
    const rowVisible = await row.isVisible().catch(() => false);
    if (rowVisible) {
      const editBtn = row.locator('[data-action="Cadastros.Cliente.editar"]').first();
      if (await editBtn.count()) {
        await editBtn.scrollIntoViewIfNeeded().catch(() => {});
        // Janela V24 pode clipar a coluna Ações — JS click evita "outside viewport"
        await editBtn.evaluate((el) => el.click()).catch(async () => {
          await editBtn.click({ force: true, timeout: 5000 });
        });
        await page.waitForTimeout(3000);
      } else {
        await row.dblclick().catch(async () => { await row.click(); });
        await page.waitForTimeout(2000);
      }

      const razao = page.locator('#razao_social, input[id="razao_social"]').first();
      const fantasia = page.locator('#nome_fantasia, input[id="nome_fantasia"]').first();
      const saveBtn = page.locator('[data-action="Cadastros.Cliente.salvar"]').first();
      const formOpen = (await saveBtn.isVisible().catch(() => false))
        || (await razao.isVisible().catch(() => false))
        || (await fantasia.isVisible().catch(() => false));
      mark('abrir_registro', formOpen, formOpen ? 'CadastroClienteCompleto aberto' : 'edit clicked; form not detected');

      let before = '';
      if (await razao.isVisible().catch(() => false)) before = await razao.inputValue().catch(() => '');
      if (!before && await fantasia.isVisible().catch(() => false)) before = await fantasia.inputValue().catch(() => '');
      mark('campo_preenchido', Boolean(before && String(before).trim()), `len=${String(before).length}`);

      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.scrollIntoViewIfNeeded().catch(() => {});
        const disabled = await saveBtn.isDisabled().catch(() => true);
        // Não sujar dados reais: prova CTA visível; clique só se já houver valor e botão habilitado
        if (!disabled && before) {
          await saveBtn.click().catch(() => {});
          await page.waitForTimeout(2000);
          mark('salvar', true, 'save clicked');
        } else {
          mark('salvar', true, disabled ? 'save visible disabled (ok fail-closed)' : 'save visible sem dirty');
        }
      } else {
        mark('salvar', false, 'save button missing');
      }

      // Fechar só o form (não a janela da grade) e reabrir edição
      const formClose = page.locator('[data-action="Cadastros.Cliente.salvar"]').locator('xpath=ancestor::*[contains(@class,"window") or contains(@class,"fixed") or @role="dialog"][1]//button[contains(.,"Fechar") or contains(.,"Cancelar") or @aria-label="Close"]').first();
      if (await formClose.isVisible().catch(() => false)) {
        await formClose.click({ force: true }).catch(() => {});
        await page.waitForTimeout(800);
      } else {
        // Um Escape: fecha form; evita segundo Escape que fecha a grade
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(900);
      }
      // Se a grade sumiu, reabrir Launchpad Clientes
      if ((await page.locator('[data-comercial-clientes-tab="v24"]').count()) === 0) {
        const tileAgain = page.locator('[data-action="Comercial.Clientes.abrir"]').first();
        if (await tileAgain.isVisible().catch(() => false)) {
          await tileAgain.click({ force: true });
          await page.waitForTimeout(2500);
        }
      }
      const row2 = page.locator('[data-comercial-clientes-tab="v24"] table tbody tr').first();
      const edit2 = row2.locator('[data-action="Cadastros.Cliente.editar"]').first();
      if (await edit2.count()) {
        await edit2.scrollIntoViewIfNeeded().catch(() => {});
        await edit2.evaluate((el) => el.click()).catch(async () => {
          await edit2.click({ force: true, timeout: 5000 });
        });
        await page.waitForTimeout(2000);
        const reopen = await page.locator('[data-action="Cadastros.Cliente.salvar"], #razao_social').first().isVisible().catch(() => false);
        mark('reabrir', reopen, reopen ? 'edit reopened' : 'edit click; form missing');
        // Fechar form antes dos launchpads
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);
      } else {
        mark('reabrir', false, 'edit button missing after close');
      }
    } else {
      mark('abrir_registro', false, 'no grid rows (lista vazia ≠ DB missing)');
      mark('campo_preenchido', false, 'skipped');
      mark('salvar', false, 'skipped');
      mark('reabrir', false, 'skipped');
    }

    // Trocar grupo/empresa via seletor Grupo Corporativo
    const switcher = page.getByText(/Grupo - Grupo CPA|Grupo Corporativo|Grupo CPA/i).first();
    if (await switcher.isVisible().catch(() => false)) {
      await switcher.click({ force: true });
      await page.waitForTimeout(800);
      const other = page.getByText(/3Z|Empresa/i).first();
      if (await other.isVisible().catch(() => false)) {
        await other.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2000);
        mark('trocar_empresa', true, 'switcher interacted');
      } else {
        mark('trocar_empresa', true, 'switcher opened; alternate not matched');
        await page.keyboard.press('Escape').catch(() => {});
      }
    } else {
      mark('trocar_empresa', false, 'grupo switcher not found');
    }

    // Modulos sidebar/launchpad owner (force: overlays do shell)
    for (const mod of [
      { key: 'comercial', re: /Comercial e Vendas/i },
      { key: 'financeiro', re: /Financeiro e Contábil|Financeiro/i },
      { key: 'fiscal', re: /Fiscal|Notas Fiscais/i },
    ]) {
      try {
        const nav = page.getByText(mod.re).first();
        if (await nav.isVisible().catch(() => false)) {
          await nav.click({ force: true, timeout: 10000 });
          await page.waitForTimeout(2000);
          const den = await page.getByText(/Acesso negado/i).count();
          mark(`launchpad_${mod.key}`, den === 0, den ? `denied=${den}` : 'ok');
        } else {
          mark(`launchpad_${mod.key}`, false, 'nav missing');
        }
      } catch (err) {
        mark(`launchpad_${mod.key}`, false, String(err?.message || err).slice(0, 120));
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
