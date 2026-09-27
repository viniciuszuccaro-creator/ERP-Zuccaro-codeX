import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDescontoDentroDaAlcadaOuAprovar,
  computeDescontoBps,
  descontoExcedeAlcadaLivre,
} from '../src/services/comercialDescontoAlcadaPolicy.ts';

const ACTOR_A = '55555555-5555-4555-8555-555555555555';
const ACTOR_B = '77777777-7777-4777-8777-777777777777';

test('desconto zero não excede alçada livre', () => {
  assert.equal(descontoExcedeAlcadaLivre([
    { quantidade: '2', preco_unitario: '10.000000', desconto: '0' },
  ]), false);
  assert.equal(computeDescontoBps([
    { quantidade: '2', preco_unitario: '10.000000', desconto: '0' },
  ]).descontoBps, 0);
});

test('qualquer desconto > 0 excede alçada livre padrão (0 bps)', () => {
  assert.equal(descontoExcedeAlcadaLivre([
    { quantidade: '2', preco_unitario: '10.000000', desconto: '1.000000' },
  ]), true);
});

test('desconto positivo abaixo de 1 bp ainda excede alçada 0 (sem truncar)', () => {
  // 0.01 / 1000 = 0.1 bp → Number((desconto*10000)/subtotal) truncava para 0
  const items = [{ quantidade: '1', preco_unitario: '1000', desconto: '0.01' }];
  const computed = computeDescontoBps(items);
  assert.equal(computed.descontoBps, 0); // truncamento numérico ainda existe no helper de leitura
  assert.equal(computed.descontoMicros, 10000n);
  assert.equal(descontoExcedeAlcadaLivre(items), true);
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items,
      canAprovar: false,
      actorId: ACTOR_A,
      criadorActorId: ACTOR_B,
      entityLabel: 'Orçamento',
    }),
    (err: any) => err?.statusCode === 403 && err?.code === 'DESCONTO_ALCADA_DENIED',
  );
});

test('assertDesconto exige canAprovar quando excede alçada', () => {
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items: [{ quantidade: '1', preco_unitario: '100', desconto: '5' }],
      canAprovar: false,
      actorId: ACTOR_A,
      criadorActorId: ACTOR_B,
      entityLabel: 'Orçamento',
    }),
    (err: any) => err?.statusCode === 403 && err?.code === 'DESCONTO_ALCADA_DENIED'
      && /permissão de aprovar/i.test(err?.message),
  );
});

test('assertDesconto bloqueia autoaprovação mesmo com canAprovar', () => {
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items: [{ quantidade: '1', preco_unitario: '100', desconto: '5' }],
      canAprovar: true,
      actorId: ACTOR_A,
      criadorActorId: ACTOR_A,
      entityLabel: 'Orçamento',
    }),
    (err: any) => err?.statusCode === 403 && err?.code === 'DESCONTO_ALCADA_DENIED'
      && /outro aprovador/i.test(err?.message),
  );
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items: [{ quantidade: '1', preco_unitario: '100', desconto: '5' }],
      canAprovar: true,
      actorId: ACTOR_A,
      criadorActorId: null,
      entityLabel: 'Pedido',
    }),
    (err: any) => err?.statusCode === 403 && err?.code === 'DESCONTO_ALCADA_DENIED'
      && /outro aprovador/i.test(err?.message),
  );
});

test('assertDesconto libera só com outro aprovador e canAprovar', () => {
  const decision = assertDescontoDentroDaAlcadaOuAprovar({
    items: [{ quantidade: '1', preco_unitario: '100', desconto: '5' }],
    canAprovar: true,
    actorId: ACTOR_B,
    criadorActorId: ACTOR_A,
  });
  assert.equal(decision.aprovacaoExigida, true);
  assert.equal(decision.aprovadaPorOutro, true);
  assert.ok(decision.descontoBps > 0);
});
