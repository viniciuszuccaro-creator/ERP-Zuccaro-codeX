/**
 * ETAPA A — conectar capacidades #441/#442 aos consumidores existentes.
 * PedidoTabsContainer / DetalhesCliente / Painel montam HistoricoCompras + Sugestões + Top10.
 * Adicionar no Pedido muta itens_revenda; leitura em Detalhes/Painel sem callback morto.
 * Frequência histórica ≠ confiança de IA.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (p) => readFileSync(p, 'utf8');

test('PedidoTabsContainer monta HistoricoCompras/Sugestões/Top10 com Adicionar → itens_revenda', () => {
  const src = read('src/components/comercial/pedido/PedidoTabsContainer.jsx');
  assert.match(src, /import HistoricoComprasCliente/);
  assert.match(src, /import SugestoesProdutos/);
  assert.match(src, /import Top10ProdutosCliente/);
  assert.match(src, /data-action="pedido-historico-compras"/);
  assert.match(src, /data-action="pedido-sugestoes-historico"/);
  assert.match(src, /data-action="pedido-top10-produtos"/);
  assert.match(src, /buildItemRevendaFromHistorico/);
  assert.match(src, /itens_revenda:\s*\[\.\.\.\(prev\?\.itens_revenda/);
  assert.match(src, /onAdicionarProduto=\{/);
  assert.match(src, /onSelecionarProduto=\{/);
  // Sem inventar custo/estoque no builder
  assert.doesNotMatch(src, /custo_medio\s*\|\|\s*0/);
  assert.doesNotMatch(src, /estoque_disponivel:\s*produto/);
});

test('DetalhesCliente e Painel montam HistoricoCompras (leitura; sem Adicionar órfão)', () => {
  const detalhes = read('src/components/comercial/DetalhesCliente.jsx');
  const painel = read('src/components/cadastros/PainelDinamicoCliente.jsx');
  assert.match(detalhes, /HistoricoComprasCliente/);
  assert.match(detalhes, /Top10ProdutosCliente/);
  assert.match(detalhes, /data-action="cliente-360-historico-compras"/);
  assert.match(painel, /HistoricoComprasCliente/);
  // Leitura: sem onAdicionarProduto no Detalhes/Painel
  assert.doesNotMatch(detalhes, /onAdicionarProduto=/);
  assert.doesNotMatch(painel, /onAdicionarProduto=/);
});

test('Adicionar só aparece com callback; Sugestões não se apresentam como IA', () => {
  const compras = read('src/components/comercial/HistoricoComprasCliente.jsx');
  const sug = read('src/components/comercial/SugestoesProdutos.jsx');
  assert.match(compras, /typeof onAdicionarProduto === "function"/);
  assert.match(sug, /typeof onAdicionarProduto === "function"/);
  assert.match(sug, /Sugestões pelo histórico/);
  assert.match(sug, /Frequência comprovada/);
  assert.doesNotMatch(sug, /Sugestões Inteligentes/);
  assert.doesNotMatch(sug, /score_confianca/);
  assert.doesNotMatch(sug, /probabilidade/);
});

test('WizardEtapa2Itens usa onAddItem do modal (não onAdd órfão)', () => {
  const src = read('src/components/comercial/wizard/WizardEtapa2Itens.jsx');
  assert.match(src, /onAddItem=\{/);
  assert.doesNotMatch(src, /onAdd=\{/);
});
