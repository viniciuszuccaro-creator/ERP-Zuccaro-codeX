import assert from 'node:assert/strict';
import test from 'node:test';
import { avaliarEscopoStagingLegado, prepararLoteStagingLegado, reconciliarEscoposStaging, reconciliarPlanoStagingLegado } from '../scripts/legado/staging-scope-gate.mjs';

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
    assinaturaOrigem: 'a'.repeat(64), TOKEN: 'SEGREDO', apiKey: 'SEGREDO',
    dados: { senha_hash: 'SEGREDO', 'token ': 'SEGREDO', nome: 'Sintetico' } };
  const result = prepararLoteStagingLegado([item], { autorizado: true });
  assert.equal(result.bloqueado, false);
  assert.equal(JSON.stringify(result.privados).includes('SEGREDO'), false);
  assert.equal(result.privados[0].dados.nome, 'Sintetico');
  assert.equal(item.TOKEN, 'SEGREDO');
});

test('mestre compartilhado conta apenas no Grupo mesmo com seletor legado', () => {
  for (const [entidade, codigoEmpresaLegado] of [['cliente', '003'], ['fornecedor', '001']]) {
    const result = prepararLoteStagingLegado([{ entidade, codigoEmpresaLegado, groupId: 'g1',
      codigoLegado: 'S-1', assinaturaOrigem: 'a'.repeat(64) }], { autorizado: true });
    assert.equal(result.bloqueado, false);
    assert.deepEqual(result.relatorio.porEntidadeEmpresa, { [`${entidade}|grupo`]: 1 });
  }
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

test('funcao no segundo registro falha sem devolver lote parcial', () => {
  const base = { entidade: 'cliente', groupId: 'g1', codigoLegado: 'CLI-S1', assinaturaOrigem: 'a'.repeat(64) };
  assert.throws(() => prepararLoteStagingLegado([base, { ...base, codigoLegado: 'CLI-S2',
    assinaturaOrigem: 'b'.repeat(64), dado: () => 'SEGREDO' }], { autorizado: true }), /JSON simples/);
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
  assert.throws(() => prepararLoteStagingLegado([base], { ...opts, existentes: [{ ...base, groupId: '   ' }] }),
    /Indice de staging existente/);
  assert.throws(() => prepararLoteStagingLegado([base], { ...opts, existentes: [{ ...base, codigoLegado: '   ' }] }),
    /Indice de staging existente/);
  assert.throws(() => prepararLoteStagingLegado([base], { ...opts, existentes: [{ ...base, empresaId: '   ' }] }),
    /Indice de staging existente/);
});

const planoBase = {
  groupId: 'g1', autorizado: true, vinculosVerificados: vinculos,
  contagensEsperadas: [
    { entidade: 'cliente', codigoEmpresaLegado: 'grupo', quantidade: 1 },
    { entidade: 'pedido', codigoEmpresaLegado: '001', quantidade: 1 },
  ],
};
const cliente = { entidade: 'cliente', groupId: 'g1', codigoLegado: 'CLI-S1', assinaturaOrigem: 'a'.repeat(64) };
const pedido = { entidade: 'pedido', groupId: 'g1', empresaId: 'e1', codigoEmpresaLegado: '001',
  codigoLegado: 'PED-S1', assinaturaOrigem: 'b'.repeat(64),
  dependencias: [{ entidade: 'cliente', codigoLegado: 'CLI-S1', escopo: 'grupo' }] };

test('plano reconcilia mestre do Grupo e pedido da Empresa sem copiar operacao ao Grupo', () => {
  const result = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, pedido] });
  assert.equal(result.bloqueado, false);
  assert.equal(result.privados.length, 2);
  assert.deepEqual(result.relatorio.porEntidadeEmpresaOrigem, { 'cliente|grupo': 1, 'pedido|001': 1 });
  assert.equal(result.relatorio.dependenciasPendentes, 0);
  assert.equal(result.relatorio.divergencias, 0);
});

test('plano bloqueia dependencia ausente, cross-empresa e divergencia sem entregar lote parcial', () => {
  const missing = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente,
    { ...pedido, dependencias: [{ entidade: 'cliente', codigoLegado: 'CLI-OUTRO', escopo: 'grupo' }] }] });
  assert.equal(missing.bloqueado, true);
  assert.deepEqual(missing.privados, []);
  assert.equal(missing.relatorio.dependenciasPendentes, 1);
  const cross = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente,
    { ...pedido, dependencias: [{ entidade: 'pedido', codigoLegado: 'PED-E2', escopo: 'empresa' }] }],
  existentes: [{ entidade: 'pedido', groupId: 'g1', empresaId: 'e2', codigoLegado: 'PED-E2', assinaturaOrigem: 'c'.repeat(64) }] });
  assert.equal(cross.bloqueado, true);
  assert.equal(cross.relatorio.dependenciasPendentes, 1);
  const diverge = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, pedido],
    contagensEsperadas: [{ entidade: 'pedido', codigoEmpresaLegado: '001', quantidade: 2 }] });
  assert.equal(diverge.bloqueado, true);
  assert.deepEqual(diverge.privados, []);
  assert.equal(diverge.relatorio.divergencias, 2);
});

test('plano rejeita grupo misturado e contagem duplicada antes de reportar dados', () => {
  assert.throws(() => reconciliarPlanoStagingLegado({ ...planoBase,
    itens: [cliente, { ...pedido, groupId: 'g2' }] }), /mistura Grupos/);
  assert.throws(() => reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, pedido],
    contagensEsperadas: [...planoBase.contagensEsperadas, planoBase.contagensEsperadas[0]] }), /Contagens esperadas/);
  assert.throws(() => reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, pedido],
    contagensEsperadas: [{ entidade: 'cliente', codigoEmpresaLegado: 'grupo', quantidade: '1' }] }), /Contagens esperadas/);
});

test('retry do mestre em staging existente nao cria segundo registro e mantem dependencia', () => {
  const result = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, pedido], existentes: [cliente] });
  assert.equal(result.bloqueado, false);
  assert.equal(result.relatorio.reusos, 1);
  assert.equal(result.relatorio.aptos, 1);
  assert.equal(result.privados.length, 1);
  assert.equal(result.privados[0].entidade, 'pedido');
});

test('empresa 002 usa vinculo proprio e nao compartilha operacao com 001', () => {
  const empresa2 = { ...pedido, empresaId: 'e2', codigoEmpresaLegado: '002',
    dependencias: [{ entidade: 'cliente', codigoLegado: 'CLI-S1', escopo: 'grupo' }] };
  const result = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, empresa2],
    vinculosVerificados: { ...vinculos, '002': { groupId: 'g1', empresaId: 'e2', comprovado: true } },
    contagensEsperadas: [planoBase.contagensEsperadas[0], { entidade: 'pedido', codigoEmpresaLegado: '002', quantidade: 1 }] });
  assert.equal(result.bloqueado, false);
  assert.deepEqual(result.relatorio.porEntidadeEmpresaOrigem, { 'cliente|grupo': 1, 'pedido|002': 1 });
});
