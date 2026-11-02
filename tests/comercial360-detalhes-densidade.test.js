/**
 * C360 residual: DetalhesCliente aproxima identificação, contatos e KPIs
 * na área existente (sem novo Comercial 360). Preserva histórico/produtos.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const path = 'src/components/comercial/DetalhesCliente.jsx';

test('DetalhesCliente: identificação + contatos + KPIs no header sky (sem duplicar Central)', () => {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /from-sky-50/);
  assert.match(source, /to-sky-100/);
  assert.match(source, /data-action="cliente-360-identificacao"/);
  assert.match(source, /data-action="cliente-360-contatos"/);
  assert.match(source, /data-action="cliente-360-kpis"/);
  assert.match(source, /data-action="codigo-registro-cliente-360"/);
  assert.match(source, /data-action="id-tecnico-cliente-360"/);
  assert.match(source, /CentralCliente360Panel/);
  assert.match(source, /HistoricoProdutosCliente/);
  assert.match(source, /HistoricoComprasCliente/);
  assert.match(source, /Top10ProdutosCliente/);
  assert.match(source, /HistoricoOrigemCliente/);
  // KPIs sobem ao header — não ficam em CardContent aninhados separados do sky
  const headerIdx = source.indexOf('from-sky-50');
  const kpiIdx = source.indexOf('data-action="cliente-360-kpis"');
  const centralIdx = source.indexOf('<CentralCliente360Panel');
  assert.ok(headerIdx >= 0 && kpiIdx > headerIdx && centralIdx > kpiIdx);
});

test('DetalhesCliente: condição/tabela/forma/crédito no header (registro existente, sem fetch paralelo)', () => {
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /data-action="cliente-360-condicao-comercial"/);
  assert.match(source, /data-action="cliente-360-condicao-pagamento"/);
  assert.match(source, /data-action="cliente-360-tabela-preco"/);
  assert.match(source, /data-action="cliente-360-forma-pagamento"/);
  assert.match(source, /data-action="cliente-360-situacao-credito"/);
  assert.match(source, /condicao_comercial/);
  assert.match(source, /Não informada/);
  // Sem segundo store/API de mestres neste detalhe
  assert.doesNotMatch(source, /entities\.TabelaPreco|entities\.FormaPagamento|filterInContext\(\s*["']TabelaPreco/);
  const contatosIdx = source.indexOf('data-action="cliente-360-contatos"');
  const condicaoIdx = source.indexOf('data-action="cliente-360-condicao-comercial"');
  const kpiIdx = source.indexOf('data-action="cliente-360-kpis"');
  assert.ok(contatosIdx >= 0 && condicaoIdx > contatosIdx && kpiIdx > condicaoIdx);
});
