import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  buildFinanceiroQueryScopeKey,
  buildFinanceiroTitulosScopeSwitchReset,
  canViewFinanceLaunchpadModule,
} from '../src/components/financeiro/financeiroLaunchpadAccess.js';
import {
  buildCadastroScopeSwitchReset,
  buildMultiempresaQueryScopeKey,
} from '../src/components/lib/contextoMultiempresaPolicy.js';

/**
 * UX Cadastros ↔ Financeiro ↔ troca de empresa (pós-deploy).
 * Espelha o padrão Cadastros (#239) no launchpad/títulos Financeiro.
 */

test('scopeKey Financeiro ≡ Cadastros (grupo:empresa); CPA≠3Z', () => {
  const cpa = { groupId: 'grupo-cpa', empresaId: 'empresa-cpa' };
  const z = { groupId: 'grupo-cpa', empresaId: 'empresa-3z' };
  assert.equal(buildFinanceiroQueryScopeKey(cpa), buildMultiempresaQueryScopeKey(cpa));
  assert.notEqual(buildFinanceiroQueryScopeKey(cpa), buildFinanceiroQueryScopeKey(z));
  assert.equal(buildFinanceiroQueryScopeKey({}), 'sem-contexto');
});

test('reset títulos: seleção residual de empresa A não sobrevive à troca', () => {
  const dirtyIds = ['cr-cpa-1', 'cr-cpa-2'];
  // Simula estado sujo da empresa A; reset deve devolver array novo vazio.
  const receber = buildFinanceiroTitulosScopeSwitchReset('receber');
  const pagar = buildFinanceiroTitulosScopeSwitchReset('pagar');
  assert.equal(receber.contasSelecionadas.length, 0);
  assert.equal(pagar.contasSelecionadas.length, 0);
  assert.notEqual(receber.contasSelecionadas, dirtyIds);
  assert.equal(receber.dialogBaixaOpen, false);
  assert.equal(pagar.dialogBaixaOpen, false);
  assert.equal(receber.contaParaCobranca, null);
  assert.equal(pagar.dadosBaixa.valor_pago, 0);
});

test('Cadastros e Financeiro compartilham política de não rascunho cross-tenant', () => {
  const cadastro = buildCadastroScopeSwitchReset({ formKey: 2, showForm: true });
  const fin = buildFinanceiroTitulosScopeSwitchReset('receber');
  assert.equal(cadastro.showForm, false);
  assert.equal(cadastro.selectedIds.size, 0);
  assert.equal(fin.contasSelecionadas.length, 0);
  assert.equal(fin.dialogBaixaOpen, false);
});

test('fail-closed: sem permissão Financeiro não libera card mesmo com scope válido', () => {
  const deny = () => false;
  assert.equal(canViewFinanceLaunchpadModule(deny, { title: 'Contas a Receber' }), false);
  assert.equal(canViewFinanceLaunchpadModule(null, { title: 'Contas a Pagar' }), false);
});

test('wire: Financeiro + tabs usam scope canônico e reset na troca', async () => {
  const fin = await readFile(new URL('../src/pages/Financeiro.jsx', import.meta.url), 'utf8');
  const receber = await readFile(new URL('../src/components/financeiro/ContasReceberTab.jsx', import.meta.url), 'utf8');
  const pagar = await readFile(new URL('../src/components/financeiro/ContasPagarTab.jsx', import.meta.url), 'utf8');
  const viz = await readFile(new URL('../src/components/cadastros/VisualizadorUniversalEntidadeV24.jsx', import.meta.url), 'utf8');
  const caixa = await readFile(new URL('../src/components/financeiro/CaixaCentralLiquidacao.jsx', import.meta.url), 'utf8');
  const cartoes = await readFile(new URL('../src/components/financeiro/CartoesACompensar.jsx', import.meta.url), 'utf8');
  const concil = await readFile(new URL('../src/components/financeiro/ConciliacaoBancariaTab.jsx', import.meta.url), 'utf8');
  const lote = await readFile(new URL('../src/components/financeiro/LiquidacaoEmLote.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.match(fin, /buildFinanceiroQueryScopeKey/);
  assert.match(fin, /uniqueKey:.*contextKey/);
  assert.match(fin, /Selecione um grupo ou empresa/);
  assert.match(receber, /buildFinanceiroTitulosScopeSwitchReset\(['"]receber['"]\)/);
  assert.match(pagar, /buildFinanceiroTitulosScopeSwitchReset\(['"]pagar['"]\)/);
  assert.match(viz, /buildCadastroScopeSwitchReset/);
  assert.match(caixa, /buildFinanceiroQueryScopeKey/);
  assert.match(cartoes, /buildFinanceiroQueryScopeKey/);
  assert.match(concil, /setContaSelecionadaId\(""\)/);
  assert.match(lote, /queryKey:\s*\['liquidacao-lote',\s*scopeKey/);
  assert.match(app, /Entrar no ERP/);
});
