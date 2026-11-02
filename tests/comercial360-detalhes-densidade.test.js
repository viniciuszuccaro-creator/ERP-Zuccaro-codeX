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
