import assert from 'node:assert/strict';
import test from 'node:test';
import {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  LEGADO_EMPRESA_CODIGOS_VALIDOS,
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
  resolverEmpresaLegadoCodigo,
} from '../scripts/legado/mapear-registro-sintetico.mjs';

const grupo = { groupId: 'g1' };
const vinculos = {
  groupId: 'g1',
  empresas: {
    '001': { empresaId: 'e-cpa', comprovado: true },
    '002': { empresaId: 'e-3z', comprovado: true },
    '005': { empresaId: 'e-zuc', comprovado: true },
  },
};

test('mapear legado sintetico cliente carimba staging e remove segredo', () => {
  const out = mapLegadoRowToCanonicalStub({
    cod_cliente: 'LEG-9',
    razao_social: 'Acme Sintetica',
    cnpj: '123',
    senha: 'segredo',
    password: 'x',
    group_id: 'g1',
    codigo_empresa: '001',
  }, { entidade: 'cliente', arquivoNome: 'cli.csv', ...grupo });

  assert.equal(out.codigo_legado, 'LEG-9');
  assert.equal(out.nome, 'Acme Sintetica');
  assert.equal(out.origem_migracao, 'erp_antigo');
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.importacao_erp, true);
  assert.equal(out.quarentena, false);
  assert.equal(out.escopo_aceito, true);
  assert.equal(out.escopo_mestre, 'grupo');
  assert.equal(out.empresa_id, undefined);
  assert.equal(out.codigo_empresa_legado, '001');
  assert.equal('senha' in out, false);
  assert.equal('password' in out, false);
  assert.match(String(out.lote_migracao), /^MIG-/);
  assert.equal(out.chave_idempotente_migracao, 'g1|grupo|erp_antigo|cliente|LEG-9');
});

test('mapear legado sintetico produto de revenda usa descricao no grupo', () => {
  const out = mapLegadoRowToCanonicalStub({
    sku: 'SKU-1',
    produto: 'Chapa sintetica',
    group_id: 'g1',
    revenda: true,
  }, { entidade: 'produto', arquivoNome: 'prod.csv', ...grupo });
  assert.equal(out.codigo_legado, 'SKU-1');
  assert.equal(out.descricao, 'Chapa sintetica');
  assert.equal(out.empresa_id, undefined);
  assert.match(out.chave_idempotente_migracao, /\|produto\|SKU-1$/);
});

test('produto que nao e revenda e usuario legado sao excluidos', () => {
  assert.throws(
    () => mapLegadoRowToCanonicalStub({ sku: 'SKU-F', produto: 'Fabricado', group_id: 'g1' }, { entidade: 'produto', ...grupo }),
    /produto_nao_revenda/,
  );
  assert.throws(
    () => mapLegadoRowToCanonicalStub({ codigo: 'U1', nome: 'Operador', senha: 'segredo', group_id: 'g1' }, { entidade: 'usuario', ...grupo }),
    /usuario_legado_excluido/,
  );
  const produtos = mapLegadoLoteSintetico([
    { sku: 'SKU-F', produto: 'Fabricado', group_id: 'g1', senha: 'segredo' },
  ], { entidade: 'produto', ...grupo });
  const usuarios = mapLegadoLoteSintetico([
    { codigo: 'U1', nome: 'Operador', senha: 'segredo', password: 'x', group_id: 'g1' },
  ], { entidade: 'usuario', ...grupo });
  assert.equal(produtos.excluidos[0].motivo, 'produto_nao_revenda');
  assert.equal(usuarios.excluidos[0].motivo, 'usuario_legado_excluido');
  assert.equal(produtos.gravados.length + usuarios.gravados.length, 0);
  assert.equal(JSON.stringify({ produtos, usuarios }).includes('segredo'), false);
});

test('mapear legado sintetico empresa sem vinculo juridico fica em quarentena', () => {
  const out = mapLegadoRowToCanonicalStub({
    codigoempresa: '2',
    razao_social: 'Empresa Sintetica',
    cnpj: '999',
    group_id: 'g1',
  }, { entidade: 'empresa', arquivoNome: 'emp.csv', ...grupo });
  assert.equal(out.codigo_legado, '2');
  assert.equal(out.nome, 'Empresa Sintetica');
  assert.equal(out.codigo_empresa_legado, '002');
  assert.equal(out.quarentena, true);
  assert.ok(out.quarentena_motivos.includes('vinculo_juridico_nao_comprovado'));
  assert.equal(out.empresa_id, undefined);
  assert.equal(out.group_id, undefined);
});

test('mapear legado sintetico obra e condicao_pagamento no grupo', () => {
  const obra = mapLegadoRowToCanonicalStub({
    cod_obra: 'OB-1',
    nome_obra: 'Obra Sintetica',
    group_id: 'g1',
    codigo_empresa: '001',
  }, { entidade: 'obra', ...grupo });
  assert.equal(obra.codigo_legado, 'OB-1');
  assert.equal(obra.nome, 'Obra Sintetica');
  assert.equal(obra.empresa_id, undefined);
  assert.equal(obra.escopo_mestre, 'grupo');

  const cond = mapLegadoRowToCanonicalStub({
    cod_condicao: 'CP-30',
    descricao: '30 dias sintetico',
    group_id: 'g1',
  }, { entidade: 'condicao_pagamento', ...grupo });
  assert.equal(cond.codigo_legado, 'CP-30');
  assert.match(cond.chave_idempotente_migracao, /\|condicao_pagamento\|CP-30$/);
});

test('tabela_preco no grupo; pedido e orcamento exigem empresa comprovada', () => {
  const tab = mapLegadoRowToCanonicalStub({
    codigo_tabela_legado: 'TAB-S1',
    nome_tabela: 'Tabela Sintetica',
    group_id: 'g1',
  }, { entidade: 'tabela_preco', arquivoNome: 'tab.csv', ...grupo });
  assert.equal(tab.codigo_legado, 'TAB-S1');
  assert.equal(tab.nome, 'Tabela Sintetica');
  assert.equal(tab.destino_migracao, 'staging');
  assert.equal(tab.quarentena, false);
  assert.match(tab.chave_idempotente_migracao, /\|tabela_preco\|TAB-S1$/);

  const orc = mapLegadoRowToCanonicalStub({
    numero_orcamento: 'ORC-9',
    referencia: 'Orcamento sintetico',
    group_id: 'g1',
    codigo_empresa: '005',
  }, { entidade: 'orcamento', ...grupo, vinculosComprovados: vinculos });
  assert.equal(orc.codigo_legado, 'ORC-9');
  assert.equal(orc.empresa_id, 'e-zuc');
  assert.equal(orc.visivel_consolidado_grupo, true);

  const pedSemVinculo = mapLegadoRowToCanonicalStub({
    numero_pedido: 'PED-3',
    titulo: 'Pedido sintetico',
    group_id: 'g1',
    codigo_empresa: '001',
  }, { entidade: 'pedido', ...grupo });
  assert.equal(pedSemVinculo.quarentena, true);
  assert.ok(pedSemVinculo.quarentena_motivos.includes('vinculo_juridico_nao_comprovado'));
  assert.equal(pedSemVinculo.empresa_id, undefined);

  const ped = mapLegadoRowToCanonicalStub({
    numero_pedido: 'PED-3',
    titulo: 'Pedido sintetico',
    group_id: 'g1',
    codigo_empresa: '001',
    preco: 10,
    valor: 99,
  }, { entidade: 'pedido', ...grupo, vinculosComprovados: vinculos });
  assert.equal(ped.codigo_legado, 'PED-3');
  assert.equal(ped.quarentena, false);
  assert.equal(ped.group_id, 'g1');
  assert.equal(ped.empresa_id, 'e-cpa');
  assert.equal(ped.visivel_consolidado_grupo, true);
  assert.equal(ped.duplicacao_fisica, false);
  assert.equal(ped.comprovado_juridico, true);
  assert.equal('preco' in ped, false);
  assert.equal('valor' in ped, false);
  assert.match(ped.chave_idempotente_migracao, /^g1\|e-cpa\|erp_antigo\|pedido\|PED-3$/);
});

test('quarentena codigo empresa 0 preserva contexto e nao promove o payload', () => {
  const q = avaliarQuarentenaLegado({ codigo_empresa: '0', group_id: 'g1' }, { entidade: 'cliente', ...grupo });
  assert.equal(q.quarentena, true);
  assert.ok(q.motivos.includes('codigo_empresa_legado_0'));

  const out = mapLegadoRowToCanonicalStub({
    cod_cliente: 'X',
    nome: 'Quarentena',
    group_id: 'g1',
    codigo_empresa: '0',
  }, { entidade: 'cliente', ...grupo });
  assert.equal(out.quarentena, true);
  assert.equal(out.status_migracao, 'PENDING_MANUAL_RECONCILIATION');
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.group_id, 'g1');
  assert.equal(out.empresa_id, undefined);
});

test('seletor preserva zeros: 002 conhecido, 003 grupo, 004 nao comprovado', () => {
  assert.deepEqual([...LEGADO_EMPRESA_CODIGOS_VALIDOS], ['001', '002', '005']);
  const e2 = resolverEmpresaLegadoCodigo('2');
  assert.equal(e2.conhecido, true);
  assert.equal(e2.codigo, '002');
  assert.equal(e2.label, '3Z_Armacao');
  assert.equal(e2.papel, 'empresa');
  assert.equal(e2.comprovadoJuridico, false);

  const grupo003 = resolverEmpresaLegadoCodigo('003');
  assert.equal(grupo003.papel, 'grupo');
  assert.equal(grupo003.label, 'GRUPO_CPA');

  const e4 = mapLegadoRowToCanonicalStub({
    cod_cliente: 'Y',
    nome: 'Cliente codigo ausente no seletor',
    group_id: 'g1',
    codigo_empresa: '4',
  }, { entidade: 'cliente', ...grupo });
  assert.equal(e4.quarentena, true);
  assert.equal(e4.codigo_empresa_legado, '004');
  assert.ok(e4.quarentena_motivos.includes('codigo_empresa_legado_nao_comprovado'));
  assert.equal(e4.quarentena_motivos.includes('codigo_empresa_legado_inativa'), false);
  assert.equal(e4.empresa_legado_label, undefined);
});

test('003 nao vira empresa emissora e tipo de nota nao vira codigo de empresa', () => {
  const pedidoGrupo = mapLegadoRowToCanonicalStub({
    numero_pedido: 'PED-G',
    titulo: 'So grupo',
    group_id: 'g1',
    codigo_empresa: '003',
  }, { entidade: 'pedido', ...grupo, empresaId: 'e-cpa', vinculosComprovados: vinculos });
  assert.equal(pedidoGrupo.quarentena, true);
  assert.ok(pedidoGrupo.quarentena_motivos.includes('codigo_grupo_nao_e_emissor'));
  assert.equal(pedidoGrupo.codigo_grupo_legado, '003');
  assert.equal(pedidoGrupo.codigo_empresa_legado, undefined);
  assert.equal(pedidoGrupo.empresa_id, undefined);
  assert.notEqual(pedidoGrupo.empresa_id, 'e-cpa');

  const nota = mapLegadoRowToCanonicalStub({
    numero_nota: 'NF-1',
    titulo: 'Nota sintetica',
    group_id: 'g1',
    codigo_tipo_nota: '001',
    codigo_empresa: '002',
  }, { entidade: 'nota_fiscal', ...grupo, vinculosComprovados: vinculos });
  assert.equal(nota.quarentena, false);
  assert.equal(nota.codigo_tipo_nota_legado, '001');
  assert.equal(nota.codigo_empresa_legado, '002');
  assert.equal(nota.empresa_id, 'e-3z');

  const soTipo = mapLegadoRowToCanonicalStub({
    numero_nota: 'NF-2',
    titulo: 'Tipo sem emissor',
    group_id: 'g1',
    codigo_tipo_nota: '001',
  }, { entidade: 'nota_fiscal', ...grupo, vinculosComprovados: vinculos });
  assert.equal(soTipo.quarentena, true);
  assert.ok(soTipo.quarentena_motivos.includes('empresa_nao_comprovada'));
  assert.equal(soTipo.codigo_tipo_nota_legado, '001');
  assert.equal(soTipo.empresa_id, undefined);
});

test('opts nao substitui grupo ou empresa divergentes e payload sozinho nao autentica', () => {
  const externo = mapLegadoRowToCanonicalStub({
    cod_cliente: 'C-EXT',
    nome: 'Grupo externo',
    group_id: 'g-externo',
    codigo_empresa: '001',
  }, { entidade: 'cliente', groupId: 'g-autorizado' });
  assert.equal(externo.quarentena, true);
  assert.ok(externo.quarentena_motivos.includes('grupo_divergente'));
  assert.equal(externo.group_id, undefined);
  assert.notEqual(externo.group_id, 'g-autorizado');
  assert.match(externo.chave_idempotente_migracao, /^QX\|g-autorizado\|g-externo\|cliente\|C-EXT$/);

  const soPayload = mapLegadoRowToCanonicalStub({
    cod_cliente: 'C-PAY',
    nome: 'So payload',
    group_id: 'g1',
    empresa_id: 'e-forjada',
  }, { entidade: 'cliente' });
  assert.ok(soPayload.quarentena_motivos.includes('escopo_somente_payload'));
  assert.equal(soPayload.group_id, undefined);
  assert.equal(soPayload.empresa_id, undefined);

  const empresaOpts = mapLegadoRowToCanonicalStub({
    numero_pedido: 'PED-D',
    titulo: 'Divergente',
    group_id: 'g1',
    empresa_id: 'e-payload',
    codigo_empresa: '001',
  }, { entidade: 'pedido', ...grupo, empresaId: 'e-opts', vinculosComprovados: vinculos });
  assert.ok(empresaOpts.quarentena_motivos.includes('empresa_divergente'));
  assert.equal(empresaOpts.empresa_id, undefined);
  assert.notEqual(empresaOpts.empresa_id, 'e-opts');
  assert.notEqual(empresaOpts.empresa_id, 'e-payload');
  assert.notEqual(empresaOpts.empresa_id, 'e-cpa');
});

test('mestre compartilhado nao duplica entre empresas; operacao A/B permanece distinta', () => {
  const clientes = mapLegadoLoteSintetico([
    { cod_cliente: 'C-1', nome: 'Um', group_id: 'g1', codigo_empresa: '001' },
    { cod_cliente: 'C-1', nome: 'Um na outra', group_id: 'g1', codigo_empresa: '002' },
  ], { entidade: 'cliente', ...grupo });
  assert.equal(clientes.gravados.length, 1);
  assert.equal(clientes.reusos.length, 1);
  assert.equal(clientes.gravados[0].empresa_id, undefined);
  assert.equal(clientes.gravados[0].escopo_mestre, 'grupo');

  const fornecedor = mapLegadoRowToCanonicalStub({
    cod_fornecedor: 'F-1',
    razao_social: 'Fornecedor sintetico',
    group_id: 'g1',
    codigo_empresa: '005',
  }, { entidade: 'fornecedor', ...grupo });
  assert.equal(fornecedor.codigo_legado, 'F-1');
  assert.equal(fornecedor.escopo_mestre, 'grupo');
  assert.equal(fornecedor.empresa_id, undefined);
  assert.equal(fornecedor.codigo_empresa_legado, '005');

  const pedidos = mapLegadoLoteSintetico([
    { numero_pedido: 'PED-1', titulo: 'A', group_id: 'g1', codigo_empresa: '001' },
    { numero_pedido: 'PED-1', titulo: 'B', group_id: 'g1', codigo_empresa: '002' },
  ], { entidade: 'pedido', ...grupo, vinculosComprovados: vinculos });
  assert.equal(pedidos.gravados.length, 2);
  assert.equal(pedidos.gravados[0].empresa_id, 'e-cpa');
  assert.equal(pedidos.gravados[1].empresa_id, 'e-3z');
  assert.equal(pedidos.gravados[0].visivel_consolidado_grupo, true);
  assert.equal(pedidos.gravados[0].duplicacao_fisica, false);

  const estoque = mapLegadoRowToCanonicalStub({
    cod_estoque: 'E-1',
    descricao: 'Saldo sintetico',
    group_id: 'g1',
    codigo_empresa: '005',
  }, { entidade: 'estoque', ...grupo, vinculosComprovados: vinculos });
  assert.equal(estoque.empresa_id, 'e-zuc');
  assert.equal(estoque.quarentena, false);

  const tituloGrupo = mapLegadoRowToCanonicalStub({
    numero_titulo: 'CR-1',
    descricao: 'Receber sem emissor',
    group_id: 'g1',
    codigo_grupo: '003',
  }, { entidade: 'contas_receber', ...grupo, vinculosComprovados: vinculos });
  assert.equal(tituloGrupo.quarentena, true);
  assert.ok(tituloGrupo.quarentena_motivos.includes('codigo_grupo_nao_e_emissor'));
  assert.equal(tituloGrupo.empresa_id, undefined);
});

test('retry idempotente contra indice de staging nao republica', () => {
  const rows = [
    { numero_pedido: 'PED-R', titulo: 'Retry', group_id: 'g1', codigo_empresa: '001' },
    { numero_pedido: 'PED-Q', titulo: 'Quarentena retry', group_id: 'g-externo', codigo_empresa: '001' },
  ];
  const primeiro = mapLegadoLoteSintetico(rows, { entidade: 'pedido', ...grupo, vinculosComprovados: vinculos });
  assert.equal(primeiro.gravados.length, 2);
  const segundo = mapLegadoLoteSintetico(rows, {
    entidade: 'pedido',
    ...grupo,
    vinculosComprovados: vinculos,
    indiceStaging: primeiro.gravados,
  });
  assert.equal(segundo.gravados.length, 0);
  assert.equal(segundo.reusos.length, 2);
  assert.equal(segundo.reusos[0].reuso_de, primeiro.chaves[0]);
  assert.equal(segundo.reconciliacao.divergencia_quantidade, 0);
});

test('linha com getter invalido falha fechada', () => {
  const row = {};
  Object.defineProperty(row, 'cod_cliente', {
    enumerable: true,
    get() { throw new Error('boom'); },
  });
  assert.throws(() => mapLegadoRowToCanonicalStub(row, { entidade: 'cliente', ...grupo }), /linha_com_getter_invalido/);
});

test('mapear legado sintetico falha sem codigo/nome', () => {
  assert.throws(() => mapLegadoRowToCanonicalStub({ foo: 'bar', group_id: 'g1' }, { entidade: 'cliente', ...grupo }));
});

test('chave idempotente exige legado e, se aceita, group_id', () => {
  assert.throws(() => buildChaveIdempotenteMigracaoLegado({ escopo_aceito: true }));
  assert.throws(() => buildChaveIdempotenteMigracaoLegado({ escopo_aceito: true, codigo_legado: 'X' }));
  assert.match(
    buildChaveIdempotenteMigracaoLegado({ codigo_legado: 'X', group_id_contexto: 'g1' }),
    /^QX\|g1\|sem-payload\|registro\|X$/,
  );
});

test('lote sintetico detecta duplicata, quarentena e reconcilia', () => {
  const lote = mapLegadoLoteSintetico([
    { cod_cliente: 'A1', nome: 'Um', group_id: 'g1', valor: 10, codigo_empresa: '001' },
    { cod_cliente: 'A1', nome: 'Um dup', group_id: 'g1', valor: 10, codigo_empresa: '001' },
    { cod_cliente: 'A2', nome: 'Dois', group_id: 'g1', valor: 5, codigo_empresa: '001' },
    { cod_cliente: 'A0', nome: 'Zero', group_id: 'g1', valor: 1, codigo_empresa: '0' },
  ], { entidade: 'cliente', arquivoNome: 'lote.csv', ...grupo });

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
