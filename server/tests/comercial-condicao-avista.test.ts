import assert from 'node:assert/strict';
import test from 'node:test';
import {
  condicaoPagamentoEhAVista,
  deveLiberarDescontoSemAprovarPorAvista,
} from '../src/services/comercialCondicaoAvistaPolicy.ts';
import { assertDescontoDentroDaAlcadaOuAprovar } from '../src/services/comercialDescontoAlcadaPolicy.ts';

test('à vista: todas parcelas dias 0', () => {
  assert.equal(condicaoPagamentoEhAVista([{ dias: 0 }, { dias: 0, ativo: true }]), true);
});

test('não à vista: parcela a prazo', () => {
  assert.equal(condicaoPagamentoEhAVista([{ dias: 0 }, { dias: 30 }]), false);
  assert.equal(condicaoPagamentoEhAVista([{ dias: 30 }]), false);
});

test('não à vista: vazio ou só inativas', () => {
  assert.equal(condicaoPagamentoEhAVista([]), false);
  assert.equal(condicaoPagamentoEhAVista(null), false);
  assert.equal(condicaoPagamentoEhAVista([{ dias: 0, ativo: false }]), false);
});

test('liberação fail-closed: sem regra explícita não libera mesmo à vista', () => {
  assert.equal(deveLiberarDescontoSemAprovarPorAvista({
    parcelas: [{ dias: 0 }],
    regraPermite: false,
  }), false);
  assert.equal(deveLiberarDescontoSemAprovarPorAvista({
    parcelas: [{ dias: 0 }],
    regraPermite: null,
  }), false);
  assert.equal(deveLiberarDescontoSemAprovarPorAvista({
    parcelas: [{ dias: 0 }],
  }), false);
});

test('liberação: à vista + regraPermite true', () => {
  assert.equal(deveLiberarDescontoSemAprovarPorAvista({
    parcelas: [{ dias: 0 }],
    regraPermite: true,
  }), true);
  assert.equal(deveLiberarDescontoSemAprovarPorAvista({
    parcelas: [{ dias: 30 }],
    regraPermite: true,
  }), false);
});

test('assertDesconto: liberadoPorAvista ignora alçada (não é autoaprovação)', () => {
  const ACTOR_A = '55555555-5555-4555-8555-555555555555';
  const decision = assertDescontoDentroDaAlcadaOuAprovar({
    items: [{ quantidade: '1', preco_unitario: '100', desconto: '20' }],
    canAprovar: false,
    actorId: ACTOR_A,
    criadorActorId: ACTOR_A,
    liberadoPorAvista: true,
  });
  assert.equal(decision.aprovacaoExigida, false);
  assert.equal(decision.aprovadaPorOutro, false);
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items: [{ quantidade: '1', preco_unitario: '100', desconto: '20' }],
      canAprovar: false,
      actorId: ACTOR_A,
      criadorActorId: ACTOR_A,
      liberadoPorAvista: false,
    }),
    (err: any) => err?.code === 'DESCONTO_ALCADA_DENIED',
  );
  // Sem isenção à vista, mesmo com canAprovar o criador não autoaprova.
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items: [{ quantidade: '1', preco_unitario: '100', desconto: '20' }],
      canAprovar: true,
      actorId: ACTOR_A,
      criadorActorId: ACTOR_A,
      liberadoPorAvista: false,
    }),
    (err: any) => err?.code === 'DESCONTO_ALCADA_DENIED' && /outro aprovador/i.test(err?.message),
  );
});

test('assertDesconto: liberadoPorAvista ainda valida desconto inválido (422)', () => {
  const ACTOR_A = '55555555-5555-4555-8555-555555555555';
  assert.throws(
    () => assertDescontoDentroDaAlcadaOuAprovar({
      items: [{ quantidade: '1', preco_unitario: '100', desconto: '101' }],
      canAprovar: false,
      actorId: ACTOR_A,
      criadorActorId: ACTOR_A,
      liberadoPorAvista: true,
    }),
    (err: any) => err?.statusCode === 422 && err?.code === 'ORCAMENTO_DESCONTO_INVALIDO',
  );
});
