import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  monitoramentoCanaisScopeRemainder,
  monitoramentoCanaisScopeRemainderVulnerable,
} from './helpers/monitoramentoCanaisScopeRemainder.js';

const AUTHORIZED = readFileSync(
  'tests/fixtures/monitoramento-canais-realtime-authorized-composed.jsx',
  'utf8',
).replace(/\r\n/g, '\n');
const STAGE44 = readFileSync(
  'tests/fixtures/monitoramento-canais-realtime-stage44.jsx',
  'utf8',
).replace(/\r\n/g, '\n');

const OUTSIDE = '\nthrow new Error("OUTSIDE_AUTHORIZED_SCOPE");\n';

test('P1: tip autorizado converte para STAGE44 (fixed e vulnerable)', () => {
  assert.equal(monitoramentoCanaisScopeRemainder(AUTHORIZED), STAGE44);
  assert.equal(monitoramentoCanaisScopeRemainderVulnerable(AUTHORIZED), STAGE44);
});

test('P1 contraprova append: vulnerable ACEITA; fixed REJEITA', () => {
  const poisoned = AUTHORIZED + OUTSIDE;
  // Vulnerable: marcadores/fórmula intactos → devolve STAGE44 e esconde o throw
  assert.equal(monitoramentoCanaisScopeRemainderVulnerable(poisoned), STAGE44);
  // Fixed: igualdade integral → rejeita
  assert.throws(
    () => monitoramentoCanaisScopeRemainder(poisoned),
    /authorized composed tip exactly/,
  );
});

test('P1: alteração fora dos hunks rejeitada pelo fixed', () => {
  const altered = AUTHORIZED.replace(
    'Monitoramento em Tempo Real',
    'Monitoramento ALTERADO FORA DO ESCOPO',
  );
  assert.notEqual(altered, AUTHORIZED);
  assert.throws(
    () => monitoramentoCanaisScopeRemainder(altered),
    /authorized composed tip exactly/,
  );
  // Vulnerable ainda aceita (marcadores/fórmula presentes)
  assert.equal(monitoramentoCanaisScopeRemainderVulnerable(altered), STAGE44);
});

test('P1: omissão de trecho autorizado rejeitada pelo fixed', () => {
  const omitted = AUTHORIZED.replace(/CANAIS_PEDIDOS_STALE_SCOPE/g, 'CANAIS_PEDIDOS_STALE_SCOPE'.slice(0, 10));
  assert.throws(() => monitoramentoCanaisScopeRemainder(omitted), /authorized composed tip exactly/);
});

test('P1: repetição / instrução extra com marcadores válidos rejeitada', () => {
  const duplicatedMarker = AUTHORIZED.replace(
    'throw new Error(\'CANAIS_PEDIDOS_STALE_SCOPE\');',
    "throw new Error('CANAIS_PEDIDOS_STALE_SCOPE');\n      throw new Error('CANAIS_PEDIDOS_STALE_SCOPE');",
  );
  assert.notEqual(duplicatedMarker, AUTHORIZED);
  assert.throws(
    () => monitoramentoCanaisScopeRemainder(duplicatedMarker),
    /authorized composed tip exactly/,
  );

  const extraInstruction = AUTHORIZED.replace(
    'enabled: contextoValido,',
    'enabled: contextoValido,\n    // EXTRA_UNAUTHORIZED_INSTRUCTION\n    staleTime: 0,',
  );
  assert.throws(
    () => monitoramentoCanaisScopeRemainder(extraInstruction),
    /authorized composed tip exactly/,
  );
});

test('P1: marcadores válidos + conteúdo indevido no meio rejeitados', () => {
  const smuggled = AUTHORIZED.replace(
    'buildFechamentoQueryKey',
    'buildFechamentoQueryKey /* SMUGGLE */',
  );
  assert.match(smuggled, /CANAIS_PEDIDOS_STALE_SCOPE/);
  assert.match(smuggled, /buildFechamentoQueryKey/);
  assert.throws(
    () => monitoramentoCanaisScopeRemainder(smuggled),
    /authorized composed tip exactly/,
  );
  // Vulnerable ainda passa (regex de marcador não exige igualdade)
  assert.equal(monitoramentoCanaisScopeRemainderVulnerable(smuggled), STAGE44);
});
