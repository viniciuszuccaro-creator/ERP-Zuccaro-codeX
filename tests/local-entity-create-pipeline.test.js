import assert from 'node:assert/strict';
import test from 'node:test';

import { runLocalEntityCreatePipeline } from '../src/api/localEntityCreatePipeline.js';

const createSteps = (calls, reuseAt = null) => {
  const reusable = (name) => (_db, _entityName, record) => {
    calls.push(name);
    if (reuseAt === name) return { reuse: { id: `${name}-existing` } };
    return { record: { ...record, [name]: true }, produtoPatch: name === 'estoque' ? { saldo: 9 } : null };
  };
  const transform = (name) => (_db, _entityName, record) => {
    calls.push(name);
    return { ...record, [name]: true };
  };

  return {
    ordem: reusable('ordem'),
    compras: reusable('compras'),
    expedicao: reusable('expedicao'),
    atendimento: reusable('atendimento'),
    crm: reusable('crm'),
    roteirizacao: reusable('roteirizacao'),
    siteOrigem: (_entityName, record) => {
      calls.push('siteOrigem');
      return { ...record, siteOrigem: true };
    },
    marketplace: reusable('marketplace'),
    migracao: reusable('migracao'),
    piloto: transform('piloto'),
    backup: transform('backup'),
    master: transform('master'),
    syncEntregaNumero: (_entityName, record) => {
      calls.push('syncEntregaNumero');
      return { ...record, syncEntregaNumero: true };
    },
    estoque: reusable('estoque'),
    financeiro: reusable('financeiro'),
    notaFiscal: transform('notaFiscal'),
  };
};

test('create pipeline preserves policy order and stock patch', () => {
  const calls = [];
  const result = runLocalEntityCreatePipeline({
    db: {},
    entityName: 'MovimentacaoEstoque',
    scoped: { idempotency_key: 'mov-1' },
    steps: createSteps(calls),
  });

  assert.deepEqual(calls, [
    'ordem', 'compras', 'expedicao', 'atendimento', 'crm', 'roteirizacao',
    'siteOrigem', 'marketplace', 'migracao', 'piloto', 'backup', 'master',
    'syncEntregaNumero', 'estoque', 'financeiro', 'notaFiscal',
  ]);
  assert.equal(result.record?.notaFiscal, true);
  assert.deepEqual(result.produtoPatch, { saldo: 9 });
});

test('create pipeline stops immediately when a policy reuses an idempotent record', () => {
  const calls = [];
  const result = runLocalEntityCreatePipeline({
    db: {},
    entityName: 'Pedido',
    scoped: { idempotency_key: 'pedido-1' },
    steps: createSteps(calls, 'expedicao'),
  });

  assert.deepEqual(result, { reuse: { id: 'expedicao-existing' } });
  assert.deepEqual(calls, ['ordem', 'compras', 'expedicao']);
});
