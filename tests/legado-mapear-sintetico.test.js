import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  LEGADO_EMPRESA_CODIGOS_JURIDICOS,
  LEGADO_MESTRES_GRUPO,
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
  normalizarCodigoEmpresaLegado,
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
  assert.equal(out.codigo_empresa_legado, '001');
  assert.equal(out.empresa_legado_apto, true);
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

test('mestre no Grupo sem empresaId usa chave grupo', () => {
  assert.ok(LEGADO_MESTRES_GRUPO.has('cliente'));
  const out = mapLegadoRowToCanonicalStub({
    cod_cliente: 'M-1',
    nome: 'Mestre Sintetico',
    group_id: 'g1',
  }, { entidade: 'cliente', escopoMestreGrupo: true });
  assert.equal(out.empresa_id, '');
  assert.equal(out.chave_idempotente_migracao, 'g1|grupo|erp_antigo|cliente|M-1');
  assert.equal(out.quarentena, false);
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

test('mapear legado sintetico obra, condicao, tabela, orcamento, pedido e fornecedor', () => {
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
  }, { entidade: 'condicao_pagamento', escopoMestreGrupo: true });
  assert.equal(cond.codigo_legado, 'CP-30');
  assert.match(cond.chave_idempotente_migracao, /\|condicao_pagamento\|CP-30$/);

  const tab = mapLegadoRowToCanonicalStub({
    codigo_tabela_legado: 'TP-1',
    nome_tabela: 'Tabela Sintetica',
    group_id: 'g1',
  }, { entidade: 'tabela_preco', escopoMestreGrupo: true });
  assert.equal(tab.codigo_legado, 'TP-1');

  const orc = mapLegadoRowToCanonicalStub({
    numero_orcamento: 'OR-9',
    titulo: 'Orcamento Sintetico',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '002',
  }, { entidade: 'orcamento' });
  assert.equal(orc.codigo_legado, 'OR-9');
  assert.equal(orc.codigo_empresa_legado, '002');

  const ped = mapLegadoRowToCanonicalStub({
    numero_pedido: 'PD-9',
    referencia: 'Pedido Sintetico',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '5',
  }, { entidade: 'pedido' });
  assert.equal(ped.codigo_legado, 'PD-9');
  assert.equal(ped.codigo_empresa_legado, '005');
  assert.equal(ped.empresa_legado_apto, true);

  const forn = mapLegadoRowToCanonicalStub({
    cod_fornecedor: 'F-1',
    nome_fornecedor: 'Fornecedor Sintetico',
    group_id: 'g1',
  }, { entidade: 'fornecedor', escopoMestreGrupo: true });
  assert.equal(forn.codigo_legado, 'F-1');
  assert.equal(forn.empresa_id, '');
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

test('Grupo 003 e aliases 3/003 nao viram empresa emissora', () => {
  assert.deepEqual(LEGADO_EMPRESA_CODIGOS_JURIDICOS, ['001', '002', '005']);
  for (const raw of ['3', '003']) {
    const r = resolverEmpresaLegadoCodigo(raw);
    assert.equal(r.codigo, '003');
    assert.equal(r.tipo, 'grupo_seletor');
    assert.equal(r.aptoComoEmpresa, false);
    assert.equal(r.quarentena, true);
    const q = avaliarQuarentenaLegado({ codigo_empresa: raw }, { entidade: 'cliente' });
    assert.ok(q.motivos.includes('codigo_empresa_legado_grupo_seletor'));
    const out = mapLegadoRowToCanonicalStub({
      cod_cliente: `G-${raw}`,
      nome: 'Seletor Grupo',
      group_id: 'g1',
      codigo_empresa: raw,
    }, { entidade: 'cliente', escopoMestreGrupo: true });
    assert.equal(out.quarentena, true);
    assert.equal(out.empresa_legado_apto, false);
    assert.equal(out.codigo_empresa_legado, '003');
  }
});

test('normaliza 1/2/5 e rejeita nao numerico ou overflow', () => {
  assert.equal(normalizarCodigoEmpresaLegado('1'), '001');
  assert.equal(normalizarCodigoEmpresaLegado('02'), '002');
  assert.equal(normalizarCodigoEmpresaLegado('005'), '005');
  assert.equal(normalizarCodigoEmpresaLegado('abc'), 'abc');
  assert.equal(normalizarCodigoEmpresaLegado('0001'), '0001');
  assert.equal(normalizarCodigoEmpresaLegado('1x'), '1x');
  for (const raw of ['abc', '1x', '0001', '999']) {
    const q = avaliarQuarentenaLegado({ codigo_empresa: raw }, { entidade: 'pedido' });
    assert.ok(q.motivos.includes('codigo_empresa_legado_desconhecido'), raw);
  }
});

test('resolver empresa legado codigo 2 e inativa 4', () => {
  const e2 = resolverEmpresaLegadoCodigo('2');
  assert.equal(e2.conhecido, true);
  assert.equal(e2.codigo, '002');
  assert.equal(e2.label, '3Z_Armacao');
  assert.equal(e2.aptoComoEmpresa, true);
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
  assert.equal(e4.codigo_empresa_legado, '004');
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
    { cod_cliente: 'A3', nome: 'GrupoSeletor', group_id: 'g1', valor: 1, codigo_empresa: '003' },
  ], { entidade: 'cliente', arquivoNome: 'lote.csv' });

  assert.equal(lote.gravados.length, 4);
  assert.equal(lote.reusos.length, 1);
  assert.equal(lote.quarentenas.length, 2);
  assert.equal(lote.erros.length, 0);
  assert.equal(lote.reconciliacao.quantidade_origem, 5);
  assert.equal(lote.reconciliacao.quantidade_gravada, 4);
  assert.equal(lote.reconciliacao.quantidade_reuso, 1);
  assert.equal(lote.reconciliacao.divergencia_quantidade, 0);
  assert.equal(lote.destino_migracao, 'staging');
  assert.equal(new Set(lote.chaves).size, 4);
  const q003 = lote.quarentenas.find((q) => q.codigo_legado === 'A3');
  assert.ok(q003.motivos.includes('codigo_empresa_legado_grupo_seletor'));
});

test('lote sintetico vazio falha', () => {
  assert.throws(() => mapLegadoLoteSintetico([]));
});
