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
  assert.equal(out.scopeType, 'group');
  assert.equal(out.empresa_id, undefined);
  assert.equal(out.codigo_empresa_legado, '1');
  assert.equal(out.chave_idempotente_migracao, 'g1|grupo|erp_antigo|cliente|LEG-9');
});

test('mapear legado sintetico produto usa descricao', () => {
  const out = mapLegadoRowToCanonicalStub({
    sku: 'SKU-1',
    produto: 'Chapa sintetica',
    classe: 'CHAPA',
    unidade: 'KG',
    group_id: 'g1',
    empresa_id: 'e1',
  }, { entidade: 'produto', arquivoNome: 'prod.csv', produtoClassUnitMap: {
    'CHAPA|KG': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'u-kg' },
  } });
  assert.equal(out.codigo_legado, 'SKU-1');
  assert.equal(out.descricao, 'Chapa sintetica');
  assert.equal(out.tipo_item, 'Matéria-Prima Produção');
  assert.equal(out.unidade_medida_id, 'u-kg');
  assert.equal(out.empresa_id, undefined);
  assert.match(out.chave_idempotente_migracao, /\|produto\|SKU-1$/);
});

test('mapear legado sintetico fornecedor (consumidor sem mapper paralelo)', () => {
  const lote = mapLegadoLoteSintetico([
    {
      cod_fornecedor: 'F-10',
      razao_social: 'Fornecedor Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '2',
    },
    {
      cod_fornecedor: 'F-10',
      razao_social: 'Fornecedor Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '2',
    },
    {
      cod_fornecedor: 'F-0',
      nome: 'Quarentena Forn',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '0',
    },
  ], { entidade: 'fornecedor', arquivoNome: 'fornecedores_sintetico.csv' });

  assert.equal(lote.entidade, 'fornecedor');
  assert.equal(lote.gravados.length, 2);
  assert.equal(lote.reusos.length, 1);
  assert.equal(lote.quarentenas.length, 1);
  assert.equal(lote.gravados[0].nome, 'Fornecedor Sintetico');
  assert.equal(lote.gravados[0].documento, '00000000000191');
  assert.equal(lote.gravados[0].destino_migracao, 'staging');
  assert.match(lote.gravados[0].chave_idempotente_migracao, /\|fornecedor\|F-10$/);
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
    { cod_cliente: 'A1', nome: 'Um', group_id: 'g1', empresa_id: 'e1', valor: 10, codigo_empresa: '1' },
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

test('cadastro compartilhado reusa entre empresas, mas divergencia vira conflito', () => {
  const out = mapLegadoLoteSintetico([
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '1' },
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '2' },
    { cod_cliente: 'C-1', nome: 'Outro', group_id: 'g1', codigo_empresa: '2' },
  ], { entidade: 'cliente' });
  assert.equal(out.gravados.length, 1);
  assert.equal(out.reusos.length, 1);
  assert.equal(out.conflitos.length, 1);
  assert.equal(out.gravados[0].empresa_id, undefined);
  assert.deepEqual(out.gravados[0].origens_empresa_legado, ['1', '2']);
});

test('produto sem classe/unidade comprovada fica em quarentena', () => {
  const out = mapLegadoRowToCanonicalStub({
    sku: 'P-1', descricao: 'Item', group_id: 'g1', classe: 'X', unidade: 'CX',
  }, { entidade: 'produto' });
  assert.equal(out.quarentena, true);
  assert.ok(out.quarentena_motivos.includes('produto_classe_unidade_sem_mapeamento'));
  assert.equal(out.tipo_produto, undefined);
});

test('Grupo de destino nao oculta tenant divergente na origem', () => {
  for (const field of ['group_id', 'grupo_id']) {
    assert.throws(() => mapLegadoRowToCanonicalStub({
      cod_cliente: 'C-1', nome: 'Sintetico', [field]: 'outro-grupo',
    }, { entidade: 'cliente', groupId: 'grupo-destino' }), /LEGACY_GROUP_MISMATCH/);
  }
});

test('classe mapeada exige tipo canonico e unidade textual sem default', () => {
  for (const entry of [
    { tipo_produto: 'TIPO_DESCONHECIDO', unidade_medida_id: 'u-kg' },
    { tipo_produto: 'REVENDA', unidade_medida_id: '   ' },
    { tipo_produto: 'REVENDA', unidade_medida_id: {} },
  ]) {
    const out = mapLegadoRowToCanonicalStub({
      sku: 'P-1', descricao: 'Item', group_id: 'g1', classe: 'CHAPA', unidade: 'KG',
    }, { entidade: 'produto', produtoClassUnitMap: { 'CHAPA|KG': entry } });
    assert.equal(out.quarentena, true);
    assert.equal(out.tipo_produto, undefined);
    assert.equal(out.unidade_medida_id, undefined);
  }
});

test('linha em quarentena nao absorve duplicata valida posterior', () => {
  const out = mapLegadoLoteSintetico([
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '0' },
    { cod_cliente: 'C-1', nome: 'Mesmo', group_id: 'g1', codigo_empresa: '1' },
  ], { entidade: 'cliente' });
  assert.equal(out.reusos.length, 0);
  assert.equal(out.gravados.filter((r) => !r.quarentena).length, 1);
  assert.equal(out.quarentenas.length, 1);
});

test('headers do staging SQL preservam codigo original e fantasia sem inferir empresa', () => {
  const cliente = mapLegadoRowToCanonicalStub({ CODIGOCLIENTE: '0007', RAZAOSOCIAL: 'Cliente Sintetico',
    NOMEGUERRA: 'Fantasia Sintetica', CGC: '00000000000000' }, { entidade: 'cliente', groupId: 'g1' });
  assert.equal(cliente.codigo_legado, '0007');
  assert.equal(cliente.nome_fantasia, 'Fantasia Sintetica');
  assert.equal(cliente.empresa_id, undefined);
  const fornecedor = mapLegadoRowToCanonicalStub({ CODIGOFORNEC: '0009', RAZAOSOCIAL: 'Fornecedor Sintetico',
    NOMEFANTASIA: 'Fornecedor Fantasia', CGCFORNEC: '00000000000001' }, { entidade: 'fornecedor', groupId: 'g1' });
  assert.equal(fornecedor.codigo_legado, '0009');
  assert.equal(fornecedor.documento, '00000000000001');
  const lote = mapLegadoLoteSintetico([{ ...cliente }, { ...cliente, nome_fantasia: 'Outra Fantasia' }], { entidade: 'cliente' });
  assert.equal(lote.conflitos.length, 1);
});

test('material SQL usa classe e unidade da origem somente com mapa explicito', () => {
  const input = { CODIGOMATERIAL: '0012', DESCRICAO: 'Material Sintetico', CODIGOCLASSE: '08', UNIDADE: 'KG' };
  const options = { entidade: 'produto', groupId: 'g1' };
  assert.equal(mapLegadoRowToCanonicalStub(input, options).quarentena, true);
  const mapped = mapLegadoRowToCanonicalStub(input, { ...options,
    produtoClassUnitMap: { '08|KG': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'unidade-isolada' } } });
  assert.equal(mapped.quarentena, false);
  assert.equal(mapped.codigo_legado, '0012');
  assert.equal(mapped.classe_legado, '08');
  assert.equal(mapped.unidade_legado, 'KG');
});

test('produto explicito aceita chave e rotulo canonicos e grava tipo_item sem default', () => {
  for (const tipo of ['MATERIA_PRIMA', 'Matéria-Prima Produção']) {
    const out = mapLegadoRowToCanonicalStub({ sku: 'P-1', descricao: 'Item', classe: 'C', unidade: 'KG' },
      { entidade: 'produto', groupId: 'g1', produtoClassUnitMap: {
        'C|KG': { tipo_item: tipo, unidade_medida_id: 'u-kg' },
      } });
    assert.equal(out.quarentena, false);
    assert.equal(out.tipo_item, 'Matéria-Prima Produção');
    assert.equal('tipo_produto' in out, false);
  }
});

test('opcoes nao substituem empresa da operacao sem comprovacao', () => {
  assert.throws(() => mapLegadoRowToCanonicalStub({ cod_obra: 'O-1', nome: 'Obra',
    group_id: 'g1', empresa_id: 'origem', codigo_empresa: '1' },
  { entidade: 'obra', empresaId: 'destino' }), /LEGACY_COMPANY_MISMATCH/);
});
