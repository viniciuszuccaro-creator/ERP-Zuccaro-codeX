import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { FINANCEIRO_LAUNCHPAD_MODULE_TITLES } from '../src/components/financeiro/financeiroLaunchpadAccess.js';

test('Financeiro.jsx registra os 15 cards do inventário e ModuleTabs com moduleName', async () => {
  const source = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  assert.match(source, /moduleName=["']Financeiro["']/);
  assert.match(source, /canViewFinanceLaunchpadModule/);
  assert.match(source, /ProtectedSection module=["']Financeiro["']/);
  for (const title of FINANCEIRO_LAUNCHPAD_MODULE_TITLES) {
    assert.match(source, new RegExp(`title:\\s*['"]${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`));
  }
});

test('Layout e pages.config expõem rota Financeiro', async () => {
  const layout = await readFile(new URL('../src/Layout.jsx', import.meta.url), 'utf8');
  const pages = await readFile(new URL('../src/pages.config.js', import.meta.url), 'utf8');
  assert.match(layout, /createPageUrl\(["']Financeiro["']\)/);
  assert.match(pages, /["']Financeiro["']\s*:\s*Financeiro/);
});
