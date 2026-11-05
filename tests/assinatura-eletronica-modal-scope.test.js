import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAssinaturaModalScopeCurrent,
  assertAssinaturaModalContext,
  assertAssinaturaModalDocumento,
  buildAssinaturaModalCampoContrato,
  buildAssinaturaModalCampoPedido,
  resolveAssinaturaModalEntity,
} from '../src/components/assinaturaEletronicaModalScope.js';

test('AssinaturaEletronicaModal usa updateInContext sem entities Contrato/Pedido.update', () => {
  const src = readFileSync('src/components/AssinaturaEletronicaModal.jsx', 'utf8');
  assert.match(src, /updateInContext\(/);
  assert.match(src, /ASSINATURA_MODAL_STALE_SCOPE/);
  assert.match(src, /assertAssinaturaModalContext/);
  assert.doesNotMatch(src, /entities\.Contrato\.update\(/);
  assert.doesNotMatch(src, /entities\.Pedido\.update\(/);
});

test('guards e payloads do modal de assinatura', () => {
  assert.throws(() => assertAssinaturaModalContext(null, null), /ASSINATURA_MODAL_SCOPE_BLOCKED/);
  assert.doesNotThrow(() => assertAssinaturaModalContext('g1', null));
  assert.equal(assertAssinaturaModalDocumento({ id: 'd1' }, 'pedido'), 'd1');
  assert.throws(() => assertAssinaturaModalDocumento({}, 'pedido'), /ASSINATURA_MODAL_DOCUMENTO_REQUIRED/);
  assert.equal(resolveAssinaturaModalEntity('contrato'), 'Contrato');
  const contrato = buildAssinaturaModalCampoContrato({ status: 'Aguardando Assinatura' }, { n: 1 });
  assert.equal(contrato.status, 'Vigente');
  assert.equal(buildAssinaturaModalCampoPedido({ n: 2 }).assinado_cliente, true);
  assert.equal(isAssinaturaModalScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.equal(isAssinaturaModalScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'b', sessionKey: 's' },
  ), false);
});
