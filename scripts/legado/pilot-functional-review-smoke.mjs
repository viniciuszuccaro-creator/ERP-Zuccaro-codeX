// Synthetic review only. Uses an existing temporary Playwright installation, not application dependencies.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const [modulePath, destination] = process.argv.slice(2);
if (!path.isAbsolute(modulePath || '') || !path.isAbsolute(destination || '')) throw new Error('ABSOLUTE_TEST_PATHS_REQUIRED');
const { chromium } = await import(pathToFileURL(modulePath));
const browser = await chromium.launch({ headless: true });
fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
const checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4173'
    ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.getByText('PREVIA SINTETICA', { exact: false }).waitFor();
  assert.equal(await page.locator('#total').textContent(), '4');
  assert.equal(await page.locator('#rows tr').count(), 4); checks.push('four-status-synthetic-preview');
  await page.getByRole('button', { name: 'Conferir', exact: true }).first().click();
  assert.equal(await page.getByRole('button', { name: 'Aplicar no cadastro', exact: true }).isDisabled(), true);
  await page.locator('#field').selectOption('cep');
  await page.getByRole('button', { name: 'Usar sugestao de formato', exact: true }).click();
  assert.equal(await page.locator('#proposed').inputValue(), '12345678');
  assert.ok((await page.locator('#fields').textContent()).includes('12.345-678')); checks.push('original-kept-format-only');
  await page.locator('#reason').fill('Somente apresentacao sintetica');
  const download = async name => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar proposta pendente', exact: true }).click();
    const file = path.join(destination, name); await (await pending).saveAs(file);
    return JSON.parse(fs.readFileSync(file));
  };
  const one = await download('synthetic-draft-one.json'), two = await download('synthetic-draft-replay.json');
  assert.equal(one.command.operationId, two.command.operationId);
  assert.equal(one.synthetic, true); assert.equal(one.applied, false); assert.equal(one.operationalAuthorized, false);
  checks.push('draft-no-master-write-stable-operation');
  await page.locator('#situation').selectOption('REVIEW_REQUIRED');
  assert.equal(await page.locator('#rows tr').count(), 1);
  await page.locator('#search').fill('SOURCE_FIELD_ABSENT');
  assert.equal(await page.locator('#matched').textContent(), '1'); checks.push('status-field-reason-filter');
  await page.screenshot({ path: path.join(destination, 'synthetic-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(destination, 'synthetic-mobile.png'), fullPage: true });
  checks.push('mobile-no-page-overflow');
  const result = { checks, passed: checks.length, failed: 0, skipped: 0, syntheticOnly: true, databaseAccess: false };
  fs.writeFileSync(path.join(destination, 'result-sanitized.json'), JSON.stringify(result), { mode: 0o600 });
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
