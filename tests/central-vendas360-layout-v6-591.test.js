/**
 * #591 — Central de Vendas360° layout versão 6 (decisão 10/11).
 * Sem central paralela: Pedidos → shell; Orçamentos embutido.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CENTRAL_VENDAS360_COLUMNS,
  CENTRAL_VENDAS360_DEFAULT_SITUACAO,
  CENTRAL_VENDAS360_SITUACOES,
  CENTRAL_VENDAS360_TITLE,
  isCentralVendas360Module,
  partitionCentralItens,
  sumCentralPesoKg,
} from '../src/components/comercial/centralVendas360Layout.js';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

test('contrato visual v6: 12 colunas na ordem aprovada', () => {
  assert.equal(CENTRAL_VENDAS360_COLUMNS.length, 12);
  assert.deepEqual(CENTRAL_VENDAS360_COLUMNS.map((c) => c.label), [
    'Nº Orçamento',
    'Data',
    'Cod Cliente',
    'Nome Cliente',
    'Origem',
    'Nome Vendedor',
    'Peso',
    'Valor',
    'Cidade',
    'Condição Pagamento',
    'Situação',
    'Prazo',
  ]);
  assert.equal(CENTRAL_VENDAS360_DEFAULT_SITUACAO, 'ORCAMENTOS_ABERTOS');
  assert.ok(CENTRAL_VENDAS360_SITUACOES.some((s) => s.id === 'VENCIDOS'));
  assert.match(CENTRAL_VENDAS360_TITLE, /Central de Vendas360/);
});

test('partitionCentralItens: grades simultâneas sem inventar tipo', () => {
  const { corte, revenda } = partitionCentralItens([
    { id: '1', requer_producao: true, descricao: 'Vergalhão' },
    { id: '2', tipo: 'Corte e Dobra', descricao: 'Chapa' },
    { id: '3', descricao: 'Parafuso' },
  ]);
  assert.equal(corte.length, 2);
  assert.equal(revenda.length, 1);
  assert.equal(sumCentralPesoKg([{ peso_kg: 10 }, { peso: 2.5 }]), 12.5);
  assert.equal(sumCentralPesoKg([{ descricao: 'sem peso' }]), null);
});

test('isCentralVendas360Module: tile Central liberado na proposta', () => {
  assert.equal(isCentralVendas360Module({ title: 'Central de Vendas360°', sectionKey: 'pedido' }), true);
  assert.equal(isCentralVendas360Module({ title: 'Orçamentos', sectionKey: 'orcamento' }), true);
  assert.equal(isCentralVendas360Module({ title: 'Comissões', sectionKey: 'Comissoes' }), false);
});

test('Comercial: Pedidos vira Central; tile Orçamentos retirado; sem paralelo', () => {
  const src = read('src/pages/Comercial.jsx');
  assert.match(src, /title: 'Central de Vendas360°'/);
  assert.match(src, /accessKeys: \['pedido', 'orcamento'\]/);
  assert.match(src, /proposalMode: propostaIntegrada/);
  assert.match(src, /Central de Vendas360° \(orçamentos\)/);
  assert.doesNotMatch(src, /title: 'Orçamentos'/);
  assert.doesNotMatch(src, /title: 'Pedidos'/);
  assert.doesNotMatch(src, /OrcamentosV2|CentralVendas360Nova|OrcamentosNovo/);
  assert.match(src, /OrcamentosTab permanece canônico embutido/);
});

test('PedidosTab: canonicalHttp monta CentralVendas360Shell (não painel solto)', () => {
  const src = read('src/components/comercial/PedidosTab.jsx');
  assert.match(src, /CentralVendas360Shell/);
  assert.match(src, /canonicalHttp\) return <CentralVendas360Shell/);
  assert.doesNotMatch(src, /canonicalHttp\) return <PedidoCanonicoPanel/);
});

test('CentralVendas360Shell: faixa, situações, grades dual, Cliente360', () => {
  const src = read('src/components/comercial/CentralVendas360Shell.jsx');
  assert.match(src, /data-layout="versao6"/);
  assert.match(src, /central360-faixa-compacta/);
  assert.match(src, /central360-situacoes/);
  assert.match(src, /central360-grades-simultaneas/);
  assert.match(src, /central360-grade-corte/);
  assert.match(src, /central360-grade-revenda/);
  assert.match(src, /CentralCliente360Panel/);
  assert.match(src, /OrcamentosTab/);
  assert.match(src, /PedidoCanonicoPanel/);
  assert.match(src, /Atendimento Unificado/);
  assert.match(src, /Bot Vendas/);
  assert.match(src, /Entregas do Dia/);
  assert.match(src, /Aprovações pendentes/);
  assert.doesNotMatch(src, /CentralVendas360Nova|OrcamentosV2/);
});

test('OrcamentosTab: tabela 12 colunas no centralLayout; seleção sem gravação', () => {
  const src = read('src/components/comercial/OrcamentosTab.jsx');
  assert.match(src, /centralLayout/);
  assert.match(src, /central360-tabela-12/);
  assert.match(src, /CENTRAL_VENDAS360_COLUMNS/);
  assert.match(src, /onDoubleClick/);
  assert.match(src, /notifyCentralSelect/);
  assert.match(src, /Validade do orçamento \(≠ prazo de entrega\)/);
});

test('ModulosGridComercial: proposta libera Central (não só título Orçamentos)', () => {
  const grid = read('src/components/comercial/comercial-launchpad/ModulosGridComercial.jsx');
  assert.match(grid, /isCentralVendas360Module/);
  assert.match(grid, /Central de Vendas360°/);
  assert.match(grid, /liberatedByProposal/);
  assert.doesNotMatch(grid, /function isOrcamentosModule/);
});
