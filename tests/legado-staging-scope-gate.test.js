import assert from 'node:assert/strict';
import test from 'node:test';
import { avaliarEscopoStagingLegado, reconciliarEscoposStaging } from '../scripts/legado/staging-scope-gate.mjs';

const vinculos = { '001': { groupId: 'g1', empresaId: 'e1', comprovado: true } };

test('mestres compartilhados ficam somente no Grupo', () => {
  for (const entidade of ['cliente', 'fornecedor', 'produto_revenda']) {
    assert.equal(avaliarEscopoStagingLegado({ entidade, groupId: 'g1' }).aptoParaStaging, true);
    assert.deepEqual(avaliarEscopoStagingLegado({ entidade, groupId: 'g1', empresaId: 'e1' }).motivos,
      ['mestre_grupo_nao_pode_ser_duplicado_na_empresa']);
  }
});

test('operacao exige vinculo juridico explicito no mesmo Grupo e Empresa', () => {
  const base = { entidade: 'pedido', codigoEmpresaLegado: '1', groupId: 'g1', empresaId: 'e1', vinculosVerificados: vinculos };
  assert.equal(avaliarEscopoStagingLegado(base).aptoParaStaging, true);
  assert.ok(avaliarEscopoStagingLegado({ ...base, empresaId: 'e2' }).motivos.includes('vinculo_juridico_nao_comprovado'));
  assert.ok(avaliarEscopoStagingLegado({ ...base, groupId: 'g2' }).motivos.includes('vinculo_juridico_nao_comprovado'));
  assert.ok(avaliarEscopoStagingLegado({ ...base, vinculosVerificados: {} }).motivos.includes('vinculo_juridico_nao_comprovado'));
});

test('grupo seletor 003, codigo zero e desconhecido nao viram empresa juridica', () => {
  for (const legado of ['003', '0', '004', '999']) {
    const result = avaliarEscopoStagingLegado({ entidade: 'nota_fiscal', codigoEmpresaLegado: legado, groupId: 'g1', empresaId: 'e1', vinculosVerificados: vinculos });
    assert.equal(result.aptoParaStaging, false);
    assert.ok(result.motivos.includes('empresa_legada_nao_comprovada'));
  }
});

test('reconciliacao publica somente totais e motivos, sem registros', () => {
  const result = reconciliarEscoposStaging([
    { entidade: 'cliente', groupId: 'g1', nome: 'Pessoa Sintetica' },
    { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1', vinculosVerificados: vinculos },
    { entidade: 'pedido', codigoEmpresaLegado: '003', groupId: 'g1', empresaId: 'e1' },
  ]);
  assert.equal(result.origem, 3);
  assert.equal(result.aptos, 2);
  assert.equal(result.quarentena, 1);
  assert.equal(JSON.stringify(result).includes('Pessoa Sintetica'), false);
});
