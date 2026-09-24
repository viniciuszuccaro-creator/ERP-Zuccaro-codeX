import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
});

test('mapear legado sintetico falha sem codigo/nome', () => {
  assert.throws(() => mapLegadoRowToCanonicalStub({ foo: 'bar' }, { entidade: 'cliente' }));
});
