/**
 * #591 — consumo UI das extensões MASTER (Codex: rg/caixa postal/produtor).
 * Schema antigo tratado explicitamente; omit ≠ limpar; sem ClienteV2.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  classifyClienteMasterExtra,
  classifyClienteMasterExtras,
  isClienteMasterStorageRequired,
  pickClienteMasterExtrasForWrite,
  sanitizeCepCaixaPostal,
} from '../src/api/clienteMasterExtrasUi.js';
import { toClienteMasterHttpPayload } from '../src/api/clienteHttpPayload.js';

const completo = readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
const panel = readFileSync('src/components/comercial/CentralCliente360Panel.jsx', 'utf8');

test('classifica absent / empty / present / forbidden', () => {
  assert.equal(classifyClienteMasterExtra({}, 'rg').status, 'absent');
  assert.equal(classifyClienteMasterExtra({ rg: null }, 'rg').status, 'unknown');
  assert.equal(classifyClienteMasterExtra({ rg: '' }, 'rg').status, 'empty');
  assert.equal(classifyClienteMasterExtra({ rg: '001234-X' }, 'rg').status, 'present');
  assert.equal(classifyClienteMasterExtra({}, 'rg', { forbidden: true }).status, 'forbidden');
  const all = classifyClienteMasterExtras({
    rg: '001234-X',
    numero_caixa_postal: '00017',
    cep_caixa_postal: '01234000',
  });
  assert.equal(all.present, 3);
  assert.equal(all.fields.caixa_postal_cobranca.status, 'absent');
});

test('CEP caixa postal: 8 dígitos, rejeita 00000000 sem truncar', () => {
  assert.equal(sanitizeCepCaixaPostal('01234-000'), '01234000');
  assert.equal(sanitizeCepCaixaPostal(''), null);
  assert.throws(() => sanitizeCepCaixaPostal('00000000'), (e) => e.code === 'CLIENTE_MASTER_EXTRA_VALIDATION');
  assert.throws(() => sanitizeCepCaixaPostal('123'), (e) => e.code === 'CLIENTE_MASTER_EXTRA_VALIDATION');
});

test('pick write: omit sem hasOwn; blank → null', () => {
  assert.deepEqual(pickClienteMasterExtrasForWrite({ nome: 'X' }), {});
  assert.deepEqual(pickClienteMasterExtrasForWrite({ rg: '' }), { rg: null });
  assert.equal(pickClienteMasterExtrasForWrite({ numero_caixa_postal: '00017' }).numero_caixa_postal, '00017');
});

test('HTTP payload inclui extras; omissão não inventa chave', () => {
  const wire = toClienteMasterHttpPayload({
    nome: 'SYNTHETIC',
    tipo: 'Pessoa Física',
    cpf: '529.982.247-25',
    rg: '001234-X',
    cep_caixa_postal: '01234000',
  });
  assert.equal(wire.rg, '001234-X');
  assert.equal(wire.cep_caixa_postal, '01234000');
  const omit = toClienteMasterHttpPayload({
    nome: 'SYNTHETIC',
    tipo: 'Pessoa Física',
    cpf: '529.982.247-25',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(omit, 'rg'), false);
});

test('503 STORAGE_REQUIRED detectado (schema antigo)', () => {
  assert.equal(isClienteMasterStorageRequired({ code: 'CLIENTE_MASTER_STORAGE_REQUIRED', status: 503 }), true);
  assert.equal(isClienteMasterStorageRequired({ code: 'OTHER', status: 422 }), false);
});

test('Completo + Cliente360: campos e estados wired', () => {
  assert.match(completo, /data-block="cliente-master-extras"/);
  assert.match(completo, /data-campo="numero_caixa_postal"/);
  assert.match(completo, /data-campo="cep_caixa_postal"/);
  assert.match(completo, /data-campo="caixa_postal_cobranca"/);
  assert.match(completo, /data-campo="inscricao_produtor_rural"/);
  assert.match(completo, /isClienteMasterStorageRequired/);
  assert.match(completo, /nao-carregado/);
  assert.match(panel, /data-block="central360-master-extras"/);
  assert.match(panel, /classifyClienteMasterExtras/);
  assert.match(panel, /data-extra-estado=/);
});
