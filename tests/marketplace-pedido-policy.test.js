import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createMarketplaceSimulationOrders } from '../src/components/integracoes/marketplaceSimulationData.js';
import {
  applyMarketplaceCreate,
  applyStatusExternoMarketplace,
  assertMarketplaceAtivo,
  assertPedidoExternoImportavel,
  assertPedidoExternoOnCreate,
  assertPedidoMarketplaceOnCreate,
  buildConciliacaoResumo,
  buildErpPedidoFromExterno,
  filtrarPedidosSimuladosAtivos,
  isMarketplaceAtivo,
  resolveSkuMarketplace,
  stampPedidoExternoSimulacao,
} from '../src/components/lib/marketplacePedidoPolicy.js';

test('pedido externo exige empresa, marketplace e id externo', () => {
  assert.throws(
    () => assertPedidoExternoOnCreate({ record: { origem: 'Mercado Livre', id_externo: 'ML-1' }, pedidosExternos: [] }),
    /Empresa obrigatoria/,
  );
  assert.throws(
    () => assertPedidoExternoOnCreate({ record: { empresa_id: 'e1', origem: 'Mercado Livre' }, pedidosExternos: [] }),
    /Identificador externo/,
  );
});

test('retry do mesmo id externo reusa pedido e pedido externo', () => {
  const externo = assertPedidoExternoOnCreate({
    record: { empresa_id: 'e1', origem: 'Shopee', id_externo: 'SH-1' },
    pedidosExternos: [{ id: 'px-1', empresa_id: 'e1', id_externo: 'SH-1' }],
  });
  assert.equal(externo.reuse.id, 'px-1');

  const pedido = assertPedidoMarketplaceOnCreate({
    record: { empresa_id: 'e1', origem_pedido: 'Mercado Livre', origem_externa_id: 'ML-1' },
    pedidos: [{ id: 'p-1', empresa_id: 'e1', origem_externa_id: 'ML-1' }],
  });
  assert.equal(pedido.reuse.id, 'p-1');
});

test('pedido interno sem marketplace nao e carimbado', () => {
  const decision = applyMarketplaceCreate('Pedido', { empresa_id: 'e1', origem_pedido: 'Manual' }, { pedidos: [] });
  assert.equal(decision.reuse, null);
  assert.equal(decision.record.origem_pedido, 'Manual');
  assert.equal(decision.record.marketplace, undefined);
});

test('importacao carimba marketplace, sku e conciliacao', () => {
  const payload = buildErpPedidoFromExterno({
    origem: 'Amazon',
    id_externo: 'AZ-99',
    numero_pedido_externo: '9',
    cliente_nome: 'Ana',
    itens: [{ sku_externo: 'VIGA-300', descricao: 'Viga', quantidade: 1, preco_unitario: 10, valor_total: 10 }],
    valor_produtos: 10,
    valor_frete: 0,
    valor_total: 10,
    comissao_marketplace: 1,
    taxa_marketplace: 0.5,
  }, { produtos: [{ id: 'prod-1', codigo: 'VIGA-300' }] });
  assert.equal(payload.marketplace, 'Amazon');
  assert.equal(payload.origem_pedido, 'Amazon');
  assert.equal(payload.origem_externa_id, 'AZ-99');
  assert.equal(payload.numero_pedido, undefined);
  assert.equal(payload.itens_revenda[0].produto_id, 'prod-1');
  assert.equal(payload.valor_liquido_estimado, 8.5);
  assert.match(payload.referencia_conciliacao, /mkt\|Amazon\|AZ-99/);
});

test('config inativa ou ausente bloqueia canal e status cancel/return sao idempotentes', () => {
  assert.equal(isMarketplaceAtivo([], 'Shopee'), false);
  assert.equal(isMarketplaceAtivo([{ nome: 'Mercado Livre', ativo: true }], 'Shopee'), false);
  assert.equal(isMarketplaceAtivo([{ nome: 'Shopee', ativo: false }], 'Shopee'), false);
  assert.throws(() => assertMarketplaceAtivo({ configs: [{ nome: 'Shopee', ativo: false }], origem: 'Shopee' }), /inativo/);
  assert.throws(() => assertMarketplaceAtivo({ configs: [], origem: 'Shopee' }), /inativo/);
  const ativos = filtrarPedidosSimuladosAtivos(createMarketplaceSimulationOrders(), [
    { nome: 'Mercado Livre', ativo: true },
    { nome: 'Shopee', ativo: false },
    { nome: 'Amazon', ativo: true },
  ]);
  assert.deepEqual(ativos.map((item) => item.origem).sort(), ['Amazon', 'Mercado Livre']);

  const sku = resolveSkuMarketplace({ sku_externo: 'BLOCO-2040' }, [{ id: 'p2', codigo: 'BLOCO-2040' }]);
  assert.equal(sku.produto_id, 'p2');

  const first = applyStatusExternoMarketplace({
    pedidoExterno: { id: 'px1', id_externo: 'X1', status_externo: 'payment_approved' },
    acao: 'cancelar',
  });
  assert.equal(first.reuse, false);
  assert.equal(first.patch.status_importacao, 'Cancelado');
  const again = applyStatusExternoMarketplace({
    pedidoExterno: { id: 'px1', id_externo: 'X1', ...first.patch },
    acao: 'cancelar',
  });
  assert.equal(again.reuse, true);
  assert.equal(buildConciliacaoResumo({ valor_total: 100, comissao_marketplace: 10, taxa_marketplace: 5 }).valor_liquido_estimado, 85);
});

test('importacao exige itens com sku resolvido e nao marca conciliado', () => {
  assert.throws(
    () => buildErpPedidoFromExterno({
      origem: 'Shopee',
      id_externo: 'SH-2',
      itens: [],
      valor_total: 10,
    }),
    /Itens obrigatorios/,
  );
  assert.throws(
    () => buildErpPedidoFromExterno({
      origem: 'Shopee',
      id_externo: 'SH-2',
      itens: [{ sku_externo: 'DESCONHECIDO', descricao: 'X', quantidade: 1, preco_unitario: 10, valor_total: 10 }],
      valor_total: 10,
    }, { produtos: [{ id: 'p1', codigo: 'OUTRO' }] }),
    /SKU nao resolvido/,
  );
  const ok = buildErpPedidoFromExterno({
    origem: 'Amazon',
    id_externo: 'AZ-1',
    itens: [{ sku_externo: 'VIGA-300', descricao: 'Viga', quantidade: 1, preco_unitario: 10, valor_total: 10 }],
    valor_total: 10,
    comissao_marketplace: 1,
  }, { produtos: [{ id: 'prod-1', codigo: 'VIGA-300' }] });
  assert.equal(ok.conciliado, false);
});

test('simulacao e telas existentes deixam de inventar id e numero', async () => {
  const sim = createMarketplaceSimulationOrders();
  assert.equal(sim[0].id_externo, 'ML-SIM-001');
  assert.ok(sim.some((item) => item.status_externo === 'cancelled'));
  assert.doesNotMatch(JSON.stringify(sim), /Date\.now|Math\.random/);
  const stamped = stampPedidoExternoSimulacao({ ...sim[0], empresa_id: 'e1' });
  assert.equal(stamped.simulacao, true);
  assert.throws(() => assertPedidoExternoImportavel(stamped), /simulado/);

  const ativa = await readFile(new URL('../src/components/integracoes/SincronizacaoMarketplacesAtiva.jsx', import.meta.url), 'utf8');
  const sync = await readFile(new URL('../src/components/integracoes/SincronizacaoMarketplaces.jsx', import.meta.url), 'utf8');
  const comercial = await readFile(new URL('../src/components/comercial/ValidarPedidosExternos.jsx', import.meta.url), 'utf8');
  const config = await readFile(new URL('../src/components/cadastros/ConfiguracaoIntegracaoForm.jsx', import.meta.url), 'utf8');
  const webhook = await readFile(new URL('../base44/functions/legacyIntegrationsMirror/entry.ts', import.meta.url), 'utf8');
  assert.match(ativa, /buildErpPedidoFromExterno/);
  assert.match(ativa, /filtrarPedidosSimuladosAtivos/);
  assert.match(ativa, /applyStatusExternoMarketplace/);
  assert.match(ativa, /assertItensMarketplaceParaImport/);
  assert.match(ativa, /assertPedidoExternoImportavel/);
  assert.match(ativa, /stampPedidoExternoSimulacao/);
  assert.match(ativa, /origem_cadastro: 'marketplace'/);
  assert.match(ativa, /throw error/);
  assert.doesNotMatch(ativa, /console\.warn\('Falha ao auditar marketplace:/);
  assert.match(ativa, /reutilizado por identificador externo/);
  assert.doesNotMatch(ativa, /substring\(0, 3\)/);
  assert.match(sync, /assertMarketplaceAtivo/);
  assert.match(sync, /applyStatusExternoMarketplace/);
  assert.match(sync, /createMarketplaceSimulationOrders/);
  assert.match(sync, /stampPedidoExternoSimulacao/);
  assert.match(sync, /throw error/);
  assert.doesNotMatch(sync, /console\.warn\('Falha ao auditar marketplace:/);
  assert.doesNotMatch(sync, /setTimeout\(resolve, 2000\)/);
  assert.match(comercial, /buildErpPedidoFromExterno/);
  assert.match(comercial, /assertMarketplaceAtivo/);
  assert.match(comercial, /groupId && empresaContextoId/);
  assert.match(comercial, /Em Revisão/);
  assert.doesNotMatch(comercial, /catch \(_\) \{\}/);
  assert.doesNotMatch(comercial, /numero_pedido: numero/);
  assert.match(config, /Empresa obrigatoria para configuracao de marketplace/);
  assert.match(webhook, /itens_obrigatorios/);
  assert.match(webhook, /nada_processado/);
  assert.match(webhook, /marketplaceLabel/);
  assert.doesNotMatch(webhook, /origem_pedido: 'Marketplace'/);
});
