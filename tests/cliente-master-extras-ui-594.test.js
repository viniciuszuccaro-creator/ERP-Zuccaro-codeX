/**
 * Cursor pós-PR594 — UI extras MASTER (Codex ALLOWED_KEYS já no tip).
 * omit ≠ limpar; 503 STORAGE_REQUIRED; sem ClienteV2 / sem DDL.
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
  applyClienteMasterExtrasToHttpPayload,
} from '../src/api/clienteMasterExtrasUi.js';
import { CLIENTE_MASTER_EXTRA_KEYS, toClienteMasterHttpPayload } from '../src/api/clienteHttpPayload.js';

const completo = readFileSync('src/components/cadastros/CadastroClienteCompleto.jsx', 'utf8');
const relatorios = readFileSync('src/pages/Relatorios.jsx', 'utf8');

test('CLIENTE_MASTER_EXTRA_KEYS canônico inclui caixa/produtor', () => {
  assert.deepEqual([...CLIENTE_MASTER_EXTRA_KEYS], [
    'rg', 'numero_caixa_postal', 'cep_caixa_postal', 'caixa_postal_cobranca', 'inscricao_produtor_rural',
  ]);
});

test('classifica absent / empty / present', () => {
  assert.equal(classifyClienteMasterExtra({}, 'rg').status, 'absent');
  assert.equal(classifyClienteMasterExtra({ rg: '' }, 'rg').status, 'empty');
  assert.equal(classifyClienteMasterExtra({ rg: '001234-X' }, 'rg').status, 'present');
  assert.equal(classifyClienteMasterExtras({ rg: '1' }).present, 1);
});

test('CEP caixa postal e pick omit-aware', () => {
  assert.equal(sanitizeCepCaixaPostal('01234-000'), '01234000');
  assert.throws(() => sanitizeCepCaixaPostal('00000000'));
  assert.deepEqual(pickClienteMasterExtrasForWrite({ nome: 'X' }), {});
  // Default UI '' = omissão (não 503 STORAGE em create sem colunas).
  assert.deepEqual(pickClienteMasterExtrasForWrite({ rg: '' }), {});
  assert.deepEqual(pickClienteMasterExtrasForWrite({ rg: null }), { rg: null });
  assert.deepEqual(pickClienteMasterExtrasForWrite({ cep_caixa_postal: '' }), {});
});

test('HTTP payload: extras na ALLOWED_KEYS; omissão sem chave', () => {
  const wire = toClienteMasterHttpPayload({
    nome: 'SYNTHETIC',
    tipo: 'Pessoa Física',
    cpf: '529.982.247-25',
    rg: '001234-X',
    numero_caixa_postal: '00017',
  });
  assert.equal(wire.rg, '001234-X');
  assert.equal(wire.numero_caixa_postal, '00017');
  const omit = toClienteMasterHttpPayload({
    nome: 'SYNTHETIC',
    tipo: 'Pessoa Física',
    cpf: '529.982.247-25',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(omit, 'rg'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(
    toClienteMasterHttpPayload({ nome: 'S', tipo: 'Pessoa Física', cpf: '529.982.247-25', rg: '' }),
    'rg',
  ), false);
});

test('apply HTTP + STORAGE_REQUIRED; create com rg default omite', () => {
  const payload = { nome: 'X', rg: 'from-build' };
  applyClienteMasterExtrasToHttpPayload(payload, { numero_caixa_postal: '00017' });
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'rg'), false);
  assert.equal(payload.numero_caixa_postal, '00017');
  const createPayload = { nome: 'Novo', rg: '' };
  applyClienteMasterExtrasToHttpPayload(createPayload, { rg: '', nome: 'Novo' });
  assert.equal(Object.prototype.hasOwnProperty.call(createPayload, 'rg'), false);
  applyClienteMasterExtrasToHttpPayload(createPayload, { rg: null, nome: 'Novo' });
  assert.equal(createPayload.rg, null);
  assert.equal(isClienteMasterStorageRequired({ code: 'CLIENTE_MASTER_STORAGE_REQUIRED', status: 503 }), true);
});

test('Completo + Relatórios wired', () => {
  assert.match(completo, /data-block="cliente-master-extras"/);
  assert.match(completo, /applyClienteMasterExtrasToHttpPayload/);
  assert.match(completo, /isClienteMasterStorageRequired/);
  assert.match(relatorios, /!permissionsLoading && hasReportGrant\(perfilAcesso,'Comercial','Representantes','visualizar'\)/);
  assert.match(relatorios, /!permissionsLoading && hasReportGrant\(perfilAcesso,'Relatorios','Personalizado','visualizar'\)/);
});
