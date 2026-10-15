import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  canViewFinanceLaunchpadModule,
  buildFinanceiroQueryScopeKey,
  buildFinanceiroTitulosScopeSwitchReset,
  FINANCEIRO_LAUNCHPAD_MODULE_TITLES,
} from '../src/components/financeiro/financeiroLaunchpadAccess.js';
import { buildMultiempresaQueryScopeKey } from '../src/components/lib/contextoMultiempresaPolicy.js';

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
  // sectionKey canônico + título legado (compat árvore UI)
  assert.equal(canViewFinanceLaunchpadModule(has, {
    title: 'Contas a Receber', sectionKey: 'contas_receber',
  }), true);
});

test('árvore owner canônica (caixa/contas_*) libera cards mapeados', () => {
  const has = makeHasPermission({
    Financeiro: {
      caixa: ['visualizar'],
      contas_receber: ['visualizar'],
    },
  });
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Caixa Central', sectionKey: 'caixa' }), true);
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Contas a Receber', sectionKey: 'contas_receber' }), true);
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Contas a Pagar', sectionKey: 'contas_pagar' }), false);
});

test('sem permissão Financeiro bloqueia (fail-closed)', () => {
  const has = makeHasPermission({});
  assert.equal(canViewFinanceLaunchpadModule(has, { title: 'Caixa Central' }), false);
  assert.equal(canViewFinanceLaunchpadModule(null, { title: 'Caixa Central' }), false);
});

test('Financeiro.jsx usa helper e ModuleTabs com moduleName para esconder abas vazias', async () => {
  const source = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  assert.match(source, /canViewFinanceLaunchpadModule/);
  assert.match(source, /buildFinanceiroQueryScopeKey/);
  assert.match(source, /from ["']@\/components\/financeiro\/financeiroLaunchpadAccess["']/);
  assert.match(source, /<ModuleTabs[\s\S]*moduleName=["']Financeiro["']/);
});

test('buildFinanceiroQueryScopeKey: grupo+empresa e fail-closed sem contexto', () => {
  assert.equal(buildFinanceiroQueryScopeKey({}), 'sem-contexto');
  assert.equal(buildFinanceiroQueryScopeKey({ groupId: 'g1', empresaId: 'e1' }), 'g1:e1');
  assert.equal(buildFinanceiroQueryScopeKey({ groupId: 'g1' }), 'g1:');
  assert.equal(buildFinanceiroQueryScopeKey({ empresaId: 'e1' }), ':e1');
  assert.equal(
    buildFinanceiroQueryScopeKey({ groupId: 'g1', empresaId: 'e1' }),
    buildMultiempresaQueryScopeKey({ groupId: 'g1', empresaId: 'e1' }),
  );
  // Troca CPA → 3Z muda a chave (evita cache residual)
  assert.notEqual(
    buildFinanceiroQueryScopeKey({ groupId: 'grupo-cpa', empresaId: 'cpa' }),
    buildFinanceiroQueryScopeKey({ groupId: 'grupo-cpa', empresaId: '3z' }),
  );
});

test('buildFinanceiroTitulosScopeSwitchReset: zera seleção residual e fecha diálogos (receber)', () => {
  const reset = buildFinanceiroTitulosScopeSwitchReset('receber');
  assert.deepEqual(reset.contasSelecionadas, []);
  assert.equal(reset.contaAtual, null);
  assert.equal(reset.dialogBaixaOpen, false);
  assert.equal(reset.gerarCobrancaDialogOpen, false);
  assert.equal(reset.simularPagamentoDialogOpen, false);
  assert.equal(reset.gerarLinkDialogOpen, false);
  assert.equal(reset.contaParaCobranca, null);
  assert.equal(reset.contaParaSimulacao, null);
  assert.equal(reset.contaParaLink, null);
  assert.equal(reset.dadosBaixa.valor_recebido, 0);
  assert.equal(reset.dadosBaixa.forma_recebimento, 'PIX');
  assert.equal(reset.dadosBaixa.observacoes, '');
  assert.match(String(reset.dadosBaixa.data_recebimento), /^\d{4}-\d{2}-\d{2}$/);
});

test('buildFinanceiroTitulosScopeSwitchReset: zera seleção residual (pagar)', () => {
  const reset = buildFinanceiroTitulosScopeSwitchReset('pagar');
  assert.deepEqual(reset.contasSelecionadas, []);
  assert.equal(reset.contaAtual, null);
  assert.equal(reset.dialogBaixaOpen, false);
  assert.equal(reset.dadosBaixa.valor_pago, 0);
  assert.equal(reset.dadosBaixa.forma_pagamento, 'PIX');
  assert.equal(reset.gerarCobrancaDialogOpen, undefined);
});

test('ContasReceberTab/ContasPagarTab resetam seleção na troca de scopeKey', async () => {
  const receber = await readFile(new URL('../src/components/financeiro/ContasReceberTab.jsx', import.meta.url), 'utf8');
  const pagar = await readFile(new URL('../src/components/financeiro/ContasPagarTab.jsx', import.meta.url), 'utf8');
  for (const source of [receber, pagar]) {
    assert.match(source, /buildFinanceiroQueryScopeKey/);
    assert.match(source, /buildFinanceiroTitulosScopeSwitchReset/);
    assert.match(source, /previousScopeRef/);
    assert.match(source, /setContasSelecionadas\(reset\.contasSelecionadas\)/);
    assert.match(source, /queryKey:\s*\[['"]empresas['"],\s*scopeKey\]/);
  }
  assert.match(receber, /buildFinanceiroTitulosScopeSwitchReset\(['"]receber['"]\)/);
  assert.match(pagar, /buildFinanceiroTitulosScopeSwitchReset\(['"]pagar['"]\)/);
  assert.match(receber, /setGerarCobrancaDialogOpen\(reset\.gerarCobrancaDialogOpen\)/);
});
