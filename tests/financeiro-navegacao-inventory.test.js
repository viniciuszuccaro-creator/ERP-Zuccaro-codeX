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

test('Consultas do launchpad usam contextKey grupo:empresa e filtro multiempresa', async () => {
  const source = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  assert.match(source, /buildFinanceiroQueryScopeKey/);
  assert.match(source, /contextKey = buildFinanceiroQueryScopeKey\(/);
  assert.match(source, /enabled:\s*canSeeFinanceiro && contextoValido/);
  assert.match(source, /!contextoValido/);
  assert.match(source, /Selecione um grupo ou empresa/);
  assert.match(source, /uniqueKey:.*\$\{contextKey\}/);
  for (const key of [
    'contasReceber',
    'contas-receber-count',
    'contasPagar',
    'contas-pagar-count',
    'rateios',
    'extratos',
    'configs-gateway',
    'caixa-ordens-liquidacao',
    'pedidos-pendentes-aprovacao',
  ]) {
    assert.match(source, new RegExp(`queryKey:\\s*\\[['"]${key}['"],\\s*contextKey\\]`));
  }
  assert.match(source, /filtrarPorContexto\(/);
  assert.match(source, /getFiltroContexto\(/);
  assert.match(source, /group_id:\s*groupId/);
});
