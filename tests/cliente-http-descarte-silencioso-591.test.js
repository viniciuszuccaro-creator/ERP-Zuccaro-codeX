/**
 * #591 / parecer 6746649125 — formatos/campos ricos não somem em silêncio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toClienteMasterHttpPayload,
  assertClienteHttpRichFieldsWritable,
  isMeaningfulEndereco,
  hydrateClienteHttpRowForUi,
  mapClienteLocalToUiEndereco,
  CLIENTE_HTTP_UNSUPPORTED_FIELDS,
} from '../src/api/clienteHttpPayload.js';

test('endereco_principal significativo → fail-closed (sem drop)', () => {
  assert.equal(isMeaningfulEndereco({ cep: '', logradouro: '' }), false);
  assert.equal(isMeaningfulEndereco({ cep: '01310100', logradouro: 'Av Paulista' }), true);
  assert.throws(
    () => toClienteMasterHttpPayload({
      nome: 'Sintético',
      tipo: 'Pessoa Física',
      documento: '012.345.678-90',
      endereco_principal: { cep: '01310100', logradouro: 'Av Teste' },
    }),
    (err) => err?.code === CLIENTE_HTTP_UNSUPPORTED_FIELDS
      && err.fields.includes('endereco_principal'),
  );
});

test('origem/tipo inválidos → fail-closed (não delete silencioso)', () => {
  assert.throws(
    () => toClienteMasterHttpPayload({
      nome: 'Sintético',
      tipo: 'Alienigena',
      documento: '012.345.678-90',
    }),
    (err) => err?.code === CLIENTE_HTTP_UNSUPPORTED_FIELDS && err.fields.includes('tipo'),
  );
  assert.throws(
    () => toClienteMasterHttpPayload({
      nome: 'Sintético',
      tipo: 'Pessoa Física',
      documento: '012.345.678-90',
      origem: 'ORIGEM_INVENTADA',
    }),
    (err) => err?.code === CLIENTE_HTTP_UNSUPPORTED_FIELDS && err.fields.includes('origem'),
  );
});

test('defaults vazios de endereço/condição não bloqueiam MASTER', () => {
  assert.doesNotThrow(() => assertClienteHttpRichFieldsWritable({
    endereco_principal: { cep: '', logradouro: '', cidade: '' },
    condicao_comercial: {
      tabela_preco_id: '',
      percentual_desconto: 0,
      condicao_pagamento: 'À Vista',
      limite_credito: 0,
    },
  }));
  const wire = toClienteMasterHttpPayload({
    nome: 'Sintético PF',
    tipo: 'Pessoa Física',
    documento: '012.345.678-90',
    email: 'a@b.c',
  });
  assert.equal(wire.documento.replace(/\D/g, ''), '01234567890');
  assert.equal(wire.tipo, 'Pessoa Física');
});

test('hydrate: documento → cpf/cnpj + tipo; zeros preservados', () => {
  const pf = hydrateClienteHttpRowForUi({ documento: '012.345.678-90', nome: 'Ana' });
  assert.equal(pf.cpf, '012.345.678-90');
  assert.equal(pf.tipo, 'Pessoa Física');
  const pj = hydrateClienteHttpRowForUi({
    documento: '11.222.333/0001-81',
    razao_social: 'SYN LTDA',
    nome_fantasia: 'SYN',
  });
  assert.equal(pj.cnpj, '11.222.333/0001-81');
  assert.equal(pj.tipo, 'Pessoa Jurídica');
  assert.equal(pj.razao_social, 'SYN LTDA');
  assert.equal(pj.nome_fantasia, 'SYN');
});

test('mapClienteLocalToUiEndereco: COBRANÇA ≠ ENTREGA; sem WhatsApp', () => {
  const cob = mapClienteLocalToUiEndereco({
    id: 'loc-1',
    nome: 'Financeiro',
    cep: '01310100',
    logradouro: 'Av',
    numero: '100',
    bairro: 'Bela',
    cidade: 'SP',
    uf: 'SP',
    finalidades: [{ finalidade: 'COBRANCA', principal: true }],
  });
  assert.equal(cob.tipo_endereco, 'Cobrança');
  assert.equal(cob.estado, 'SP');
  assert.equal(cob.principal, true);
  const ent = mapClienteLocalToUiEndereco({
    nome: 'Obra',
    finalidades: [{ finalidade: 'ENTREGA', principal: false }],
  });
  assert.equal(ent.tipo_endereco, 'Entrega');
});
