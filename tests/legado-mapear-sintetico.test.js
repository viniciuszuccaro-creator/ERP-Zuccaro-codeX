import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
  resolverEmpresaLegadoCodigo,
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
    codigo_empresa: '1',
  }, { entidade: 'cliente', arquivoNome: 'cli.csv' });

  assert.equal(out.codigo_legado, 'LEG-9');
  assert.equal(out.nome, 'Acme Sintetica');
  assert.equal(out.origem_migracao, 'erp_antigo');
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.importacao_erp, true);
  assert.equal(out.quarentena, false);
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

test('mapear legado sintetico obra e condicao_pagamento', () => {
  const obra = mapLegadoRowToCanonicalStub({
    cod_obra: 'OB-1',
    nome_obra: 'Obra Sintetica',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '1',
  }, { entidade: 'obra' });
  assert.equal(obra.codigo_legado, 'OB-1');
  assert.equal(obra.nome, 'Obra Sintetica');

  const cond = mapLegadoRowToCanonicalStub({
    cod_condicao: 'CP-30',
    descricao: '30 dias sintetico',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'condicao_pagamento' });
  assert.equal(cond.codigo_legado, 'CP-30');
  assert.match(cond.chave_idempotente_migracao, /\|condicao_pagamento\|CP-30$/);
});

test('quarentena codigo empresa 0', () => {
  const q = avaliarQuarentenaLegado({ codigo_empresa: '0' }, { entidade: 'cliente' });
  assert.equal(q.quarentena, true);
  assert.ok(q.motivos.includes('codigo_empresa_legado_0'));

  const out = mapLegadoRowToCanonicalStub({
    cod_cliente: 'X',
    nome: 'Quarentena',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '0',
  }, { entidade: 'cliente' });
  assert.equal(out.quarentena, true);
  assert.equal(out.status_migracao, 'PENDING_MANUAL_RECONCILIATION');
  assert.equal(out.destino_migracao, 'staging');
});

test('resolver empresa legado codigo 2 e inativa 4', () => {
  const e2 = resolverEmpresaLegadoCodigo('2');
  assert.equal(e2.conhecido, true);
  assert.equal(e2.label, '3Z_Armacao');
  const e4 = mapLegadoRowToCanonicalStub({
    cod_cliente: 'Y',
    nome: 'Cliente Belgo',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '4',
  }, { entidade: 'cliente' });
  assert.equal(e4.quarentena, true);
  assert.ok(e4.quarentena_motivos.includes('codigo_empresa_legado_inativa'));
  assert.equal(e4.empresa_legado_label, 'Belgo_Cercas');
});

test('mapear legado sintetico falha sem codigo/nome', () => {
  assert.throws(() => mapLegadoRowToCanonicalStub({ foo: 'bar' }, { entidade: 'cliente' }));
});

test('chave idempotente exige group e legado', () => {
  assert.throws(() => buildChaveIdempotenteMigracaoLegado({ codigo_legado: 'X' }));
});

test('lote sintetico detecta duplicata, quarentena e reconcilia', () => {
  const lote = mapLegadoLoteSintetico([
    { cod_cliente: 'A1', nome: 'Um', group_id: 'g1', empresa_id: 'e1', valor: 10, codigo_empresa: '1' },
    { cod_cliente: 'A1', nome: 'Um dup', group_id: 'g1', empresa_id: 'e1', valor: 10, codigo_empresa: '1' },
    { cod_cliente: 'A2', nome: 'Dois', group_id: 'g1', empresa_id: 'e1', valor: 5, codigo_empresa: '1' },
    { cod_cliente: 'A0', nome: 'Zero', group_id: 'g1', empresa_id: 'e1', valor: 1, codigo_empresa: '0' },
  ], { entidade: 'cliente', arquivoNome: 'lote.csv' });

  assert.equal(lote.gravados.length, 3);
  assert.equal(lote.reusos.length, 1);
  assert.equal(lote.quarentenas.length, 1);
  assert.equal(lote.erros.length, 0);
  assert.equal(lote.reconciliacao.quantidade_origem, 4);
  assert.equal(lote.reconciliacao.quantidade_gravada, 3);
  assert.equal(lote.reconciliacao.quantidade_reuso, 1);
  assert.equal(lote.reconciliacao.divergencia_quantidade, 0);
  assert.equal(lote.destino_migracao, 'staging');
  assert.equal(new Set(lote.chaves).size, 3);
});

test('lote sintetico vazio falha', () => {
  assert.throws(() => mapLegadoLoteSintetico([]));
});
