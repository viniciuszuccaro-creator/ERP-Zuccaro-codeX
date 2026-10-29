import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

async function loadHelpers() {
  const src = await readFile(new URL('../src/components/comercial/ValidadorEstoquePedido.jsx', import.meta.url), 'utf8');
  const start = src.indexOf('export function estoqueLiquidoDisponivel');
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
  vm.runInNewContext(`${outputText}\nmodule.exports = { estoqueLiquidoDisponivel, avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque };`, sandbox, {
    filename: 'ValidadorEstoquePedido.helpers.js',
  });
  return sandbox.module.exports;
}

test('estoqueLiquidoDisponivel: atual − reservado, nunca negativo', async () => {
  const { estoqueLiquidoDisponivel } = await loadHelpers();
  assert.equal(estoqueLiquidoDisponivel({ estoque_atual: 10, estoque_reservado: 3 }), 7);
  assert.equal(estoqueLiquidoDisponivel({ estoque_atual: 2, estoque_reservado: 5 }), 0);
  assert.equal(estoqueLiquidoDisponivel({ estoque_atual: 4 }), 4);
  assert.equal(estoqueLiquidoDisponivel(null), 0);
});

test('avaliarDisponibilidadeLinhasEstoque: bloqueia quando reservado consome o saldo', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  const produtos = [
    { id: 'p1', estoque_atual: 10, estoque_reservado: 8 },
    { id: 'p2', estoque_atual: 5, estoque_reservado: 0 },
  ];
  const ok = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'p2', quantidade: 5, descricao: 'Ok' }],
    produtos,
  );
  assert.equal(resumoDisponibilidadeEstoque(ok).todosDisponiveis, true);

  const fail = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'p1', quantidade: 3, descricao: 'Reservado' }],
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
    [{ produto_id: 'outro-tenant', quantidade: 1 }],
    [{ id: 'p-local', estoque_atual: 99, estoque_reservado: 0 }],
  );
  assert.equal(rows[0].produtoAusente, true);
  assert.equal(rows[0].disponivel, false);
  assert.equal(resumoDisponibilidadeEstoque(rows).algumIndisponivel, true);
});

test('P2 #4410761988: agrega demanda do mesmo produto nas linhas', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  const produtos = [{ id: 'p1', estoque_atual: 10, estoque_reservado: 0 }];
  const rows = avaliarDisponibilidadeLinhasEstoque(
    [
      { produto_id: 'p1', quantidade: 6, descricao: 'L1' },
      { produto_id: 'p1', quantidade: 6, descricao: 'L2' },
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

test('P1 #4410814402: sem fonte local autoritativa não bloqueia como estoque insuficiente', async () => {
  const { avaliarDisponibilidadeLinhasEstoque, resumoDisponibilidadeEstoque } = await loadHelpers();
  const rows = avaliarDisponibilidadeLinhasEstoque(
    [{ produto_id: 'http-only', quantidade: 5, descricao: 'Canônico' }],
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

test('OrcamentosTab: conversão usa ValidadorEstoque e bloqueia submit sem estoque autoritativo', async () => {
  const src = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  assert.match(src, /ValidadorEstoquePedido/);
  assert.match(src, /conversionStockOk/);
  assert.match(src, /Estoque insuficiente ou indisponível/);
  assert.match(src, /disabled=\{submitting \|\| !conversionStockOk\}/);
  assert.match(src, /fontePronta/);
});

test('ValidadorEstoquePedido: HTTP advisory não consulta store local como autoritativo', async () => {
  const src = await readFile(new URL('../src/components/comercial/ValidadorEstoquePedido.jsx', import.meta.url), 'utf8');
  assert.match(src, /resolveErpBackendMode/);
  assert.match(src, /fonteLocalAutoritativa/);
  assert.match(src, /http-advisory|http-sem-fonte-operacional/);
  assert.match(src, /demandaAcumulada/);
});
