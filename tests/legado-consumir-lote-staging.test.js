import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuditoriaConsumoLegado,
  consumirLoteStagingIdempotente,
  consumirLoteStagingLegado,
  validarDependenciasLegado,
} from '../scripts/legado/consumir-lote-staging.mjs';

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
      razao_social: 'Ok dup',
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
  ], { entidade: 'cliente' });

  assert.equal(out.importado_operacional, false);
  assert.equal(out.destino_migracao, 'staging');
  assert.equal(out.comprovados.length, 1);
  assert.equal(out.reusos.length, 1);
  assert.equal(out.quarentena.length, 1);
  assert.equal(out.auditoria.length >= 2, true);
  assert.equal(out.reconciliacao.quantidade_origem, 3);
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
  const { primeiro, segundo } = consumirLoteStagingIdempotente(rows, { entidade: 'fornecedor' });
  assert.equal(primeiro.comprovados.length, 1);
  assert.equal(segundo.comprovados.length, 0);
  assert.equal(segundo.reusos.some((r) => r.motivo === 'idempotente_ja_consumido'), true);
});

test('validarDependencias e auditoria sanitizada', () => {
  const bad = validarDependenciasLegado({ entidade_migracao: 'cliente', codigo_legado: 'X' });
  assert.equal(bad.ok, false);
  assert.ok(bad.rejeicoes.includes('group_id_obrigatorio'));

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
