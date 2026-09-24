import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChaveIdempotenteMigracaoLegado,
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
} from '../scripts/legado/mapear-registro-sintetico.mjs';

test('mapear legado sintetico cliente carimba staging e remove segredo', () => {
  const out = mapLegadoRowToCanonicalStub({
    cod_cliente: 'LEG-9',
    razao_social: 'Acme Sintetica',
    cnpj: '123',
    senha: 'segredo',
    password: 'x',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'cliente', arquivoNome: 'cli.csv' });

  assert.equal(out.codigo_legado, 'LEG-9');
  assert.equal(out.nome, 'Acme Sintetica');
  assert.equal(out.origem_migracao, 'erp_antigo');
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.importacao_erp, true);
  assert.equal('senha' in out, false);
  assert.equal('password' in out, false);
  assert.match(String(out.lote_migracao), /^MIG-/);
  assert.equal(out.chave_idempotente_migracao, 'g1|e1|erp_antigo|cliente|LEG-9');
});

test('mapear legado sintetico produto usa descricao', () => {
  const out = mapLegadoRowToCanonicalStub({
    sku: 'SKU-1',
    produto: 'Chapa sintetica',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'produto', arquivoNome: 'prod.csv' });
  assert.equal(out.codigo_legado, 'SKU-1');
  assert.equal(out.descricao, 'Chapa sintetica');
  assert.match(out.chave_idempotente_migracao, /\|produto\|SKU-1$/);
});

test('mapear legado sintetico empresa', () => {
  const out = mapLegadoRowToCanonicalStub({
    codigoempresa: '2',
    razao_social: 'Empresa Sintetica',
    cnpj: '999',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'empresa', arquivoNome: 'emp.csv' });
  assert.equal(out.codigo_legado, '2');
  assert.equal(out.nome, 'Empresa Sintetica');
});

test('mapear legado sintetico falha sem codigo/nome', () => {
  assert.throws(() => mapLegadoRowToCanonicalStub({ foo: 'bar' }, { entidade: 'cliente' }));
});

test('chave idempotente exige group e legado', () => {
  assert.throws(() => buildChaveIdempotenteMigracaoLegado({ codigo_legado: 'X' }));
});

test('lote sintetico detecta duplicata e reconcilia quantidade', () => {
  const lote = mapLegadoLoteSintetico([
    { cod_cliente: 'A1', nome: 'Um', group_id: 'g1', empresa_id: 'e1', valor: 10 },
    { cod_cliente: 'A1', nome: 'Um dup', group_id: 'g1', empresa_id: 'e1', valor: 10 },
    { cod_cliente: 'A2', nome: 'Dois', group_id: 'g1', empresa_id: 'e1', valor: 5 },
  ], { entidade: 'cliente', arquivoNome: 'lote.csv' });

  assert.equal(lote.gravados.length, 2);
  assert.equal(lote.reusos.length, 1);
  assert.equal(lote.erros.length, 0);
  assert.equal(lote.reconciliacao.quantidade_origem, 3);
  assert.equal(lote.reconciliacao.quantidade_gravada, 2);
  assert.equal(lote.reconciliacao.quantidade_reuso, 1);
  assert.equal(lote.reconciliacao.divergencia_quantidade, 0);
  assert.equal(lote.destino_migracao, 'staging');
  assert.equal(new Set(lote.chaves).size, 2);
});

test('lote sintetico vazio falha', () => {
  assert.throws(() => mapLegadoLoteSintetico([]));
});
