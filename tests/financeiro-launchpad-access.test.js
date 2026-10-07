import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  canViewFinanceLaunchpadModule,
  FINANCEIRO_LAUNCHPAD_MODULE_TITLES,
} from '../src/components/financeiro/financeiroLaunchpadAccess.js';

/** Espelha a semântica de usePermissions: sem seção, caminha a árvore; com seção, exige o nó. */
function makeHasPermission(tree) {
  const nodeHasAction = (node, desired) => {
    if (Array.isArray(node)) return node.includes(desired) || (desired === 'visualizar' && node.includes('ver'));
    if (!node || typeof node !== 'object') return false;
    const stack = [node];
    while (stack.length) {
      const current = stack.pop();
      if (Array.isArray(current)) {
        if (current.includes(desired) || (desired === 'visualizar' && current.includes('ver'))) return true;
      } else if (current && typeof current === 'object') {
        Object.values(current).forEach((value) => stack.push(value));
      }
    }
    return false;
  };

  return (module, section, action = 'visualizar') => {
    if (module !== 'Financeiro') return false;
    const desired = action === 'ver' ? 'visualizar' : action;
    const mod = tree.Financeiro;
    if (!mod) return false;
    if (!section) return nodeHasAction(mod, desired);
    const sec = mod[section];
    if (sec == null) return false;
    return nodeHasAction(sec, desired);
  };
}

test('grant plano no módulo (array) libera todos os cards do launchpad', () => {
  const has = makeHasPermission({ Financeiro: ['visualizar'] });
  for (const title of FINANCEIRO_LAUNCHPAD_MODULE_TITLES) {
    assert.equal(canViewFinanceLaunchpadModule(has, { title }), true, title);
  }
});

test('árvore granular libera só as seções concedidas', () => {
  const has = makeHasPermission({
    Financeiro: {
      'Contas a Receber': ['visualizar'],
      'Contas a Pagar': ['visualizar'],
    },
  });
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Contas a Receber' }), true);
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Contas a Pagar' }), true);
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Caixa Central' }), false);
});

test('sem permissão Financeiro bloqueia (fail-closed)', () => {
  const has = makeHasPermission({});
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Caixa Central' }), false);
  assert.equal(canViewFinanceLaunchpadModule(null, { title: 'Caixa Central' }), false);
});

test('Financeiro.jsx usa helper e ModuleTabs com moduleName para esconder abas vazias', async () => {
  const source = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  assert.match(source, /canViewFinanceLaunchpadModule/);
  assert.match(source, /from ["']@\/components\/financeiro\/financeiroLaunchpadAccess["']/);
  assert.match(source, /<ModuleTabs[\s\S]*moduleName=["']Financeiro["']/);
});
