import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAssinaturaFormScopeCurrent,
  assertAssinaturaFormContext,
  assertAssinaturaFormDocumento,
  buildAssinaturaFormCampoContrato,
  buildAssinaturaFormCampoPedido,
  resolveAssinaturaFormEntity,
} from '../src/components/assinaturaEletronicaFormScope.js';

test('AssinaturaEletronicaForm usa updateInContext sem entities Contrato/Pedido.update', () => {
  const src = readFileSync('src/components/AssinaturaEletronicaForm.jsx', 'utf8');
  assert.match(src, /updateInContext\(/);
  assert.match(src, /ASSINATURA_FORM_STALE_SCOPE/);
  assert.match(src, /assertAssinaturaFormContext/);
  assert.doesNotMatch(src, /entities\.Contrato\.update\(/);
  assert.doesNotMatch(src, /entities\.Pedido\.update\(/);
});

test('guards e payloads de assinatura', () => {
  assert.throws(() => assertAssinaturaFormContext(null, null), /ASSINATURA_FORM_SCOPE_BLOCKED/);
  assert.doesNotThrow(() => assertAssinaturaFormContext('g1', null));
  assert.equal(assertAssinaturaFormDocumento({ id: 'd1' }, 'contrato'), 'd1');
  assert.throws(() => assertAssinaturaFormDocumento({}, 'contrato'), /ASSINATURA_FORM_DOCUMENTO_REQUIRED/);
  assert.throws(() => assertAssinaturaFormDocumento({ id: 'd1' }, 'outro'), /ASSINATURA_FORM_TIPO_INVALIDO/);
  assert.equal(resolveAssinaturaFormEntity('contrato'), 'Contrato');
  assert.equal(resolveAssinaturaFormEntity('pedido'), 'Pedido');
  const contrato = buildAssinaturaFormCampoContrato(
    { status: 'Aguardando Assinatura' },
    { nome: 'A' },
  );
  assert.equal(contrato.assinado, true);
  assert.equal(contrato.status, 'Vigente');
  const pedido = buildAssinaturaFormCampoPedido({ nome: 'B' });
  assert.equal(pedido.assinado_cliente, true);
  assert.equal(isAssinaturaFormScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'a', sessionKey: 's' },
  ), true);
  assert.equal(isAssinaturaFormScopeCurrent(
    { actorId: 'a', sessionKey: 's' },
    { actorId: 'b', sessionKey: 's' },
  ), false);
});
