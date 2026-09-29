import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  formatComercialHttpError,
  isHttpListQueryKeyScoped,
  resolveHttpListViewState,
  sanitizeObservacoesText,
} from '../src/components/comercial/comercialListHttpUiPolicy.js';
import { buildOrcamentoPayload } from '../src/components/comercial/orcamentoUiPolicy.js';
import { buildPedidoPayload } from '../src/components/comercial/pedidoUiPolicy.js';

test('resolveHttpListViewState: 403/5xx nunca viram empty', () => {
  assert.equal(resolveHttpListViewState({ isLoading: true, isError: false, rowCount: 0 }), 'loading');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 0 }), 'error');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: true, rowCount: 12 }), 'error');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 0 }), 'empty');
  assert.equal(resolveHttpListViewState({ isLoading: false, isError: false, rowCount: 3 }), 'ready');
});

test('formatComercialHttpError distingue 403, 5xx e rede sem mascarar como vazio', () => {
  assert.match(formatComercialHttpError({ status: 403 }), /permissão/i);
  assert.match(formatComercialHttpError({ status: 500 }), /servidor/i);
  assert.match(formatComercialHttpError({ status: 503 }), /servidor/i);
  assert.match(formatComercialHttpError({ message: 'Failed to fetch' }), /comunicar com o servidor/i);
  assert.match(formatComercialHttpError({ status: 404 }, { entityLabel: 'Pedido' }), /Pedido/i);
  assert.match(
    formatComercialHttpError({ status: 409 }, { conflictMessage: 'O orçamento foi alterado e não está mais em aberto.' }),
    /não está mais em aberto/i,
  );
  assert.doesNotMatch(formatComercialHttpError({ status: 403 }), /nenhum|vazio|encontrado nesta empresa/i);
  assert.doesNotMatch(formatComercialHttpError({ status: 500 }), /nenhum|vazio|encontrado nesta empresa/i);
});

test('queryKey list HTTP exige groupId + empresaId', () => {
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e1', 1], { prefix: 'pedidos-http' }), true);
  assert.equal(isHttpListQueryKeyScoped(['orcamentos-http', 'g1', 'e1'], {
    prefix: 'orcamentos-http', groupId: 'g1', empresaId: 'e1',
  }), true);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1'], { prefix: 'pedidos-http' }), false);
  assert.equal(isHttpListQueryKeyScoped(['pedidos-http', 'g1', 'e2'], {
    prefix: 'pedidos-http', groupId: 'g1', empresaId: 'e1',
  }), false);
});

test('sanitizeObservacoesText remove markup perigoso', () => {
  assert.equal(sanitizeObservacoesText('  ok  '), 'ok');
  assert.equal(sanitizeObservacoesText('<script>alert(1)</script>nota'), 'scriptalert(1)/scriptnota');
  assert.equal(sanitizeObservacoesText('javascript:alert(1)'), 'alert(1)');
  assert.equal(sanitizeObservacoesText(''), '');
});

test('payload Orçamento/Pedido sanitiza observacoes no save', () => {
  const orc = buildOrcamentoPayload({
    cliente_empresa_id: 'c',
    condicao_pagamento_id: 'f',
    validade_em: '2027-01-01',
    observacoes: '  <b>proposta</b>  ',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'Item', unidade_sigla: 'UN',
      quantidade: '1', preco_unitario: '10', desconto: '0',
    }],
  });
  assert.equal(orc.observacoes, 'bproposta/b');
  const ped = buildPedidoPayload({
    cliente_empresa_id: 'c',
    condicao_pagamento_id: 'f',
    tipo_operacao: 'ENTREGA',
    data_entrega_solicitada: '2027-01-01',
    observacoes: '<img onerror=x>livre',
    itens: [{
      produto_id: 'p', unidade_id: 'u', descricao: 'Item', unidade_sigla: 'UN',
      quantidade: '1', preco_unitario: '10', desconto: '0', requer_producao: false,
    }],
  });
  assert.equal(ped.observacoes, 'img onerror=xlivre');
});

test('painéis Pedido/Orçamento usam list fail-closed e queryKey tenant', async () => {
  const pedido = await readFile(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx', import.meta.url), 'utf8');
  const orcamento = await readFile(new URL('../src/components/comercial/OrcamentosTab.jsx', import.meta.url), 'utf8');
  for (const source of [pedido, orcamento]) {
    assert.match(source, /resolveHttpListViewState/);
    assert.match(source, /formatComercialHttpError/);
    assert.match(source, /Tentar novamente/);
    assert.match(source, /masters-error|Masters não carregados/);
  }
  assert.match(pedido, /\['pedidos-http',\s*groupId,\s*empresaId/);
  assert.match(orcamento, /\['orcamentos-http',\s*groupId,\s*empresaId/);
  assert.match(pedido, /pedido-list-error/);
  assert.match(orcamento, /orcamento-list-error/);
  assert.match(pedido, /listView\s*===\s*'error'|listView==='error'/);
  assert.match(orcamento, /listView === 'error'/);
  // erro não colapsa no empty state
  assert.doesNotMatch(pedido, /list\.isError\s*\?\s*rows\.length/);
  assert.doesNotMatch(orcamento, /listQuery\.isError\s*\?\s*rows\.length/);
});
