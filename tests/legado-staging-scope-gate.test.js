import assert from 'node:assert/strict';
import test from 'node:test';
import { avaliarEscopoStagingLegado, prepararLoteStagingLegado, reconciliarEscoposStaging } from '../scripts/legado/staging-scope-gate.mjs';

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

test('staging sintetico exige permissao, vinculo e assinatura; retry reutiliza sem efeito posterior', () => {
  const base = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-S1', assinaturaOrigem: 'a'.repeat(64), nome: 'Pessoa Sintetica' };
  assert.throws(() => prepararLoteStagingLegado([base]), /Permissao/);
  const result = prepararLoteStagingLegado([base, { ...base }], { autorizado: true, vinculosVerificados: vinculos });
  assert.equal(result.bloqueado, false);
  assert.equal(result.privados.length, 1);
  assert.deepEqual(result.relatorio.porEntidadeEmpresa, { 'pedido|001': 1 });
  assert.equal(result.relatorio.reusos, 1);
  assert.equal(JSON.stringify(result.relatorio).includes('Pessoa Sintetica'), false);
  assert.equal(JSON.stringify(result.relatorio).includes('PED-S1'), false);
});

test('registros privados passam pelo sanitizador canonico sem mutar a origem', () => {
  const item = { entidade: 'cliente', groupId: 'g1', codigoLegado: 'CLI-S1',
    assinaturaOrigem: 'a'.repeat(64), TOKEN: 'SEGREDO', dados: { senha_hash: 'SEGREDO', nome: 'Sintetico' } };
  const result = prepararLoteStagingLegado([item], { autorizado: true });
  assert.equal(result.bloqueado, false);
  assert.equal(JSON.stringify(result.privados).includes('SEGREDO'), false);
  assert.equal(result.privados[0].dados.nome, 'Sintetico');
  assert.equal(item.TOKEN, 'SEGREDO');
});

test('falha no item seguinte bloqueia lote, isola conflito e nao vaza dados no relatorio', () => {
  const base = { entidade: 'conta_receber', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'CR-S1', assinaturaOrigem: 'b'.repeat(64), documento: 'DOCUMENTO_PRIVADO' };
  const result = prepararLoteStagingLegado([
    base,
    { ...base, assinaturaOrigem: 'c'.repeat(64) },
    { ...base, codigoLegado: 'CR-S2', codigoEmpresaLegado: '003' },
  ], { autorizado: true, vinculosVerificados: vinculos });
  assert.equal(result.bloqueado, true);
  assert.deepEqual(result.privados, []);
  assert.equal(result.relatorio.aptos, 1);
  assert.equal(result.relatorio.conflitos, 1);
  assert.equal(result.relatorio.quarentena, 1);
  assert.equal(result.relatorio.porMotivo.codigo_legado_conflitante, 1);
  assert.equal(result.relatorio.porMotivo.empresa_legada_nao_comprovada, 1);
  assert.equal(JSON.stringify(result.relatorio).includes('DOCUMENTO_PRIVADO'), false);
  assert.equal(JSON.stringify(result.relatorio).includes('CR-S1'), false);
});

test('codigo empresarial nao numerico e grupo 003 nao viram empresa por normalizacao', () => {
  for (const value of ['abc', '1x', '0001', '003']) {
    const result = avaliarEscopoStagingLegado({ entidade: 'pedido', codigoEmpresaLegado: value,
      groupId: 'g1', empresaId: 'e1', vinculosVerificados: vinculos });
    assert.equal(result.aptoParaStaging, false);
  }
});

test('retry entre lotes reutiliza staging existente sem nova linha nem misturar empresa', () => {
  const base = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-S1', assinaturaOrigem: 'd'.repeat(64) };
  const opts = { autorizado: true, vinculosVerificados: vinculos };
  const first = prepararLoteStagingLegado([base], opts);
  assert.equal(first.privados.length, 1);
  const retry = prepararLoteStagingLegado([base], { ...opts, existentes: [base] });
  assert.equal(retry.privados.length, 0);
  assert.equal(retry.relatorio.reusos, 1);
  assert.equal(retry.bloqueado, false);
  const altered = prepararLoteStagingLegado([{ ...base, assinaturaOrigem: 'e'.repeat(64) }],
    { ...opts, existentes: [base] });
  assert.equal(altered.bloqueado, true);
  assert.equal(altered.relatorio.conflitos, 1);
  assert.deepEqual(altered.privados, []);
  assert.throws(() => prepararLoteStagingLegado([base], { ...opts, existentes: [{ ...base, assinaturaOrigem: '' }] }),
    /Indice de staging existente/);
});
