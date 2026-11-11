/**
 * #591 — RG + documentos[] na Central360 (estados; sem BFF paralelo).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  classifyCentral360Documentos,
  classifyCentral360Rg,
} from '../src/components/comercial/centralCliente360Documentos.js';

const panel = readFileSync('src/components/comercial/CentralCliente360Panel.jsx', 'utf8');
const completo = readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');

test('RG: ausente / vazio / presente_bff / forbidden / loadError', () => {
  assert.equal(classifyCentral360Rg({}, { forbidden: true }).status, 'forbidden');
  assert.equal(classifyCentral360Rg(null, { loadError: true }).status, 'unavailable');
  assert.equal(classifyCentral360Rg({ id: 'x' }).status, 'absent');
  assert.equal(classifyCentral360Rg({ rg: null }).status, 'unknown');
  assert.equal(classifyCentral360Rg({ rg: '' }).status, 'empty');
  const present = classifyCentral360Rg({ rg: '12.345.678-9' });
  assert.equal(present.status, 'present_bff_pending');
  assert.equal(present.value, '12.345.678-9');
  assert.match(present.message, /BFF/i);
});

test('documentos[]: ausente / vazio / quarentena / presente_bff', () => {
  assert.equal(classifyCentral360Documentos({ id: 'x' }).status, 'absent');
  assert.equal(classifyCentral360Documentos({ documentos: [] }).status, 'empty');
  const ok = classifyCentral360Documentos({
    documentos: [
      { nome_arquivo: 'cnh.pdf', tipo: 'cnh' },
      { tipo: 'x' },
    ],
  });
  assert.equal(ok.status, 'present_bff_pending');
  assert.equal(ok.items.length, 1);
  assert.equal(ok.quarentena.length, 1);
});

test('CentralCliente360Panel: bloco RG/docs reutiliza GET MASTER (sem GET paralelo)', () => {
  assert.match(panel, /data-block="central360-docs-rg-master"/);
  assert.match(panel, /classifyCentral360Rg/);
  assert.match(panel, /classifyCentral360Documentos/);
  assert.match(panel, /data-rg-estado=\{rgClassified\.status\}/);
  assert.match(panel, /data-campo="documento-anexo"/);
  assert.match(panel, /≠ cadastro completo só por nome\/documento/);
  // Mesma queryKey/contatosQuery — sem segundo entities.Cliente.get.
  assert.equal((panel.match(/entities\?\.Cliente/g) || []).length, 1);
});

test('Completo: estados documentos ≠ limpar (data-documentos-estado)', () => {
  assert.match(completo, /data-documentos-estado=/);
  assert.match(completo, /nao-carregado/);
  assert.match(completo, /presente-bff-pendente/);
  assert.match(completo, /omit ≠ limpar/);
});
