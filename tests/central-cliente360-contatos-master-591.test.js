/**
 * #591 — Contatos MASTER na Central360 (classificação + wire UI).
 * Sem PII / sem storage paralelo ContatoClienteV2.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  classifyCentral360Contatos,
  labelContatoCanal,
} from '../src/components/comercial/centralCliente360Contatos.js';

const panel = readFileSync('src/components/comercial/CentralCliente360Panel.jsx', 'utf8');

test('classifica ausente / vazio / quarentena / forbidden / loadError', () => {
  assert.equal(classifyCentral360Contatos({}, { forbidden: true }).status, 'forbidden');
  assert.equal(classifyCentral360Contatos(null, { loadError: true }).status, 'unavailable');
  assert.equal(classifyCentral360Contatos({ id: 'x' }).status, 'absent');
  assert.equal(classifyCentral360Contatos({ contatos: null }).status, 'unknown');
  assert.equal(classifyCentral360Contatos({ contatos: [] }).status, 'empty');
  const mixed = classifyCentral360Contatos({
    contatos: [
      { tipo: 'E-mail', valor: 'a@example.test', nome: 'A', cargo: 'Compras', principal: true },
      { tipo: 'Celular', valor: '11999990000' },
      { tipo: 'LinkedIn', valor: 'https://x' },
    ],
  });
  assert.equal(mixed.status, 'ok');
  assert.equal(mixed.validos.length, 2);
  assert.equal(mixed.quarentena.length, 1);
  assert.match(mixed.message, /quarentena/i);
});

test('Celular ≠ WhatsApp nos rótulos', () => {
  assert.equal(labelContatoCanal('celular'), 'Celular');
  assert.equal(labelContatoCanal('whatsapp'), 'WhatsApp');
  assert.notEqual(labelContatoCanal('celular'), labelContatoCanal('whatsapp'));
});

test('CentralCliente360Panel: bloco contatos MASTER com ctx pós-await e entities.Cliente.get', () => {
  assert.match(panel, /data-block="central360-contatos-master"/);
  assert.match(panel, /cliente-central-360-contatos/);
  assert.match(panel, /httpApi\.entities\?\.Cliente/);
  assert.match(panel, /CONTEXT_CHANGED|Contexto alterado\. Reabra a Central antes de consultar contatos/);
  assert.match(panel, /data-campo="contato-quarentena"/);
  assert.match(panel, /data-campo="cargo"/);
  assert.match(panel, /Celular ≠ WhatsApp/);
  assert.match(panel, /classifyCentral360Contatos/);
});
