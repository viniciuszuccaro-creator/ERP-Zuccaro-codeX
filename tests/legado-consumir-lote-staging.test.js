import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuditoriaConsumoLegado,
  consumirLoteStagingIdempotente,
  consumirLoteStagingLegado,
  validarDependenciasLegado,
} from '../scripts/legado/consumir-lote-staging.mjs';

const CONTRATO_SINTETICO = {
  coorte: 'sintetico-teste',
  crosswalkEmpresas: { 1: 'e1', 2: 'e1', 3: 'e1', 5: 'e1' },
};

test('consumidor staging separa comprovados, quarentena, reuso e rejeicao', () => {
  const out = consumirLoteStagingLegado([
    {
      cod_cliente: 'C-1',
      razao_social: 'Ok Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-1',
      razao_social: 'Ok Sintetico',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-0',
      nome: 'Quarentena',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '0',
      valor: 1,
    },
  ], { entidade: 'cliente', contratoEntrada: CONTRATO_SINTETICO });

  assert.equal(out.importado_operacional, false);
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.contrato_entrada, true);
  assert.equal(out.comprovados.length, 1);
  assert.equal(out.comprovados[0].scopeType, 'group');
  assert.equal(out.comprovados[0].empresa_id, undefined);
  assert.equal(out.reusos.length, 1);
  assert.equal(out.quarentena.length, 1);
  assert.equal(out.auditoria.length >= 2, true);
  assert.equal(out.reconciliacao.quantidade_origem, 3);
});

test('sem contrato de entrada nao comprova (quarentena)', () => {
  const out = consumirLoteStagingLegado([{
    cod_cliente: 'C-1',
    razao_social: 'Sem contrato',
    cnpj: '00000000000191',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '1',
  }], { entidade: 'cliente' });
  assert.equal(out.comprovados.length, 0);
  assert.equal(out.quarentena.length >= 1, true);
  assert.ok(out.quarentena.some((q) => (q.motivos || []).includes('contrato_entrada_ausente')));
});

test('consumidor staging e idempotente na segunda passagem', () => {
  const rows = [{
    cod_fornecedor: 'F-1',
    razao_social: 'Forn Sintetico',
    cnpj: '00000000000191',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa: '2',
  }];
  const { primeiro, segundo } = consumirLoteStagingIdempotente(rows, {
    entidade: 'fornecedor',
    contratoEntrada: CONTRATO_SINTETICO,
  });
  assert.equal(primeiro.comprovados.length, 1);
  assert.equal(segundo.comprovados.length, 0);
  assert.equal(segundo.reusos.some((r) => r.motivo === 'idempotente_ja_consumido'), true);
});

test('validarDependencias e auditoria sanitizada', () => {
  const bad = validarDependenciasLegado({ entidade_migracao: 'cliente', codigo_legado: 'X' });
  assert.equal(bad.ok, false);
  assert.ok(bad.rejeicoes.includes('group_id_obrigatorio'));
  assert.ok(bad.rejeicoes.includes('empresa_destino_obrigatoria'));
  assert.ok(bad.rejeicoes.includes('contrato_entrada_ausente'));

  const ok = validarDependenciasLegado({
    entidade_migracao: 'cliente',
    codigo_legado: 'C-1',
    group_id: 'g1',
    empresa_id: 'e1',
    codigo_empresa_legado: '1',
  }, {
    crosswalkEmpresas: CONTRATO_SINTETICO.crosswalkEmpresas,
    chavesEmpresa: new Set(['1', '2', '3', '5']),
    requireContratoEntrada: true,
    contratoEntradaPresente: true,
  });
  assert.equal(ok.ok, true);

  const audit = buildAuditoriaConsumoLegado({
    entidade_migracao: 'cliente',
    group_id: 'g1',
    codigo_legado: 'C-1',
    chave_idempotente_migracao: 'g1|e1|erp_antigo|cliente|C-1',
    documento: 'NAO_DEVE_APARECER_COMO_CAMPO_SENSIVEL_EXTRA',
  }, { acao: 'consumir', resultado: 'ok' });
  assert.equal(audit.importacao_erp, true);
  assert.equal(audit.codigo_legado, 'C-1');
  assert.equal('documento' in audit, false);
  assert.equal('senha' in audit, false);
});

test('mestres de Grupo dispensam empresa exclusiva, mas operacao sem empresa falha', () => {
  const master = consumirLoteStagingLegado([{
    cod_cliente: 'C-G', nome: 'Cliente Grupo', group_id: 'g1', codigo_empresa: '1',
  }], { entidade: 'cliente', contratoEntrada: { coorte: 'piloto-sintetico' } });
  assert.equal(master.comprovados.length, 1);
  assert.equal(master.comprovados[0].chave_idempotente_migracao, 'g1|grupo|erp_antigo|cliente|C-G');

  const operation = validarDependenciasLegado({
    entidade_migracao: 'obra', codigo_legado: 'O-1', group_id: 'g1', scopeType: 'empresa',
  }, { contratoEntradaPresente: true, requireContratoEntrada: true });
  assert.equal(operation.ok, false);
  assert.ok(operation.rejeicoes.includes('empresa_destino_obrigatoria'));
});

test('produto tipado conserva classe/unidade e retry; conflito sem sobrescrita', () => {
  const rows = [
    { sku: 'P-1', descricao: 'Chapa', classe: 'CHAPA', unidade: 'KG', group_id: 'g1', codigo_empresa: '1' },
    { sku: 'P-1', descricao: 'Chapa', classe: 'CHAPA', unidade: 'KG', group_id: 'g1', codigo_empresa: '2' },
    { sku: 'P-1', descricao: 'Tubo', classe: 'TUBO', unidade: 'M', group_id: 'g1', codigo_empresa: '2' },
  ];
  const opts = { entidade: 'produto', contratoEntrada: { coorte: 'piloto-sintetico' },
    produtoClassUnitMap: { 'CHAPA|KG': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'u-kg' },
      'TUBO|M': { tipo_produto: 'MATERIA_PRIMA', unidade_medida_id: 'u-m' } } };
  const { primeiro, segundo } = consumirLoteStagingIdempotente(rows, opts);
  assert.equal(primeiro.comprovados.length, 1);
  assert.equal(primeiro.reusos.length, 1);
  assert.equal(primeiro.rejeicoes.length, 1);
  assert.equal(segundo.comprovados.length, 0);
  assert.equal(segundo.rejeicoes.length, 1);
  assert.equal(primeiro.comprovados[0].unidade_medida_id, 'u-kg');
});

test('retry com mesma chave e conteúdo diferente não reutiliza venda/cadastro', () => {
  const rows = [{ cod_cliente: 'C-1', nome: 'Alterado', group_id: 'g1' }];
  const out = consumirLoteStagingLegado(rows, {
    entidade: 'cliente', contratoEntrada: { coorte: 'sintetico' },
    chavesJaGravadas: [{ chave: 'g1|grupo|erp_antigo|cliente|C-1', fingerprint: 'a'.repeat(64) }],
  });
  assert.equal(out.comprovados.length, 0);
  assert.equal(out.reusos.length, 0);
  assert.equal(out.quarentena.length, 1);
  assert.ok(out.quarentena[0].motivos.includes('reuso_sem_fingerprint_igual'));
});
