import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

async function loadHelpers() {
  const src = await readFile(new URL('../src/components/comercial/ValidadorEstoquePedido.jsx', import.meta.url), 'utf8');
  const start = src.indexOf('export function chaveDemandaEstoqueLinha');
  const end = src.indexOf('export default function ValidadorEstoquePedido');
  assert.ok(start >= 0 && end > start, 'helpers exportados no ValidadorEstoquePedido');
  const chunk = src
    .slice(start, end)
    .replace(/export function/g, 'function');
  const { outputText } = ts.transpileModule(chunk, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const sandbox = { module: { exports: {} }, exports: {}, console };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(`${outputText}\nmodule.exports = { chaveDemandaEstoqueLinha, estoqueLiquidoDisponivel, avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque };`, sandbox, {
    filename: 'ValidadorEstoquePedido.helpers.js',
  });
  return sandbox.module.exports;
}

test('estoqueLiquidoDisponivel: atual − reservado quando conhecido; ausência ≠ zero', async () => {
  const { estoqueLiquidoDisponivel } = await loadHelpers();
  assert.equal(estoqueLiquidoDisponivel({ estoque_atual: 10, estoque_reservado: 3 }), 7);
  assert.equal(estoqueLiquidoDisponivel({ estoque_atual: 2, estoque_reservado: 5 }), 0);
  assert.equal(estoqueLiquidoDisponivel({ estoque_atual: 4 }), 4);
  assert.equal(estoqueLiquidoDisponivel({ estoque_atual: 0, estoque_reservado: 0 }), 0, 'zero explícito permanece zero');
  // ANTES (bug): Number(undefined??0) → 0 “sem estoque”. DEPOIS: null = DESCONHECIDO.
  assert.equal(estoqueLiquidoDisponivel(null), null);
  assert.equal(estoqueLiquidoDisponivel({ id: 'master-http', nome: 'Sem saldo no DTO' }), null);
  assert.equal(estoqueLiquidoDisponivel({ estoque_reservado: 2 }), null, 'só reservado sem atual ≠ inventar');
});

test('avaliarDisponibilidadeLinhasEstoque: bloqueia quando reservado consome o saldo', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  const produtos = [
    { id: 'p1', estoque_atual: 10, estoque_reservado: 8 },
    { id: 'p2', estoque_atual: 5, estoque_reservado: 0 },
  ];
  const ok = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'p2', quantidade: 5, descricao: 'Ok', unidade_sigla: 'UN' }],
    produtos,
  );
  assert.equal(resumoDisponibilidadeEstoque(ok).todosDisponiveis, true);

  const fail = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'p1', quantidade: 3, descricao: 'Reservado', unidade_sigla: 'UN' }],
    produtos,
  );
  assert.equal(fail[0].disponivelLiquido, 2);
  assert.equal(fail[0].disponivel, false);
  assert.equal(fail[0].falta, 1);
  assert.equal(resumoDisponibilidadeEstoque(fail).algumIndisponivel, true);
});

test('avaliarDisponibilidadeLinhasEstoque: produto fora do escopo / empresa ≠ fail-closed', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  const rows = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'outro-tenant', quantidade: 1, unidade_sigla: 'UN' }],
    [{ id: 'p-local', estoque_atual: 99, estoque_reservado: 0 }],
  );
  assert.equal(rows[0].produtoAusente, true);
  assert.equal(rows[0].disponivel, false);
  assert.equal(resumoDisponibilidadeEstoque(rows).algumIndisponivel, true);
});

test('P2 #4410761988: agrega demanda do mesmo produto+unidade nas linhas', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  const produtos = [{ id: 'p1', estoque_atual: 10, estoque_reservado: 0 }];
  // ANTES: duas linhas 6+6 com saldo 10 → ambas “disponíveis” / todosDisponiveis true.
  // DEPOIS: 2ª linha consome saldo já usado pela 1ª.
  const rows = avaliarDisponibilidadeLinhasEstoque(
    [
      { produto_id: 'p1', quantidade: 6, descricao: 'L1', unidade_sigla: 'UN' },
      { produto_id: 'p1', quantidade: 6, descricao: 'L2', unidade_sigla: 'UN' },
    ],
    produtos,
  );
  assert.equal(rows[0].disponivel, true);
  assert.equal(rows[0].disponivelLiquido, 10);
  assert.equal(rows[1].disponivel, false, '2ª linha consome saldo já usado pela 1ª');
  assert.equal(rows[1].disponivelLiquido, 4);
  assert.equal(rows[1].falta, 2);
  assert.equal(resumoDisponibilidadeEstoque(rows).todosDisponiveis, false);
  assert.equal(resumoDisponibilidadeEstoque(rows).algumIndisponivel, true);
});

test('unidades distintas do mesmo produto: incompatível sem conversão inventada', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque, chaveDemandaEstoqueLinha } = await loadHelpers();
  assert.notEqual(
    chaveDemandaEstoqueLinha({ produto_id: 'p1', unidade_sigla: 'UN' }),
    chaveDemandaEstoqueLinha({ produto_id: 'p1', unidade_sigla: 'CX' }),
  );
  const produtos = [{ id: 'p1', estoque_atual: 100, estoque_reservado: 0 }];
  const rows = avaliarDisponibilidadeLinhasEstoque(
    [
      { produto_id: 'p1', quantidade: 2, unidade_sigla: 'UN' },
      { produto_id: 'p1', quantidade: 2, unidade_sigla: 'CX' },
    ],
    produtos,
  );
  assert.equal(rows.every((r) => r.unidadeIncompativel), true);
  assert.equal(rows.every((r) => r.fonteIndisponivel), true);
  assert.equal(rows.every((r) => r.disponivelLiquido == null), true, 'não inventa saldo convertido');
  const resumo = resumoDisponibilidadeEstoque(rows);
  assert.equal(resumo.unidadeIncompativel, true);
  assert.equal(resumo.fontePronta, false);
  assert.equal(resumo.todosDisponiveis, false, 'não declara estoque OK');
  assert.equal(resumo.algumIndisponivel, false, 'incompatível ≠ estoque insuficiente numérico');
});

test('P1 #4410814402 / parecer 6493809228: DTO sem estoque_atual → DESCONHECIDO ≠ zero', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  // Master HTTP tipicamente sem campos de saldo (mapProduto).
  const rows = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'http-only', quantidade: 5, descricao: 'Canônico', unidade_sigla: 'UN' }],
    [{ id: 'http-only', nome: 'Produto master sem saldo' }],
    { fonteLocalAutoritativa: true },
  );
  assert.equal(rows[0].saldoDesconhecido, true);
  assert.equal(rows[0].fonteIndisponivel, true);
  assert.equal(rows[0].estoqueAtual, null);
  assert.equal(rows[0].disponivelLiquido, null);
  assert.equal(rows[0].disponivel, false);
  const resumo = resumoDisponibilidadeEstoque(rows);
  assert.equal(resumo.saldoDesconhecido, true);
  assert.equal(resumo.fontePronta, false);
  assert.equal(resumo.algumIndisponivel, false, 'ausência de saldo ≠ estoque insuficiente');
  assert.equal(resumo.todosDisponiveis, false, 'não declara estoque suficiente');
});

test('P1 #4410814402: sem fonte local autoritativa (HTTP) não bloqueia como estoque insuficiente', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  const rows = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'http-only', quantidade: 5, descricao: 'Canônico', unidade_sigla: 'UN' }],
    [],
    { fonteLocalAutoritativa: false },
  );
  assert.equal(rows[0].fonteIndisponivel, true);
  assert.equal(rows[0].disponivel, false);
  const resumo = resumoDisponibilidadeEstoque(rows);
  assert.equal(resumo.fontePronta, false);
  assert.equal(resumo.fonteIndisponivel, true);
  assert.equal(resumo.algumIndisponivel, false, 'ausência de fonte ≠ estoque insuficiente');
});

test('OrcamentosTab: conversão usa ValidadorEstoque e distingue fontePronta de insuficiente', async () => {
  const src = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(src, /ValidadorEstoquePedido/);
  assert.match(src, /conversionStockOk/);
  assert.match(src, /Estoque insuficiente ou indisponível/);
  assert.match(src, /disabled=\{submitting \|\| !conversionStockOk\}/);
  assert.match(src, /fontePronta/);
  assert.match(src, /fontePronta === false \? true/);
});

test('ValidadorEstoquePedido: HTTP advisory + saldo desconhecido + unidade no UI', async () => {
  const src = await readFile(new URL('../src/components/comercial/ValidadorEstoquePedido.jsx', import.meta.url), 'utf8');
  assert.match(src, /resolveErpBackendMode/);
  assert.match(src, /fonteLocalAutoritativa/);
  assert.match(src, /demandaAcumulada/);
  assert.match(src, /chaveDemandaEstoqueLinha/);
  assert.match(src, /saldoDesconhecido/);
  assert.match(src, /unidadeIncompativel/);
  assert.match(src, /Saldo desconhecido/);
  assert.match(src, /Unidade incompatível/);
  assert.doesNotMatch(src, /estoque_atual \?\? 0/);
  assert.doesNotMatch(src, /estoque_atual \|\| 0/);
});
