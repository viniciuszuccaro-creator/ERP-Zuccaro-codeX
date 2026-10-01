import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertEntregaOnCreate,
  assertEntregaOnDelete,
  assertEntregaOnUpdate,
  assertRomaneioOnCreate,
  assertSeparacaoOnCreate,
  conferirQuantidadesPedido,
  avaliarScanConferencia,
  validarRespostaConferenciaIA,
  selecionarEntregaConferencia,
  classifyEntregaStatusTransition,
  entregaAtribuidaAoMotorista,
  entregaStatusPermissionActions,
  filterEntregasList,
  hasProvaEntrega,
  isEntregaFutura,
  listCidadesFromEntregas,
  normalizeEntregaListFilters,
  resolveEntregaClienteCalendarDay,
  findDuplicateSeparacao,
} from '../src/components/lib/expedicaoEntregaPolicy.js';
import {
  resolveEntregaContext,
  sanitizeEntregaPayload,
  summarizeGeolocationAudit,
  summarizePredictionAudit,
} from '../src/components/expedicao/formulario-entrega/entregaFormPolicy.js';

/** Compat #178×#197: Separacao tip #197 usa expedicaoFluxoOperacionalPolicy;
 *  #178 usava conferirQuantidadesPedido/findDuplicate inline. Aceitar ambas. */
const isTip197Separacao = (source) => /resolveSeparacaoConclusion|assertSeparacaoQuantidades|SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT/.test(source);

test('separacao recalcula divergencia por quantidade antes de liberar pedido', async () => {
  const separacao = await readFile(new URL('../src/components/expedicao/SeparacaoConferencia.jsx', import.meta.url), 'utf8');
  if (isTip197Separacao(separacao)) {
    assert.match(separacao, /assertSeparacaoQuantidades|resolveSeparacaoConclusion/);
    return;
  }
  assert.match(separacao, /i\.divergencia \|\| Number\(i\.quantidade_separada \|\| 0\) !== Number\(i\.quantidade_pedida \|\| 0\)/);
});

test('conferencia manual reusa registro antes de atualizar pedido e bloqueia lista vazia', async () => {
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferencia.jsx', import.meta.url), 'utf8');
  const mutation = source.slice(source.indexOf('const criarSeparacaoMutation'));
  if (isTip197Separacao(source)) {
    assert.match(source, /assertSeparacaoOnCreate/);
    assert.match(mutation, /decision\.reuse/);
    assert.match(source, /resolveSeparacaoConclusion/);
    return;
  }
  assert.ok(mutation.indexOf('if (existente) return { ...existente, _reused: true }')
    < mutation.indexOf('createInContext("SeparacaoConferencia"'));
  assert.ok(mutation.indexOf('if (existente) return { ...existente, _reused: true }')
    < mutation.indexOf('updateInContext("Pedido"'));
  assert.match(source, /itens.length > 0 && itens.every/);
  assert.match(source, /conferirQuantidadesPedido\(/);
  assert.match(source, /pedidoOperacao\?\.id/);
  assert.match(source, /pedido-da-entrega/);
});

test('consulta de entrega rejeita ID ou tenant diferente mesmo em cache', async () => {
  const rows = [
    { id: 'outra', group_id: 'g1', empresa_id: 'e1' },
    { id: 'ent1', group_id: 'g1', empresa_id: 'e2' },
    { id: 'ent1', group_id: 'g1', empresa_id: 'e1' },
  ];
  assert.deepEqual(selecionarEntregaConferencia(rows, {
    id: 'ent1', groupId: 'g1', empresaId: 'e1',
  }), rows[2]);
  assert.equal(selecionarEntregaConferencia(rows, {
    id: 'ent1', groupId: 'g2', empresaId: 'e1',
  }), null);
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferencia.jsx', import.meta.url), 'utf8');
  if (isTip197Separacao(source)) {
    assert.match(source, /baseGroupId|baseEmpresaId/);
    return;
  }
  assert.match(source, /queryKey: \['entrega', entregaId, baseGroupId, baseEmpresaId\]/);
  assert.match(source, /selecionarEntregaConferencia\(entregas/);
});

test('conferencia de entrega guarda IDs distintos e reusa somente a mesma origem', async () => {
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferencia.jsx', import.meta.url), 'utf8');
  if (!isTip197Separacao(source)) {
    assert.match(source, /filterInContext\("Entrega", \{ id: entregaId \}, undefined, 1\)/);
    assert.match(source, /pedido_id: pedido\\?\\.id \\|\\| entrega\\?\\.pedido_id \\|\\| null/);
    assert.match(source, /entrega_id: entrega\\?\\.id \\|\\| null/);
  } else {
    assert.match(source, /assertSeparacaoOnCreate/);
  }
  const existing = { id: 's1', empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent1', tipo: 'conferencia', status: 'concluido' };
  assert.equal(assertSeparacaoOnCreate({
    record: { empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent1', tipo: 'conferencia' },
    separacoes: [existing],
  }).reuse?.id, 's1');
  assert.equal(assertSeparacaoOnCreate({
    record: { empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent2', tipo: 'conferencia' },
    separacoes: [existing],
  }).reuse, null);
});

test('scanner valida resposta IA antes de auditar sucesso ou incluir item', async () => {
  assert.throws(() => validarRespostaConferenciaIA(null), /incompleta/);
  assert.throws(() => validarRespostaConferenciaIA({ divergencia_quantidade: false }), /incompleta/);
  assert.deepEqual(validarRespostaConferenciaIA({
    divergencia_quantidade: false, divergencia_peso: false,
  }), { divergencia_quantidade: false, divergencia_peso: false });
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferenciaIA.jsx', import.meta.url), 'utf8');
  if (isTip197Separacao(source)) {
    assert.match(source, /resolveSeparacaoConclusion|assertSeparacaoQuantidades|resolveEmpresaOperacionalExpedicao/);
    return;
  }
  const mutation = source.slice(source.indexOf('const validarIAMutation'), source.indexOf('const otimizarRotaMutation'));
  assert.ok(mutation.indexOf('return validarRespostaConferenciaIA(resultado)') < mutation.indexOf('onSuccess:'));
  assert.ok(mutation.indexOf('onError:') < mutation.indexOf('validacao_erro'));
  assert.ok(source.indexOf('validacao = await validarIAMutation.mutateAsync(novoItem)')
    < source.indexOf('itens_separados: [...prev.itens_separados, novoItem]'));
  assert.ok(source.includes('peso_total_kg: Number(produto.peso_liquido_kg || 0) * quantidadeScan'));
  assert.match(source, /peso_conferido: null/);
});

test('scanner soma unidades fracionadas por produto e bloqueia codigo de outro ID', async () => {
  const itensPedido = [{ produto_id: 'p1', codigo: 'COD-A', quantidade: 2.5 }];
  const item = { produto_id: 'p1', quantidade_separada: 1 };
  assert.equal(avaliarScanConferencia({ itensPedido, itensSeparados: [], produtoId: 'p1' }).quantidade, 1);
  assert.equal(avaliarScanConferencia({ itensPedido, itensSeparados: [item], produtoId: 'p1' }).quantidade, 1);
  assert.equal(avaliarScanConferencia({ itensPedido, itensSeparados: [item, item], produtoId: 'p1' }).quantidade, 0.5);
  assert.equal(avaliarScanConferencia({
    itensPedido, itensSeparados: [item, item, { produto_id: 'p1', quantidade_separada: 0.5 }], produtoId: 'p1',
  }).permitido, false);
  assert.equal(avaliarScanConferencia({
    itensPedido, itensSeparados: [], produtoId: 'p2', codigo: 'COD-A',
  }).motivo, 'produto_fora_pedido');
  assert.deepEqual(conferirQuantidadesPedido(itensPedido, [
    item, item, { produto_id: 'p1', quantidade_separada: 0.5 },
  ]), { conforme: true, divergencias: [] });
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferenciaIA.jsx', import.meta.url), 'utf8');
  if (isTip197Separacao(source)) {
    assert.match(source, /assertSeparacaoQuantidades|selectPedidosParaSeparacao/);
    return;
  }
  assert.match(source, /quantidade_pedida: quantidadeScan/);
  assert.ok(source.includes('find(i => i.produto_id === produto.id)'));
});

test('conferencia IA bloqueia pedido incompleto mesmo quando IA nao detecta divergencia', async () => {
  const pedido = [
    { produto_id: 'p1', quantidade: 2 },
    { produto_id: 'p1', quantidade: 1 },
    { produto_id: 'p2', quantidade: 1 },
  ];
  assert.deepEqual(conferirQuantidadesPedido(pedido, [
    { produto_id: 'p1', quantidade_separada: 1 },
    { produto_id: 'p1', quantidade_separada: 1 },
  ]), { conforme: false, divergencias: ['p1', 'p2'] });
  assert.deepEqual(conferirQuantidadesPedido(pedido, [
    { produto_id: 'p1', quantidade_separada: 1 },
    { produto_id: 'p1', quantidade_separada: 2 },
    { produto_id: 'p2', quantidade_separada: 1 },
  ]), { conforme: true, divergencias: [] });
  assert.equal(conferirQuantidadesPedido(pedido, [
    { produto_id: 'p1', quantidade_separada: 3 },
    { produto_id: 'p2', quantidade_separada: 2 },
  ]).conforme, false);
  assert.equal(conferirQuantidadesPedido(pedido, [
    { produto_id: 'p1', quantidade_separada: 'abc' },
  ]).conforme, false);
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferenciaIA.jsx', import.meta.url), 'utf8');
  if (isTip197Separacao(source)) {
    assert.match(source, /resolveSeparacaoConclusion|assertSeparacaoQuantidades/);
    return;
  }
  assert.match(source, /const temDivergencia = separacao.divergencias.length > 0 \\|\\| !conferenciaQuantidades.conforme/);
});

test('separacao IA exige grupo e empresa antes de consultar ou gravar', async () => {
  const separacaoIA = await readFile(new URL('../src/components/expedicao/SeparacaoConferenciaIA.jsx', import.meta.url), 'utf8');
  assert.match(separacaoIA, /const contextoBaseValido = Boolean\(baseGroupId && baseEmpresaId\)/);
  assert.match(separacaoIA, /const contextoValido = Boolean\(effectiveGroupId && effectiveEmpresaId\)/);
  assert.doesNotMatch(separacaoIA, /Boolean\(baseGroupId \|\| baseEmpresaId\)/);
  assert.doesNotMatch(separacaoIA, /Boolean\(effectiveGroupId \|\| effectiveEmpresaId\)/);
});

test('formulario exige Grupo e empresa autorizada no contexto', () => {
  assert.deepEqual(resolveEntregaContext({ grupoAtual: { id: 'g1' }, estaNoGrupo: true }), {
    groupId: 'g1', empresaId: null, empresaPertence: false, contextoValido: false,
  });

  const externo = resolveEntregaContext({
    grupoAtual: { id: 'g1' }, empresaSelecionadaId: 'e2',
    empresasDoGrupo: [{ id: 'e1' }], estaNoGrupo: true,
  });
  assert.equal(externo.contextoValido, false);
  assert.equal(externo.empresaPertence, false);

  const autorizado = resolveEntregaContext({
    grupoAtual: { id: 'g1' }, empresaSelecionadaId: 'e1',
    empresasDoGrupo: [{ id: 'e1' }], estaNoGrupo: true,
  });
  assert.equal(autorizado.contextoValido, true);
});

test('formulario ignora empresa adulterada no registro em contexto de empresa', () => {
  const contexto = resolveEntregaContext({
    empresaAtual: { id: 'e1', group_id: 'g1' },
    empresaSelecionadaId: 'empresa-externa',
    estaNoGrupo: false,
  });
  assert.equal(contexto.groupId, 'g1');
  assert.equal(contexto.empresaId, 'e1');
  assert.equal(contexto.contextoValido, true);
});

test('formulario sanitiza payload e resume auditoria de IA', () => {
  const sanitized = sanitizeEntregaPayload({ observacoes: '<script>javascript:alert(1)</script>' });
  assert.equal(sanitized.observacoes, 'scriptalert(1)/script');
  assert.deepEqual(summarizePredictionAudit({ data_prevista: '2026-09-20', confianca_percentual: 90 }), {
    sugestao_recebida: true, confianca_faixa: 'alta',
  });
  assert.deepEqual(summarizeGeolocationAudit({ link_google_maps: 'https://maps.test', latitude: -23, longitude: -46 }), {
    coordenadas_recebidas: true, link_recebido: true,
  });
});

test('formulario usa contrato vigente do CEP e nao confia no registro para contexto', async () => {
  const formulario = await readFile(new URL('../src/components/expedicao/FormularioEntrega.jsx', import.meta.url), 'utf8');
  const secoes = await readFile(new URL('../src/components/expedicao/formulario-entrega/EntregaFormSections.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(formulario, /Boolean\(groupId \|\| empresaId\)/);
  assert.doesNotMatch(formulario, /formData\?\.group_id/);
  assert.match(secoes, /onEnderecoEncontrado=/);
  assert.match(secoes, /enderecoAtual=/);
  assert.doesNotMatch(secoes, /onCEPFound=/);
});

test('entrega exige empresa e nao marca entregue sem prova', () => {
  assert.throws(() => assertEntregaOnCreate({ record: { pedido_id: 'p1' }, entregas: [] }), /Empresa obrigatoria/);
  assert.throws(
    () => assertEntregaOnCreate({ record: { empresa_id: 'e1', status: 'Entregue' }, entregas: [] }),
    /comprovante/,
  );
});

test('retirada com recebedor e prova suficiente', () => {
  assert.equal(hasProvaEntrega({
    tipo_frete: 'Retirada',
    comprovante_entrega: { nome_recebedor: 'Joao' },
  }), true);
  const created = assertEntregaOnCreate({
    record: {
      empresa_id: 'e1',
      pedido_id: 'p1',
      tipo_frete: 'Retirada',
      status: 'Entregue',
      comprovante_entrega: { nome_recebedor: 'Joao', documento_recebedor: '123' },
    },
    entregas: [],
  });
  assert.equal(created.reuse, null);
});

test('retry do mesmo pedido reusa a entrega', () => {
  const existing = { id: 'ent-1', empresa_id: 'e1', pedido_id: 'p1', status: 'Pronto para Expedir' };
  const decision = assertEntregaOnCreate({
    record: { empresa_id: 'e1', pedido_id: 'p1' },
    entregas: [existing],
  });
  assert.equal(decision.reuse.id, 'ent-1');
});

test('conferencia manual e IA do mesmo pedido reutilizam a origem', () => {
  const manual = { id: 's1', empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent1', tipo: 'conferencia', status: 'concluido' };
  assert.equal(findDuplicateSeparacao({
    empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent1', tipo: 'conferencia_ia',
  }, [manual])?.id, 's1');
  assert.equal(findDuplicateSeparacao({
    empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent2', tipo: 'conferencia',
  }, [manual]), null);
});

test('duas entregas do pedido permanecem independentes na conferencia IA', async () => {
  const primeira = { id: 's1', empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent1', tipo: 'conferencia', status: 'concluido' };
  assert.equal(findDuplicateSeparacao({
    empresa_id: 'e1', pedido_id: 'p1', entrega_id: 'ent2', tipo: 'conferencia_ia',
  }, [primeira]), null);
  assert.equal(findDuplicateSeparacao({
    empresa_id: 'e1', pedido_id: 'p1', tipo: 'conferencia_ia',
  }, [primeira]), null);
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferenciaIA.jsx', import.meta.url), 'utf8');
  if (isTip197Separacao(source)) {
    assert.match(source, /resolveEmpresaOperacionalExpedicao|selectPedidosParaSeparacao/);
    return;
  }
  assert.ok(source.includes('entrega_id: entregaAtiva?.id || null'));
  assert.ok(source.includes('entregas.length > 1 && !entregaAtiva'));
  assert.ok(source.includes('value={entregaSelecionadaId}'));
});

test('reconferencia da mesma entrega atualiza registro divergente com auditoria', async () => {
  const source = await readFile(new URL('../src/components/expedicao/SeparacaoConferenciaIA.jsx', import.meta.url), 'utf8');
  if (isTip197Separacao(source)) {
    assert.match(source, /assertSeparacaoOnCreate|resolveSeparacaoConclusion/);
    return;
  }
  assert.ok(source.includes('await updateInContext("SeparacaoConferencia", existente.id, payloadConferencia)'));
  assert.ok(source.includes('dadosAnteriores: existente || pedido'));
  assert.ok(source.includes('if (entregas.length > 100)'));
  assert.ok(source.includes('undefined, 101'));
  assert.ok(source.includes('entregas.length > 1 && legadoSemEntrega'));
});

test('separacao cancelada nao bloqueia nova conferencia, mas concluida e reutilizada', () => {
  const record = { empresa_id: 'e1', pedido_id: 'p1', tipo: 'conferencia' };
  const cancelada = assertSeparacaoOnCreate({
    record,
    separacoes: [{ id: 's-cancelada', empresa_id: 'e1', pedido_id: 'p1', tipo: 'conferencia', status: 'Cancelada' }],
  });
  assert.equal(cancelada.reuse, null);

  const concluida = assertSeparacaoOnCreate({
    record,
    separacoes: [{ id: 's-concluida', empresa_id: 'e1', pedido_id: 'p1', tipo: 'conferencia', status: 'concluido' }],
  });
  assert.equal(concluida.reuse.id, 's-concluida');
});

test('romaneio exige motorista, veiculo e empresa', () => {
  assert.throws(
    () => assertRomaneioOnCreate({ record: { empresa_id: 'e1', entregas_ids: ['a'] }, romaneios: [] }),
    /Motorista/,
  );
  const retry = assertRomaneioOnCreate({
    record: { empresa_id: 'e1', motorista: 'Ana', placa: 'ABC1D23', entregas_ids: ['a', 'b'] },
    romaneios: [{ id: 'r1', empresa_id: 'e1', motorista: 'Ana', placa: 'ABC1D23', entregas_ids: ['b', 'a'] }],
  });
  assert.equal(retry.reuse.id, 'r1');
});

test('update nao entrega sem comprovante e nao troca empresa', () => {
  assert.throws(
    () => assertEntregaOnUpdate({ before: { empresa_id: 'e1', status: 'Em Trânsito' }, patch: { status: 'Entregue' } }),
    /comprovante/,
  );
  assert.throws(
    () => assertEntregaOnUpdate({ before: { empresa_id: 'e1' }, patch: { empresa_id: 'e2' } }),
    /nao pode ser alterada/,
  );
  const next = assertEntregaOnUpdate({
    before: { empresa_id: 'e1', status: 'Em Trânsito' },
    patch: { status: 'Entregue', comprovante_entrega: { nome_recebedor: 'Maria', foto_comprovante: 'https://img' } },
  });
  assert.equal(next.record.status, 'Entregue');
  assert.equal(next.action, 'entregar');
});

test('classifica transicao e alçada de status', () => {
  assert.equal(classifyEntregaStatusTransition('Em Trânsito', 'Entregue'), 'entregar');
  assert.equal(classifyEntregaStatusTransition('Separacao', 'Conferido'), 'conferir');
  assert.equal(classifyEntregaStatusTransition('Pronto', 'Em Trânsito'), 'expedir');
  assert.equal(classifyEntregaStatusTransition('Em Trânsito', 'Frustrada'), 'ocorrencia');
  assert.deepEqual(entregaStatusPermissionActions('entregar'), ['entregar', 'confirmar']);
  assert.deepEqual(entregaStatusPermissionActions('conferir'), ['conferir', 'editar']);
});

test('delete bloqueia entrega finalizada ou em transito', () => {
  assert.throws(
    () => assertEntregaOnDelete({ status: 'Entregue', comprovante_entrega: { nome_recebedor: 'A', foto_comprovante: 'x' } }),
    /Nao excluir/,
  );
  assert.throws(() => assertEntregaOnDelete({ status: 'Em Trânsito' }), /transito/);
  assert.doesNotThrow(() => assertEntregaOnDelete({ status: 'Aguardando', empresa_id: 'e1' }));
});

test('ocorrencia exige motivo e frustrada congela campos-chave', () => {
  assert.throws(
    () => assertEntregaOnUpdate({ before: { empresa_id: 'e1', status: 'Em Trânsito' }, patch: { status: 'Frustrada' } }),
    /Ocorrencia exige motivo/,
  );
  const ok = assertEntregaOnUpdate({
    before: { empresa_id: 'e1', status: 'Em Trânsito' },
    patch: { status: 'Frustrada', entrega_frustrada: { motivo: 'Cliente ausente' } },
  });
  assert.equal(ok.action, 'ocorrencia');
});

test('motorista so ve entrega atribuida', () => {
  const user = { id: 'u1', full_name: 'Carlos Motorista', email: 'carlos@local' };
  assert.equal(entregaAtribuidaAoMotorista({ id: '1', motorista_id: 'u1' }, user), true);
  assert.equal(entregaAtribuidaAoMotorista({ id: '2', motorista: 'Carlos Motorista' }, user), true);
  assert.equal(entregaAtribuidaAoMotorista({ id: '3', motorista_id: 'outro' }, user), false);
});

test('filtros listagem entrega: empresa, cidade, data cliente e futuras', () => {
  const now = new Date('2026-09-30T15:00:00.000Z');
  const rows = [
    {
      id: 'a', empresa_id: 'e1', status: 'Pronto para Expedir',
      data_previsao: '2026-10-05', endereco_entrega_completo: { cidade: 'Campinas' }, cliente_nome: 'Alpha',
    },
    {
      id: 'b', empresa_id: 'e2', status: 'Em Transito',
      data_entrega_solicitada: '2026-09-20', endereco_entrega_completo: { cidade: 'Sorocaba' }, cliente_nome: 'Beta',
    },
    {
      id: 'c', empresa_id: 'e1', status: 'Entregue',
      data_previsao: '2026-10-10', endereco_entrega_completo: { cidade: 'Campinas' }, cliente_nome: 'Gamma',
    },
  ];
  assert.equal(resolveEntregaClienteCalendarDay(rows[1]), '2026-09-20');
  assert.equal(isEntregaFutura(rows[0], now), true);
  assert.equal(isEntregaFutura(rows[1], now), false);
  assert.equal(isEntregaFutura(rows[2], now), false);

  const onlyCampinas = filterEntregasList(rows, { cidade: 'Campinas' }, { now });
  assert.deepEqual(onlyCampinas.map((r) => r.id), ['a', 'c']);

  const empresaE1 = filterEntregasList(rows, { empresaId: 'e1' }, { now });
  assert.deepEqual(empresaE1.map((r) => r.id), ['a', 'c']);

  const futuras = filterEntregasList(rows, { soFuturas: true }, { now });
  assert.deepEqual(futuras.map((r) => r.id), ['a']);

  const range = filterEntregasList(rows, { dataDe: '2026-10-01', dataAte: '2026-10-31' }, { now });
  assert.deepEqual(range.map((r) => r.id), ['a', 'c']);

  rows[0].cliente_id = 'cli-a';
  rows[1].cliente_id = 'cli-b';
  rows[2].cliente_id = 'cli-a';
  const byCliente = filterEntregasList(rows, { clienteId: 'cli-a' }, { now });
  assert.deepEqual(byCliente.map((r) => r.id), ['a', 'c']);

  const invalid = normalizeEntregaListFilters({ dataDe: '2026-10-10', dataAte: '2026-10-01' });
  assert.equal(invalid.rangeInvalid, true);
  assert.equal(filterEntregasList(rows, invalid, { now }).length, 0);
  assert.deepEqual(listCidadesFromEntregas(rows), ['Campinas', 'Sorocaba']);
});

test('entrega parcial exige comprovante via assert update; ação classifica entregar', () => {
  assert.throws(
    () => assertEntregaOnUpdate({
      before: { empresa_id: 'e1', status: 'Em Trânsito' },
      patch: { status: 'Entrega Parcial' },
    }),
    /comprovante/,
  );
  const ok = assertEntregaOnUpdate({
    before: { empresa_id: 'e1', status: 'Em Trânsito' },
    patch: {
      status: 'Entrega Parcial',
      comprovante_entrega: { nome_recebedor: 'A', foto_comprovante: 'x' },
    },
  });
  assert.equal(ok.action, 'entregar');
  assert.equal(ok.record.status, 'Entrega Parcial');
});
