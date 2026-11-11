/**
 * #591 — Entregas Cliente360 + WhatsApp classificado + caps cliente_local.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  canalClassificacaoAttr,
  isWhatsAppClassificado,
  labelContatoCanal,
} from '../src/components/comercial/centralCliente360Contatos.js';
import {
  canViewCentral360Entregas,
  classifyCentral360Entregas,
} from '../src/components/comercial/centralCliente360Entregas.js';

const panel = readFileSync('src/components/comercial/CentralCliente360Panel.jsx', 'utf8');
const enderecos = readFileSync('src/components/cadastros/GerenciarEnderecosClienteForm.jsx', 'utf8');

test('WhatsApp exige classificação comprovada (≠ Celular)', () => {
  assert.equal(isWhatsAppClassificado('WhatsApp'), true);
  assert.equal(isWhatsAppClassificado('whatsapp'), true);
  assert.equal(isWhatsAppClassificado('Celular'), false);
  assert.equal(isWhatsAppClassificado('telefone'), false);
  assert.equal(labelContatoCanal('Celular'), 'Celular');
  assert.notEqual(labelContatoCanal('Celular'), labelContatoCanal('WhatsApp'));
  assert.equal(canalClassificacaoAttr('WhatsApp'), 'whatsapp-classificado');
  assert.equal(canalClassificacaoAttr('Celular'), 'celular');
});

test('entregas: forbidden / empty / ok / loadError', () => {
  assert.equal(classifyCentral360Entregas(null, { forbidden: true }).status, 'forbidden');
  assert.equal(classifyCentral360Entregas(null, { loadError: true }).status, 'unavailable');
  assert.equal(classifyCentral360Entregas({ data: [], meta: { total: 0 } }).status, 'empty');
  const ok = classifyCentral360Entregas({
    data: [{ id: 'e1', status: 'Em rota', pedido_id: 'p1', cidade: 'SP', uf: 'SP' }],
    meta: { total: 1 },
  });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.rows.length, 1);
});

test('canViewCentral360Entregas: aliases Expedicao sem ampliar', () => {
  assert.equal(canViewCentral360Entregas(() => false), false);
  assert.equal(
    canViewCentral360Entregas((m, r, a) => m === 'Expedicao' && r === 'Entregas' && a === 'visualizar'),
    true,
  );
  assert.equal(
    canViewCentral360Entregas((m, r, a) => m === 'Cadastros' && r === 'Cliente' && a === 'editar'),
    false,
  );
});

test('CentralCliente360Panel: entregas + WhatsApp classificado + ctx pós-await', () => {
  assert.match(panel, /data-block="central360-entregas-cliente"/);
  assert.match(panel, /listEntregas/);
  assert.match(panel, /CONTEXT_CHANGED|Contexto alterado\. Reabra a Central antes de consultar entregas/);
  assert.match(panel, /data-campo="whatsapp-classificado"/);
  assert.match(panel, /data-canal=\{canalClassificacaoAttr/);
  assert.match(panel, /classifyCentral360Entregas/);
});

test('GerenciarEnderecos: caps cliente_local probed (HML só visualizar)', () => {
  assert.match(enderecos, /data-cliente-local-caps="probed"/);
  assert.match(enderecos, /data-cap-visualizar=/);
  assert.match(enderecos, /data-cap-criar=/);
  assert.match(enderecos, /data-cap-editar=/);
  assert.match(enderecos, /data-cap-inativar=/);
  assert.match(enderecos, /data-hml-cenario="cliente-local-somente-visualizar"/);
  assert.match(enderecos, /Cliente\.editar não autoriza locais/);
  assert.doesNotMatch(enderecos, /hasPermission\("Cadastros", "Cliente", "editar"\).*criar/);
});
