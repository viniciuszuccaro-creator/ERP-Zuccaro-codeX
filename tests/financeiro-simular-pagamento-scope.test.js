import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isSimularPagamentoScopeCurrent,
  resolveSimularPagamentoScopeIds,
  buildSimularPagamentoPayload,
} from '../src/components/financeiro/simularPagamentoScope.js';

test('SimularPagamentoModal usa createInContext/updateInContext sem entities unscoped', () => {
  const src = readFileSync('src/components/financeiro/SimularPagamentoModal.jsx', 'utf8');
  assert.match(src, /createInContext\(\s*'PagamentoOmnichannel'/);
  assert.match(src, /updateInContext\(\s*'ContaReceber'/);
  assert.match(src, /createInContext\(\s*'CaixaOrdemLiquidacao'/);
  assert.match(src, /createInContext\(\s*'HistoricoCliente'/);
  assert.match(src, /createInContext\(\s*'LogCobranca'/);
  assert.match(src, /SIMULAR_PAGAMENTO_STALE_SCOPE/);
  assert.doesNotMatch(src, /entities\.PagamentoOmnichannel\.create\(/);
  assert.doesNotMatch(src, /entities\.ContaReceber\.update\(/);
  assert.doesNotMatch(src, /entities\.CaixaOrdemLiquidacao\.create\(/);
  assert.doesNotMatch(src, /from ['"]@\/api\/base44Client['"]/);
});

test('resolveSimularPagamentoScopeIds fail-closed e mismatch', () => {
  assert.equal(resolveSimularPagamentoScopeIds({
    groupId: null, empresaId: null, conta: {},
  }).ok, false);
  assert.equal(resolveSimularPagamentoScopeIds({
    groupId: 'g1', empresaId: 'e1', conta: { group_id: 'g2', empresa_id: 'e1' },
  }).reason, 'GROUP_MISMATCH');
  assert.deepEqual(resolveSimularPagamentoScopeIds({
    groupId: 'g1', empresaId: 'e1', conta: { group_id: 'g1', empresa_id: 'e1' },
  }), { ok: true, reason: null, groupId: 'g1', empresaId: 'e1' });
});

test('payload preserva group/empresa resolvidos', () => {
  const out = buildSimularPagamentoPayload({
    groupId: 'g1',
    empresaId: 'e1',
    contaReceber: {
      id: 'cr1', cliente_id: 'c1', cliente: 'ACME', valor: 10,
      data_vencimento: '2026-01-01', forma_cobranca: 'PIX',
    },
    dadosSimulacao: { forma_pagamento: 'PIX', valor_pago: 10, data_pagamento: '2026-01-02' },
    user: { id: 'u1', full_name: 'Operador' },
    pagamentoId: null,
  });
  assert.equal(out.pagamento.group_id, 'g1');
  assert.equal(out.pagamento.empresa_id, 'e1');
  assert.equal(out.contaUpdate.status, 'Recebido');
  assert.equal(out.historico.cliente_id, 'c1');
  assert.equal(out.logCobranca.status_operacao, 'simulado');
});

test('resposta tardia: troca ator/sessão invalida escopo', () => {
  const expected = { actorId: 'a1', sessionKey: 's1' };
  assert.equal(isSimularPagamentoScopeCurrent(expected, { actorId: 'a1', sessionKey: 's1' }), true);
  assert.equal(isSimularPagamentoScopeCurrent(expected, { actorId: 'a2', sessionKey: 's1' }), false);
});
