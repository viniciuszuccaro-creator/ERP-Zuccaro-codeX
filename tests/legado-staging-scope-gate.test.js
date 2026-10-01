import assert from 'node:assert/strict';
import test from 'node:test';
import { avaliarEscopoStagingLegado, prepararLoteStagingLegado, reconciliarEscoposStaging, reconciliarPlanoStagingLegado } from '../scripts/legado/staging-scope-gate.mjs';

const evidencia = { tipo: 'cnpj', sha256: 'a'.repeat(64),
  aprovadoPor: '11111111-1111-4111-8111-111111111111', aprovadoEm: '2026-09-29T12:00:00Z' };
const vinculos = { '001': { groupId: 'g1', empresaId: 'e1', comprovado: true, evidencia } };
const provaOperacao = (item) => ({
  [JSON.stringify([item.groupId, item.empresaId, item.entidade, item.codigoLegado, item.assinaturaOrigem])]: {
    groupId: item.groupId, empresaId: item.empresaId, entidade: item.entidade,
    codigoLegado: item.codigoLegado, codigoEmpresaLegado: item.codigoEmpresaLegado,
    comprovado: true, evidencia: { ...evidencia, tipo: 'coluna_empresa_origem',
      registroSha256: item.assinaturaOrigem },
  },
});
const provas = (...items) => Object.assign({}, ...items.map(provaOperacao));

test('mestres compartilhados ficam somente no Grupo', () => {
  for (const entidade of ['cliente', 'fornecedor', 'produto_revenda']) {
    assert.equal(avaliarEscopoStagingLegado({ entidade, groupId: 'g1' }).aptoParaStaging, true);
    assert.deepEqual(avaliarEscopoStagingLegado({ entidade, groupId: 'g1', empresaId: 'e1' }).motivos,
      ['mestre_grupo_nao_pode_ser_duplicado_na_empresa']);
  }
});

test('operacao exige vinculo juridico explicito no mesmo Grupo e Empresa', () => {
  const item = { entidade: 'pedido', codigoEmpresaLegado: '1', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-S1', assinaturaOrigem: 'b'.repeat(64) };
  const base = { ...item, vinculosVerificados: vinculos,
    evidenciasOperacaoVerificadas: provas(item) };
  assert.equal(avaliarEscopoStagingLegado(base).aptoParaStaging, true);
  assert.ok(avaliarEscopoStagingLegado({ ...base, evidenciasOperacaoVerificadas: {} })
    .motivos.includes('propriedade_operacao_nao_comprovada'));
  assert.ok(avaliarEscopoStagingLegado({ ...base, empresaId: 'e2' }).motivos.includes('vinculo_juridico_nao_comprovado'));
  assert.ok(avaliarEscopoStagingLegado({ ...base, groupId: 'g2' }).motivos.includes('vinculo_juridico_nao_comprovado'));
  assert.ok(avaliarEscopoStagingLegado({ ...base, vinculosVerificados: {} }).motivos.includes('vinculo_juridico_nao_comprovado'));
});

test('alias aprovado nao libera operacao sem prova vinculada a linha e empresa', () => {
  const item = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-PROVA', assinaturaOrigem: 'f'.repeat(64) };
  const opts = { autorizado: true, vinculosVerificados: vinculos };
  const semProva = prepararLoteStagingLegado([item], opts);
  assert.equal(semProva.bloqueado, true);
  assert.deepEqual(semProva.privados, []);
  assert.equal(semProva.relatorio.porMotivo.propriedade_operacao_nao_comprovada, 1);
  assert.equal(JSON.stringify(semProva.relatorio).includes(item.codigoLegado), false);

  const vinculadas = provas(item);
  const chave = Object.keys(vinculadas)[0];
  for (const alteracao of [
    { empresaId: 'e2' }, { entidade: 'nota_fiscal' }, { codigoLegado: 'OUTRO' },
    { evidencia: { ...vinculadas[chave].evidencia, registroSha256: 'e'.repeat(64) } },
    { evidencia: { ...vinculadas[chave].evidencia, tipo: 'cnpj' } },
  ]) {
    const result = prepararLoteStagingLegado([item], { ...opts,
      evidenciasOperacaoVerificadas: { [chave]: { ...vinculadas[chave], ...alteracao } } });
    assert.equal(result.bloqueado, true);
    assert.deepEqual(result.privados, []);
  }
  const aprovado = prepararLoteStagingLegado([item], { ...opts,
    evidenciasOperacaoVerificadas: vinculadas });
  assert.equal(aprovado.bloqueado, false);
  assert.equal(aprovado.privados.length, 1);
  const trocado = prepararLoteStagingLegado([{ ...item, assinaturaOrigem: 'e'.repeat(64) }],
    { ...opts, evidenciasOperacaoVerificadas: vinculadas });
  assert.equal(trocado.bloqueado, true);
  assert.deepEqual(trocado.privados, []);
});

test('prova dinamica nao executa getter ou Proxy nem libera registros privados', () => {
  const item = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-INERTE', assinaturaOrigem: 'f'.repeat(64) };
  let acessos = 0;
  const chave = Object.keys(provas(item))[0];
  for (const evidenciasOperacaoVerificadas of [
    Object.defineProperty({}, chave, { enumerable: true, get() { acessos += 1; return provas(item)[chave]; } }),
    new Proxy(provas(item), { get(target, property) { acessos += 1; return target[property]; } }),
  ]) {
    const result = prepararLoteStagingLegado([item], { autorizado: true, vinculosVerificados: vinculos,
      evidenciasOperacaoVerificadas });
    assert.equal(result.bloqueado, true);
    assert.deepEqual(result.privados, []);
  }
  assert.equal(acessos, 0);
});

test('alias dinamico ou herdado nao executa armadilhas nem libera privados', () => {
  const item = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-ALIAS', assinaturaOrigem: 'f'.repeat(64) };
  let acessos = 0;
  const comGetter = Object.defineProperty({}, '001', {
    enumerable: true, get() { acessos += 1; return vinculos['001']; },
  });
  const comProxy = new Proxy(vinculos, {
    get(target, property) { acessos += 1; return target[property]; },
  });
  const herdado = Object.create(vinculos);
  for (const vinculosVerificados of [comGetter, comProxy, herdado]) {
    const result = prepararLoteStagingLegado([item], { autorizado: true, vinculosVerificados,
      evidenciasOperacaoVerificadas: provas(item) });
    assert.equal(result.bloqueado, true);
    assert.deepEqual(result.privados, []);
    assert.equal(result.relatorio.porMotivo.vinculo_juridico_nao_comprovado, 1);
  }
  assert.equal(acessos, 0);
});

test('prova circular ou aninhada demais bloqueia lote sem erro de recursao', () => {
  const item = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-CICLO', assinaturaOrigem: 'f'.repeat(64) };
  const circular = provas(item);
  circular.self = circular;
  const profunda = provas(item);
  let atual = profunda;
  for (let index = 0; index < 8; index += 1) {
    atual.extra = {};
    atual = atual.extra;
  }
  for (const evidenciasOperacaoVerificadas of [circular, profunda]) {
    const result = prepararLoteStagingLegado([item], { autorizado: true, vinculosVerificados: vinculos,
      evidenciasOperacaoVerificadas });
    assert.equal(result.bloqueado, true);
    assert.deepEqual(result.privados, []);
    assert.equal(result.relatorio.porMotivo.propriedade_operacao_nao_comprovada, 1);
  }
});

test('booleano comprovado sem evidencia e aprovacao nao libera operacao', () => {
  const item = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1', empresaId: 'e1',
    codigoLegado: 'PED-S2', assinaturaOrigem: 'b'.repeat(64) };
  const incompletos = [
    { groupId: 'g1', empresaId: 'e1', comprovado: true },
    { ...vinculos['001'], evidencia: { ...evidencia, sha256: 'invalido' } },
    { ...vinculos['001'], evidencia: { ...evidencia, aprovadoPor: '' } },
    { ...vinculos['001'], evidencia: { ...evidencia, aprovadoEm: 'invalido' } },
    { ...vinculos['001'], evidencia: { ...evidencia, tipo: 'print' } },
    { ...vinculos['001'], evidencia: { ...evidencia, sha256: [evidencia.sha256] } },
    { ...vinculos['001'], evidencia: { ...evidencia, aprovadoPor: [evidencia.aprovadoPor] } },
    { ...vinculos['001'], evidencia: { ...evidencia, aprovadoEm: [evidencia.aprovadoEm] } },
    { ...vinculos['001'], evidencia: { ...evidencia, aprovadoEm: new Date(evidencia.aprovadoEm) } },
    { ...vinculos['001'], evidencia: { ...evidencia, aprovadoEm: '2026-02-31T12:00:00Z' } },
    { ...vinculos['001'], evidencia: { ...evidencia, aprovadoEm: '2026' } },
    { ...vinculos['001'], evidencia: { ...evidencia, sha256: '0'.repeat(64) } },
  ];
  for (const vinculo of incompletos) {
    const result = prepararLoteStagingLegado([item], {
      autorizado: true, vinculosVerificados: { '001': vinculo },
    });
    assert.equal(result.bloqueado, true);
    assert.deepEqual(result.privados, []);
    assert.equal(result.relatorio.porMotivo.vinculo_juridico_nao_comprovado, 1);
    assert.equal(JSON.stringify(result.relatorio).includes(item.codigoLegado), false);
  }
});

test('grupo seletor 003, codigo zero e desconhecido nao viram empresa juridica', () => {
  for (const legado of ['003', '0', '004', '999']) {
    const result = avaliarEscopoStagingLegado({ entidade: 'nota_fiscal', codigoEmpresaLegado: legado, groupId: 'g1', empresaId: 'e1', vinculosVerificados: vinculos });
    assert.equal(result.aptoParaStaging, false);
    assert.ok(result.motivos.includes('empresa_legada_nao_comprovada'));
  }
});

test('reconciliacao publica somente totais e motivos, sem registros', () => {
  const pedidoComProva = { entidade: 'pedido', codigoEmpresaLegado: '001', groupId: 'g1',
    empresaId: 'e1', codigoLegado: 'PED-S1', assinaturaOrigem: 'b'.repeat(64) };
  const result = reconciliarEscoposStaging([
    { entidade: 'cliente', groupId: 'g1', nome: 'Pessoa Sintetica' },
    { ...pedidoComProva, vinculosVerificados: vinculos,
      evidenciasOperacaoVerificadas: provas(pedidoComProva) },
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
  const result = prepararLoteStagingLegado([base, { ...base }], { autorizado: true,
    vinculosVerificados: vinculos, evidenciasOperacaoVerificadas: provas(base) });
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
  ], { autorizado: true, vinculosVerificados: vinculos,
    evidenciasOperacaoVerificadas: provas(base, { ...base, assinaturaOrigem: 'c'.repeat(64) }) });
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
  const opts = { autorizado: true, vinculosVerificados: vinculos,
    evidenciasOperacaoVerificadas: provas(base, { ...base, assinaturaOrigem: 'e'.repeat(64) }) };
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
planoBase.evidenciasOperacaoVerificadas = provas(pedido);

test('plano reconcilia mestre do Grupo e pedido da Empresa sem copiar operacao ao Grupo', () => {
  const result = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, pedido] });
  assert.equal(result.bloqueado, false);
  assert.equal(result.privados.length, 2);
  assert.deepEqual(result.relatorio.porEntidadeEmpresaOrigem, { 'cliente|grupo': 1, 'pedido|001': 1 });
  assert.equal(result.relatorio.dependenciasPendentes, 0);
  assert.equal(result.relatorio.divergencias, 0);
});

test('plano entrega mestres antes das operacoes mesmo com origem em ordem inversa', () => {
  const result = reconciliarPlanoStagingLegado({ ...planoBase, itens: [pedido, cliente] });
  assert.equal(result.bloqueado, false);
  assert.deepEqual(result.privados.map((item) => item.entidade), ['cliente', 'pedido']);
  const repetido = reconciliarPlanoStagingLegado({ ...planoBase, itens: [pedido, cliente],
    existentes: [cliente] });
  assert.equal(repetido.bloqueado, false);
  assert.deepEqual(repetido.privados.map((item) => item.entidade), ['pedido']);
  assert.equal(repetido.relatorio.reusos, 1);
});

test('plano financeiro exige soma exata em centavos sem divulgar valores', () => {
  const titulo = { entidade: 'conta_receber', groupId: 'g1', empresaId: 'e1',
    codigoEmpresaLegado: '001', codigoLegado: 'TIT-S1', assinaturaOrigem: 'c'.repeat(64),
    valorCentavos: '1250', dependencias: [{ entidade: 'cliente', codigoLegado: 'CLI-S1', escopo: 'grupo' }] };
  const base = { ...planoBase, itens: [titulo, cliente],
    evidenciasOperacaoVerificadas: provas(titulo),
    contagensEsperadas: [
      { entidade: 'cliente', codigoEmpresaLegado: 'grupo', quantidade: 1 },
      { entidade: 'conta_receber', codigoEmpresaLegado: '001', quantidade: 1 },
    ] };
  assert.throws(() => reconciliarPlanoStagingLegado(base), /Saldos financeiros esperados/);
  const esperado = [{ entidade: 'conta_receber', codigoEmpresaLegado: '001', valorCentavos: '1250' }];
  const aprovado = reconciliarPlanoStagingLegado({ ...base, saldosEsperados: esperado });
  assert.equal(aprovado.bloqueado, false);
  assert.deepEqual(aprovado.privados.map((item) => item.entidade), ['cliente', 'conta_receber']);
  assert.equal(aprovado.relatorio.divergenciasSaldos, 0);
  assert.doesNotMatch(JSON.stringify(aprovado.relatorio), /1250|TIT-S1/);
  const divergente = reconciliarPlanoStagingLegado({ ...base, saldosEsperados: [
    { ...esperado[0], valorCentavos: '1249' },
  ] });
  assert.equal(divergente.bloqueado, true);
  assert.deepEqual(divergente.privados, []);
  assert.equal(divergente.relatorio.divergenciasSaldos, 1);
  assert.throws(() => reconciliarPlanoStagingLegado({ ...base,
    itens: [{ ...titulo, valorCentavos: 12.5 }, cliente], saldosEsperados: esperado }),
  /centavos inteiros/);
  assert.throws(() => reconciliarPlanoStagingLegado({ ...base,
    saldosEsperados: [...esperado, esperado[0]] }), /Saldos financeiros esperados invalidos/);
  const empresaErrada = reconciliarPlanoStagingLegado({ ...base, saldosEsperados: [
    { ...esperado[0], codigoEmpresaLegado: '002' },
  ] });
  assert.equal(empresaErrada.bloqueado, true);
  assert.deepEqual(empresaErrada.privados, []);
  assert.equal(empresaErrada.relatorio.divergenciasSaldos, 2);
  let leituras = 0;
  const getter = Object.defineProperty({ entidade: 'conta_receber', codigoEmpresaLegado: '001' },
    'valorCentavos', { enumerable: true, get() { leituras += 1; return '1250'; } });
  for (const saldosEsperados of [
    [getter],
    new Proxy(esperado, { get(target, key) { leituras += 1; return target[key]; } }),
    [{ ...esperado[0], identificadorPrivado: 'nao-publicar' }],
  ]) {
    assert.throws(() => reconciliarPlanoStagingLegado({ ...base, saldosEsperados }),
      /Saldos financeiros esperados invalidos/);
  }
  assert.equal(leituras, 0);
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
    vinculosVerificados: { ...vinculos, '002': { groupId: 'g1', empresaId: 'e2', comprovado: true, evidencia } },
    evidenciasOperacaoVerificadas: provas(empresa2),
    contagensEsperadas: [planoBase.contagensEsperadas[0], { entidade: 'pedido', codigoEmpresaLegado: '002', quantidade: 1 }] });
  assert.equal(result.bloqueado, false);
  assert.deepEqual(result.relatorio.porEntidadeEmpresaOrigem, { 'cliente|grupo': 1, 'pedido|002': 1 });
});

test('dependencia circular entre operacoes nao avanca o lote', () => {
  const pedidoA = { ...pedido, codigoLegado: 'PED-A', dependencias: [
    { entidade: 'pedido', codigoLegado: 'PED-B', escopo: 'empresa' }] };
  const pedidoB = { ...pedido, codigoLegado: 'PED-B', assinaturaOrigem: 'c'.repeat(64), dependencias: [
    { entidade: 'pedido', codigoLegado: 'PED-A', escopo: 'empresa' }] };
  const result = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, pedidoA, pedidoB],
    evidenciasOperacaoVerificadas: provas(pedidoA, pedidoB),
    contagensEsperadas: [planoBase.contagensEsperadas[0],
      { entidade: 'pedido', codigoEmpresaLegado: '001', quantidade: 2 }] });
  assert.equal(result.bloqueado, true);
  assert.deepEqual(result.privados, []);
  assert.equal(result.relatorio.dependenciasCiclicas, 2);
  assert.equal(result.relatorio.porMotivo.dependencia_ciclica, 1);
});

test('ciclo entre novo pedido e retry do indice bloqueia o lote', () => {
  const novo = { ...pedido, codigoLegado: 'PED-A', dependencias: [
    { entidade: 'pedido', codigoLegado: 'PED-B', escopo: 'empresa' }] };
  const retry = { ...pedido, codigoLegado: 'PED-B', assinaturaOrigem: 'c'.repeat(64), dependencias: [
    { entidade: 'pedido', codigoLegado: 'PED-A', escopo: 'empresa' }] };
  const result = reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, novo, retry],
    evidenciasOperacaoVerificadas: provas(novo, retry),
    existentes: [retry], contagensEsperadas: [planoBase.contagensEsperadas[0],
      { entidade: 'pedido', codigoEmpresaLegado: '001', quantidade: 2 }] });
  assert.equal(result.bloqueado, true);
  assert.deepEqual(result.privados, []);
  assert.equal(result.relatorio.dependenciasCiclicas, 2);
});

test('getter no retry nao pode contaminar contagem agregada', () => {
  let lido = false;
  const retry = { ...cliente };
  Object.defineProperty(retry, 'entidade', { enumerable: true, get() { lido = true; return 'DOC-PRIVADO'; } });
  assert.throws(() => reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, retry, pedido],
    contagensEsperadas: [
      { entidade: 'cliente', codigoEmpresaLegado: 'grupo', quantidade: 2 },
      planoBase.contagensEsperadas[1],
    ] }), /JSON simples/);
  assert.equal(lido, false);
});

test('dependencia com empresa contraditoria ou campo privado e recusada antes da entrega', () => {
  const contraditorio = { ...pedido, dependencias: [{ entidade: 'cliente', codigoLegado: 'CLI-S1',
    escopo: 'grupo', empresaId: 'e2', documento: 'DOC-PRIVADO' }] };
  assert.throws(() => reconciliarPlanoStagingLegado({ ...planoBase, itens: [cliente, contraditorio] }),
    /campos nao permitidos/);
});
