import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createMarketplaceSimulationOrders } from '../src/components/integracoes/marketplaceSimulationData.js';
import {
  applyMarketplaceCreate,
  assertPedidoExternoOnCreate,
  assertPedidoMarketplaceOnCreate,
  buildErpPedidoFromExterno,
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

test('importacao carimba marketplace e identificador externo', () => {
  const payload = buildErpPedidoFromExterno({
    origem: 'Amazon',
    id_externo: 'AZ-99',
    numero_pedido_externo: '9',
    cliente_nome: 'Ana',
    itens: [],
    valor_total: 10,
  });
  assert.equal(payload.marketplace, 'Amazon');
  assert.equal(payload.origem_pedido, 'Amazon');
  assert.equal(payload.origem_externa_id, 'AZ-99');
  assert.equal(payload.numero_pedido, undefined);
});

test('simulacao e telas existentes deixam de inventar id e numero', async () => {
  const sim = createMarketplaceSimulationOrders();
  assert.equal(sim[0].id_externo, 'ML-SIM-001');
  assert.doesNotMatch(JSON.stringify(sim), /Date\.now|Math\.random/);

  const ativa = await readFile(new URL('../src/components/integracoes/SincronizacaoMarketplacesAtiva.jsx', import.meta.url), 'utf8');
  const comercial = await readFile(new URL('../src/components/comercial/ValidarPedidosExternos.jsx', import.meta.url), 'utf8');
  assert.match(ativa, /buildErpPedidoFromExterno/);
  assert.match(ativa, /reutilizado por identificador externo/);
  assert.doesNotMatch(ativa, /substring\(0, 3\)/);
  assert.match(comercial, /stampMarketplacePedido/);
  assert.doesNotMatch(comercial, /numero_pedido: numero/);
});
