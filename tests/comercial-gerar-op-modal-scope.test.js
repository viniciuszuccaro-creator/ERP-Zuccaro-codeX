import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGerarOpModalQueryKey,
  isGerarOpModalScopeCurrent,
  resolveGerarOpModalProdutosKpiState,
  pickConfiguracaoProducao,
} from '../src/components/comercial/gerarOpModalScope.js';

test('GerarOPModal usa filterInContext e create/update/get InContext', () => {
  const src = readFileSync('src/components/comercial/GerarOPModal.jsx', 'utf8');
  assert.match(src, /filterInContext\(\s*'Produto'/);
  assert.match(src, /filterInContext\(\s*'ConfiguracaoProducao'/);
  assert.match(src, /createInContext\(\s*'OrdemProducao'/);
  assert.match(src, /createInContext\(\s*'MovimentacaoEstoque'/);
  assert.match(src, /createInContext\(\s*'HistoricoCliente'/);
  assert.match(src, /updateInContext\(\s*'Pedido'/);
  assert.match(src, /getInContext\(\s*'Produto'/);
  assert.match(src, /GERAR_OP_PRODUTOS_STALE_SCOPE/);
  assert.match(src, /erro ≠ zero produtos/);
  assert.doesNotMatch(src, /entities\.Produto\.filter\(/);
  assert.doesNotMatch(src, /entities\.ConfiguracaoProducao\.filter\(/);
  assert.doesNotMatch(src, /entities\.OrdemProducao\.create\(/);
  assert.doesNotMatch(src, /from ["']@\/api\/base44Client["']/);
  assert.doesNotMatch(src, /data:\s*produtos\s*=\s*\[\]/);
});

test('queryKey separa pedido, Grupo, Empresa, ator e sessão', () => {
  const base = {
    pedidoId: 'p1', groupId: 'g1', empresaId: 'e1', actorId: 'a1', sessionKey: 's1',
  };
  const k = buildGerarOpModalQueryKey('gerar-op-produtos', base);
  assert.deepEqual(k, ['gerar-op-produtos', 'p1', 'g1', 'e1', 'a1', 's1']);
  assert.notDeepEqual(buildGerarOpModalQueryKey('gerar-op-produtos', { ...base, sessionKey: 's2' }), k);
});

test('KPI loading/erro nunca é ready (≠ zero produtos)', () => {
  assert.equal(resolveGerarOpModalProdutosKpiState({
    contextoValido: true, isOpen: true, isLoading: true, isError: false, isFetching: false, dataDefined: false,
  }), 'loading');
  assert.equal(resolveGerarOpModalProdutosKpiState({
    contextoValido: true, isOpen: true, isLoading: false, isError: true, isFetching: false, dataDefined: false,
  }), 'error');
  assert.equal(resolveGerarOpModalProdutosKpiState({
    contextoValido: false, isOpen: true, isLoading: false, isError: false, isFetching: false, dataDefined: false,
  }), 'unavailable');
  assert.equal(resolveGerarOpModalProdutosKpiState({
    contextoValido: true, isOpen: true, isLoading: false, isError: false, isFetching: false, dataDefined: true,
  }), 'ready');
});

test('pickConfiguracaoProducao preserva primeiro registro', () => {
  assert.equal(pickConfiguracaoProducao(null), null);
  assert.equal(pickConfiguracaoProducao([{ id: 'c1' }])?.id, 'c1');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isGerarOpModalScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isGerarOpModalScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
