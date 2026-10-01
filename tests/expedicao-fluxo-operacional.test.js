import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertEntregaOnUpdate,
  assertRomaneioOnCreate,
  assertSeparacaoOnCreate,
  filterEntregasList,
} from '../src/components/lib/expedicaoEntregaPolicy.js';
import {
  SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT,
  INTEGRACAO_ROMANEIO_PEDIDO_LEGADO_SIDE_EFFECT,
  assertConfirmacaoDupla,
  assertSeparacaoChecklist,
  assertSeparacaoQuantidades,
  buildEntregaSeedFromPedido,
  filterEntregasPendencias,
  planEntregasFromPedidosParaRomaneio,
  resolvePedidoLegadoAposRomaneio,
  resolveRegistroEntregaFinal,
  resolveRomaneioDespacho,
  resolveSeparacaoConclusion,
  revalidarSelecaoAposTrocaEmpresa,
  selectEntregasParaRomaneio,
  selectPedidosParaRomaneio,
  selectPedidosParaSeparacao,
  applyDespachoPatchesWithRollback,
  resolveQuantidadesPendentesEntrega,
  resolveEmpresaOperacionalExpedicao,
  isPedidoStatusElegivelRomaneio,
  PERSISTENCIA_EXPEDICAO,
} from '../src/components/lib/expedicaoFluxoOperacionalPolicy.js';

const checklistOk = {
  conferiu_quantidade: true,
  conferiu_qualidade: true,
  conferiu_embalagem: true,
  conferiu_etiquetas: true,
  conferiu_documentos: true,
};

/** Store em memória para simular persistência/concorrência/auditoria do fluxo. */
function createFluxoStore() {
  const state = {
    entregas: new Map(),
    separacoes: new Map(),
    romaneios: new Map(),
    audit: [],
    failPersist: false,
    failAudit: false,
  };

  const audit = (entry) => {
    if (state.failAudit) throw new Error('Falha ao auditar fluxo operacional.');
    state.audit.push({ ...entry, at: Date.now() });
  };

  return {
    state,
    seedEntrega(row) {
      state.entregas.set(row.id, { ...row, historico_status: row.historico_status || [] });
      return state.entregas.get(row.id);
    },
    listEntregas() {
      return [...state.entregas.values()];
    },
    async concluirSeparacao({ entregaId, pedidoId, itens, groupId, empresaId, confirmed }) {
      const conclusion = resolveSeparacaoConclusion({
        itens,
        checklist: checklistOk,
        groupId,
        empresaId,
        entregaId,
        pedidoId,
        confirmed,
      });
      const decision = assertSeparacaoOnCreate({
        record: conclusion.separacaoRecord,
        separacoes: [...state.separacoes.values()],
      });
      if (decision.reuse) {
        audit({ acao: 'SeparacaoConferencia.retry', reuse_id: decision.reuse.id, sucesso: true });
        return { separacao: decision.reuse, conclusion, retry: true };
      }
      if (state.failPersist) throw new Error('Falha de persistencia na separacao.');
      const id = `sep-${state.separacoes.size + 1}`;
      const separacao = { id, ...conclusion.separacaoRecord };
      state.separacoes.set(id, separacao);
      if (conclusion.nextEntregaStatus && entregaId && state.entregas.has(entregaId)) {
        const before = state.entregas.get(entregaId);
        const patch = { status: conclusion.nextEntregaStatus, empresa_id: empresaId, group_id: groupId };
        assertEntregaOnUpdate({ before, patch });
        state.entregas.set(entregaId, { ...before, ...patch });
      }
      audit({
        acao: 'SeparacaoConferencia.concluir',
        registro_id: id,
        sucesso: true,
        pedido_legado: conclusion.shouldUpdatePedidoLegado
          ? SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT
          : null,
      });
      return { separacao, conclusion, retry: false };
    },
    async gerarRomaneioEDespachar({ selectedIds, groupId, empresaId, confirmed }) {
      const entregasSelecionadas = selectEntregasParaRomaneio(this.listEntregas(), {
        empresaId,
        groupId,
        selectedIds,
        exigirSelecao: true,
      });
      const fluxo = resolveRomaneioDespacho({
        entregasSelecionadas,
        empresaId,
        groupId,
        motorista: 'Ana',
        placa: 'ABC1D23',
        veiculo: 'Caminhao',
        checklist_saida: {
          documentos_ok: true,
          veiculo_ok: true,
          carga_conferida: true,
          combustivel_ok: true,
        },
        confirmed,
        romaneiosExistentes: [...state.romaneios.values()],
      });
      if (fluxo.reuse) {
        audit({ acao: 'Romaneio.gerar.retry', reuse_id: fluxo.reuse.id, sucesso: true });
        return { romaneio: fluxo.reuse, fluxo, retry: true };
      }
      if (state.failPersist) throw new Error('Falha de persistencia no romaneio.');
      const id = `rom-${state.romaneios.size + 1}`;
      const romaneio = { id, ...fluxo.romaneioRecord };
      state.romaneios.set(id, romaneio);
      for (const item of fluxo.despachoPatches) {
        const before = state.entregas.get(item.entregaId);
        assertEntregaOnUpdate({ before, patch: item.patch });
        state.entregas.set(item.entregaId, {
          ...before,
          ...item.patch,
          romaneio_id: id,
        });
      }
      audit({ acao: 'Romaneio.gerar', registro_id: id, sucesso: true });
      return { romaneio, fluxo, retry: false };
    },
    async registrarFinal({ entregaId, modo, comprovante, quantidade_entregue, motivo, groupId, empresaId, confirmed }) {
      const before = state.entregas.get(entregaId);
      const resolved = resolveRegistroEntregaFinal({
        before,
        modo,
        comprovante,
        quantidade_entregue,
        motivo,
        groupId,
        empresaId,
        confirmed,
      });
      if (state.failPersist) throw new Error('Falha de persistencia no registro final.');
      state.entregas.set(entregaId, { ...before, ...resolved.patch });
      audit({ acao: `Entrega.registro_${modo}`, registro_id: entregaId, sucesso: true });
      return resolved;
    },
    audit,
  };
}

test('fluxo ponta a ponta: selecionar → separar → romaneio → despachar → parcial → pendência', async () => {
  const store = createFluxoStore();
  store.seedEntrega({
    id: 'e1',
    group_id: 'g1',
    empresa_id: 'emp-a',
    status: 'Em Separacao',
    pedido_id: 'ped-1',
    cliente_nome: 'Cliente A',
    data_previsao: '2026-09-28',
  });

  const itensOk = [
    { id: 'i1', quantidade_pedida: 10, quantidade_separada: 10 },
    { id: 'i2', quantidade_pedida: 2, quantidade_separada: 2 },
  ];

  const sep = await store.concluirSeparacao({
    entregaId: 'e1',
    pedidoId: 'ped-1',
    itens: itensOk,
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(sep.conclusion.nextEntregaStatus, 'Pronto para Expedir');
  assert.equal(sep.conclusion.shouldUpdatePedidoLegado, true);
  assert.equal(sep.conclusion.pedidoLegadoPatch.status, 'Pronto para Faturar');
  assert.equal(sep.conclusion.pedidoLegadoPatch._legado_side_effect.entity, 'Pedido');
  assert.equal(store.state.entregas.get('e1').status, 'Pronto para Expedir');

  const rom = await store.gerarRomaneioEDespachar({
    selectedIds: ['e1'],
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(rom.romaneio.status, 'Aprovado');
  assert.equal(store.state.entregas.get('e1').status, 'Saiu para Entrega');
  assert.equal(store.state.entregas.get('e1').romaneio_id, rom.romaneio.id);

  await store.registrarFinal({
    entregaId: 'e1',
    modo: 'parcial',
    quantidade_entregue: 4,
    comprovante: { nome_recebedor: 'Maria', foto_comprovante: 'img' },
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(store.state.entregas.get('e1').status, 'Entrega Parcial');

  const pendencias = filterEntregasPendencias(store.listEntregas(), { empresaId: 'emp-a', groupId: 'g1' });
  assert.equal(pendencias.length, 1);
  assert.equal(pendencias[0].pendencia.tipo, 'parcial');
  assert.ok(store.state.audit.some((a) => a.acao === 'SeparacaoConferencia.concluir'));
  assert.ok(store.state.audit.some((a) => a.acao === 'Romaneio.gerar'));
  assert.ok(store.state.audit.some((a) => a.acao === 'Entrega.registro_parcial'));
});

test('troca de empresa remove seleção cruzada e bloqueia romaneio alheio', () => {
  const rows = [
    { id: 'a', empresa_id: 'emp-a', group_id: 'g1', status: 'Pronto para Expedir' },
    { id: 'b', empresa_id: 'emp-b', group_id: 'g1', status: 'Pronto para Expedir' },
  ];
  const swap = revalidarSelecaoAposTrocaEmpresa({
    selectedIds: ['a', 'b'],
    entregas: rows,
    empresaIdAnterior: 'emp-a',
    empresaIdNovo: 'emp-b',
    groupId: 'g1',
  });
  assert.deepEqual(swap.selectedIds, ['b']);
  assert.deepEqual(swap.removidos, ['a']);

  assert.throws(
    () => selectEntregasParaRomaneio(rows, {
      empresaId: 'emp-a',
      groupId: 'g1',
      selectedIds: ['b'],
      exigirSelecao: true,
    }),
    /nao pertence ao contexto/,
  );

  const onlyA = filterEntregasList(rows, { empresaId: 'emp-a' });
  assert.deepEqual(onlyA.map((r) => r.id), ['a']);
});

test('RBAC comportamental: sem confirmação / sem checklist / sem quantidade bloqueia fluxo', () => {
  assert.throws(() => assertConfirmacaoDupla({ confirmed: false, acao: 'romaneio' }), /Confirmacao cancelada/);
  assert.throws(() => assertSeparacaoChecklist({ conferiu_quantidade: true }), /Checklist/);
  assert.throws(
    () => assertSeparacaoQuantidades({
      itens: [{ quantidade_pedida: 5, quantidade_separada: 0 }],
    }),
    /quantidade separada/,
  );
  assert.throws(
    () => resolveSeparacaoConclusion({
      itens: [{ quantidade_pedida: 1, quantidade_separada: 1 }],
      checklist: checklistOk,
      groupId: 'g1',
      empresaId: null,
      confirmed: true,
    }),
    /multiempresa/,
  );
});

test('concorrência/retry: segunda separação e romaneio reusam registro existente', async () => {
  const store = createFluxoStore();
  store.seedEntrega({
    id: 'e2',
    group_id: 'g1',
    empresa_id: 'emp-a',
    status: 'Em Separacao',
    pedido_id: 'ped-2',
  });
  const itens = [{ id: 'i1', quantidade_pedida: 3, quantidade_separada: 3 }];
  const first = await store.concluirSeparacao({
    entregaId: 'e2',
    pedidoId: 'ped-2',
    itens,
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  const second = await store.concluirSeparacao({
    entregaId: 'e2',
    pedidoId: 'ped-2',
    itens,
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(second.retry, true);
  assert.equal(second.separacao.id, first.separacao.id);
  assert.equal(store.state.separacoes.size, 1);

  const rom1 = await store.gerarRomaneioEDespachar({
    selectedIds: ['e2'],
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  // após despacho a entrega sai de Pronto — nova seleção falha; retry de romaneio
  // via assertRomaneioOnCreate com mesmo conjunto
  const duplicate = assertRomaneioOnCreate({
    record: {
      empresa_id: 'emp-a',
      motorista: 'Ana',
      placa: 'ABC1D23',
      entregas_ids: ['e2'],
    },
    romaneios: [rom1.romaneio],
  });
  assert.equal(duplicate.reuse.id, rom1.romaneio.id);
});

test('ocorrência e entrega total exigem motivo/prova; falha de persistência e auditoria sobe erro', async () => {
  const store = createFluxoStore();
  store.seedEntrega({
    id: 'e3',
    group_id: 'g1',
    empresa_id: 'emp-a',
    status: 'Em Transito',
  });

  assert.throws(
    () => resolveRegistroEntregaFinal({
      before: store.state.entregas.get('e3'),
      modo: 'ocorrencia',
      groupId: 'g1',
      empresaId: 'emp-a',
      confirmed: true,
      motivo: '',
    }),
    /motivo/,
  );

  assert.throws(
    () => resolveRegistroEntregaFinal({
      before: store.state.entregas.get('e3'),
      modo: 'total',
      groupId: 'g1',
      empresaId: 'emp-a',
      confirmed: true,
      comprovante: { nome_recebedor: 'X' },
    }),
    /comprovante/,
  );

  await store.registrarFinal({
    entregaId: 'e3',
    modo: 'ocorrencia',
    motivo: 'Cliente ausente',
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(store.state.entregas.get('e3').status, 'Entrega Frustrada');

  store.state.failPersist = true;
  await assert.rejects(
    () => store.registrarFinal({
      entregaId: 'e3',
      modo: 'ocorrencia',
      motivo: 'retry',
      groupId: 'g1',
      empresaId: 'emp-a',
      confirmed: true,
    }),
    /persistencia/,
  );

  store.state.failPersist = false;
  store.state.failAudit = true;
  assert.throws(() => store.audit({ acao: 'x' }), /auditar/);
});

test('divergência na separação não libera romaneio nem side-effect de Pedido', async () => {
  const store = createFluxoStore();
  store.seedEntrega({
    id: 'e4',
    group_id: 'g1',
    empresa_id: 'emp-a',
    status: 'Em Separacao',
    pedido_id: 'ped-4',
  });
  const sep = await store.concluirSeparacao({
    entregaId: 'e4',
    pedidoId: 'ped-4',
    itens: [{ id: 'i1', quantidade_pedida: 5, quantidade_separada: 3 }],
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(sep.conclusion.statusSeparacao, 'com_divergencia');
  assert.equal(sep.conclusion.nextEntregaStatus, null);
  assert.equal(sep.conclusion.shouldUpdatePedidoLegado, false);
  assert.equal(store.state.entregas.get('e4').status, 'Em Separacao');
  assert.throws(
    () => selectEntregasParaRomaneio(store.listEntregas(), {
      empresaId: 'emp-a',
      groupId: 'g1',
      selectedIds: ['e4'],
      exigirSelecao: true,
    }),
    /elegivel/,
  );

  const pendencias = filterEntregasPendencias(store.listEntregas(), { empresaId: 'emp-a' });
  assert.ok(pendencias.some((p) => p.pendencia.tipo === 'separacao'));
});

test('dependência legada Pedido permanece descritiva e reservada ao Codex', () => {
  assert.equal(SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT.entity, 'Pedido');
  assert.equal(SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT.via, 'updateInContext');
  assert.equal(SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT.statusAlvo, 'Pronto para Faturar');
  assert.equal(SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT.reservado, true);
  assert.equal(SEPARACAO_PEDIDO_LEGADO_SIDE_EFFECT.coordenacao, 'codex-pedido-contrato');
});

test('seleção de Pedidos para separação: empresa, status e futuras', () => {
  const now = new Date('2026-09-30T15:00:00.000Z');
  const pedidos = [
    { id: 'p1', empresa_id: 'emp-a', group_id: 'g1', status: 'Aprovado', data_entrega_solicitada: '2026-10-05' },
    { id: 'p2', empresa_id: 'emp-b', group_id: 'g1', status: 'Aprovado', data_entrega_solicitada: '2026-10-05' },
    { id: 'p3', empresa_id: 'emp-a', group_id: 'g1', status: 'Cancelado', data_entrega_solicitada: '2026-10-05' },
    { id: 'p4', empresa_id: 'emp-a', group_id: 'g1', status: 'Em Separacao', data_previsao: '2026-09-20' },
  ];
  const elegiveis = selectPedidosParaSeparacao(pedidos, { empresaId: 'emp-a', groupId: 'g1', now });
  assert.deepEqual(elegiveis.map((p) => p.id).sort(), ['p1', 'p4']);

  const futuras = selectPedidosParaSeparacao(pedidos, {
    empresaId: 'emp-a', groupId: 'g1', soFuturas: true, now,
  });
  assert.deepEqual(futuras.map((p) => p.id), ['p1']);

  assert.throws(
    () => selectPedidosParaSeparacao(pedidos, {
      empresaId: 'emp-a', groupId: 'g1', selectedIds: ['p2'], exigirSelecao: true,
    }),
    /nao pertence ao contexto/,
  );
});

test('unidades: separação rejeita unidade divergente e aceita unidade coerente', () => {
  assert.throws(
    () => assertSeparacaoQuantidades({
      itens: [{
        quantidade_pedida: 10,
        quantidade_separada: 10,
        unidade: 'UN',
        unidade_separada: 'KG',
      }],
    }),
    /Unidade/,
  );
  const ok = assertSeparacaoQuantidades({
    itens: [{
      quantidade_pedida: 10,
      quantidade_separada: 10,
      unidade: 'UN',
      unidade_separada: 'un',
    }],
  });
  assert.equal(ok.todosConferidos, true);
  assert.equal(ok.itens[0].unidade, 'UN');
});

test('despacho com falha parcial faz rollback das entregas já aplicadas', () => {
  const map = new Map([
    ['e1', { id: 'e1', empresa_id: 'emp-a', status: 'Pronto para Expedir', historico_status: [] }],
    ['e2', { id: 'e2', empresa_id: 'emp-a', status: 'Pronto para Expedir', historico_status: [] }],
  ]);
  const fluxo = resolveRomaneioDespacho({
    entregasSelecionadas: [...map.values()],
    empresaId: 'emp-a',
    groupId: 'g1',
    motorista: 'Ana',
    placa: 'ABC1D23',
    veiculo: 'Truck',
    checklist_saida: {
      documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true,
    },
    confirmed: true,
  });
  const result = applyDespachoPatchesWithRollback({
    despachoPatches: fluxo.despachoPatches,
    entregasById: map,
    failAtIndex: 1,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.rolledBackIds, ['e1']);
  assert.equal(map.get('e1').status, 'Pronto para Expedir');
  assert.equal(map.get('e2').status, 'Pronto para Expedir');
  assert.match(String(result.error?.message || ''), /persistencia/);
});

test('fluxo integrado: pedido elegível → separação → romaneio → despacho → ocorrência → pendência', async () => {
  const store = createFluxoStore();
  const pedidos = [
    {
      id: 'ped-int',
      empresa_id: 'emp-a',
      group_id: 'g1',
      status: 'Aprovado',
      data_entrega_solicitada: '2026-10-02',
      itens_revenda: [{ id: 'i1', quantidade: 4, unidade: 'PC' }],
    },
  ];
  const escolhidos = selectPedidosParaSeparacao(pedidos, {
    empresaId: 'emp-a', groupId: 'g1', selectedIds: ['ped-int'], exigirSelecao: true,
  });
  assert.equal(escolhidos.length, 1);

  store.seedEntrega({
    id: 'e-int',
    group_id: 'g1',
    empresa_id: 'emp-a',
    status: 'Em Separacao',
    pedido_id: 'ped-int',
    data_previsao: '2026-10-02',
  });

  const sep = await store.concluirSeparacao({
    entregaId: 'e-int',
    pedidoId: 'ped-int',
    itens: [{
      id: 'i1',
      quantidade_pedida: 4,
      quantidade_separada: 4,
      unidade: 'PC',
      unidade_separada: 'PC',
    }],
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(sep.conclusion.nextEntregaStatus, 'Pronto para Expedir');

  const rom = await store.gerarRomaneioEDespachar({
    selectedIds: ['e-int'],
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.ok(rom.romaneio.id);
  assert.equal(store.state.entregas.get('e-int').status, 'Saiu para Entrega');

  await store.registrarFinal({
    entregaId: 'e-int',
    modo: 'ocorrencia',
    motivo: 'Endereco inacessivel',
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  const pendencias = filterEntregasPendencias(store.listEntregas(), { empresaId: 'emp-a', groupId: 'g1' });
  assert.ok(pendencias.some((p) => p.pendencia.tipo === 'ocorrencia'));
});

test('selectPedidosParaRomaneio: isolamento grupo∧empresa e exclusão de retirada', () => {
  const pedidos = [
    { id: 'p1', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado', tipo_frete: 'CIF' },
    { id: 'p2', empresa_id: 'emp-b', group_id: 'g1', status: 'Faturado', tipo_frete: 'CIF' },
    { id: 'p3', empresa_id: 'emp-a', group_id: 'g2', status: 'Em Expedição', tipo_frete: 'FOB' },
    { id: 'p4', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado', tipo_frete: 'Retirada' },
    { id: 'p5', empresa_id: 'emp-a', group_id: 'g1', status: 'Cancelado', tipo_frete: 'CIF' },
  ];
  const elegiveis = selectPedidosParaRomaneio(pedidos, { empresaId: 'emp-a', groupId: 'g1' });
  assert.deepEqual(elegiveis.map((p) => p.id), ['p1']);

  assert.throws(
    () => selectPedidosParaRomaneio(pedidos, {
      empresaId: 'emp-a', groupId: 'g1', selectedIds: ['p2'], exigirSelecao: true,
    }),
    /nao pertence ao contexto/,
  );
  assert.throws(
    () => selectPedidosParaRomaneio(pedidos, { empresaId: null }),
    /Empresa obrigatoria/,
  );
});

test('resolveEmpresaOperacionalExpedicao: prioriza pedido com empresa; ignora órfão; fallback storage', () => {
  assert.equal(
    resolveEmpresaOperacionalExpedicao({
      pedidosSelecionados: [{ id: 'x', empresa_id: null, group_id: 'g1' }],
      empresaAtualId: null,
      storedEmpresaId: 'emp-stored',
    }),
    'emp-stored',
  );
  assert.equal(
    resolveEmpresaOperacionalExpedicao({
      pedidosSelecionados: [
        { id: 'orfao', group_id: 'g1' },
        { id: 'ok', empresa_id: 'emp-a', group_id: 'g1' },
      ],
      empresaAtualId: 'emp-b',
    }),
    'emp-a',
  );
  assert.equal(
    resolveEmpresaOperacionalExpedicao({ pedidosSelecionados: [], empresaAtualId: null }),
    null,
  );
  assert.equal(isPedidoStatusElegivelRomaneio('Pronto para Expedir'), true);
  assert.equal(isPedidoStatusElegivelRomaneio('Em Separação'), true);
  assert.equal(isPedidoStatusElegivelRomaneio('Cancelado'), false);
});

test('planEntregasFromPedidosParaRomaneio: create + reuse idempotente', () => {
  const pedidos = [
    {
      id: 'ped-a',
      empresa_id: 'emp-a',
      group_id: 'g1',
      status: 'Faturado',
      numero_pedido: 'N-1',
      cliente_nome: 'Cliente A',
      peso_total_kg: 10,
      valor_total: 100,
    },
    {
      id: 'ped-b',
      empresa_id: 'emp-a',
      group_id: 'g1',
      status: 'Pronto para Faturar',
      numero_pedido: 'N-2',
      cliente_nome: 'Cliente B',
      peso_total_kg: 5,
      valor_total: 50,
    },
  ];
  const existentes = [{
    id: 'e-exist',
    pedido_id: 'ped-a',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
  }];

  const plano = planEntregasFromPedidosParaRomaneio({
    pedidos,
    entregasExistentes: existentes,
    empresaId: 'emp-a',
    groupId: 'g1',
    selectedIds: ['ped-a', 'ped-b'],
  });
  assert.equal(plano.reuses.length, 1);
  assert.equal(plano.reuses[0].id, 'e-exist');
  assert.equal(plano.creates.length, 1);
  assert.equal(plano.creates[0].pedido_id, 'ped-b');
  assert.equal(plano.creates[0].status, 'Pronto para Expedir');
  assert.equal(plano.action, 'criar');

  const retry = planEntregasFromPedidosParaRomaneio({
    pedidos,
    entregasExistentes: [
      ...existentes,
      { id: 'e-b', pedido_id: 'ped-b', empresa_id: 'emp-a', group_id: 'g1', status: 'Pronto para Expedir' },
    ],
    empresaId: 'emp-a',
    groupId: 'g1',
    selectedIds: ['ped-a', 'ped-b'],
  });
  assert.equal(retry.creates.length, 0);
  assert.equal(retry.reuses.length, 2);
  assert.equal(retry.action, 'retry');
});

test('buildEntregaSeedFromPedido e resolvePedidoLegadoAposRomaneio: contexto obrigatório', () => {
  assert.throws(
    () => buildEntregaSeedFromPedido({ id: 'p1' }, { empresaId: 'emp-a' }),
    /Contexto multiempresa/,
  );
  const seed = buildEntregaSeedFromPedido(
    { id: 'p1', empresa_id: 'emp-a', group_id: 'g1', numero_pedido: 'X', valor_total: 9 },
    { groupId: 'g1', empresaId: 'emp-a' },
  );
  assert.equal(seed.pedido_id, 'p1');
  assert.equal(seed.valor_mercadoria, 9);

  assert.equal(resolvePedidoLegadoAposRomaneio({ pedidoId: 'p1' }), null);
  const patch = resolvePedidoLegadoAposRomaneio({
    pedidoId: 'p1', groupId: 'g1', empresaId: 'emp-a', romaneioId: 'r1',
  });
  assert.equal(patch.status, INTEGRACAO_ROMANEIO_PEDIDO_LEGADO_SIDE_EFFECT.statusAlvo);
  assert.equal(patch._legado_side_effect.reservado, true);
  assert.equal(patch._legado_side_effect.romaneio_id, 'r1');
});

test('IntegracaoRomaneio canônico: pedidos → entregas → romaneio → despacho → legado + rollback', async () => {
  const store = createFluxoStore();
  const pedidosState = new Map();
  const pedidos = [
    {
      id: 'ped-rom-1',
      empresa_id: 'emp-a',
      group_id: 'g1',
      status: 'Faturado',
      numero_pedido: 'R-1',
      cliente_nome: 'Acme',
      peso_total_kg: 12,
      valor_total: 200,
      historico_status: [],
    },
    {
      id: 'ped-rom-2',
      empresa_id: 'emp-a',
      group_id: 'g1',
      status: 'Em Expedicao',
      numero_pedido: 'R-2',
      cliente_nome: 'Beta',
      peso_total_kg: 8,
      valor_total: 80,
      historico_status: [],
    },
  ];
  for (const p of pedidos) pedidosState.set(p.id, { ...p });

  const plano = planEntregasFromPedidosParaRomaneio({
    pedidos,
    entregasExistentes: store.listEntregas(),
    empresaId: 'emp-a',
    groupId: 'g1',
    selectedIds: ['ped-rom-1', 'ped-rom-2'],
  });
  assert.equal(plano.creates.length, 2);

  const entregasCriadas = plano.creates.map((seed, idx) => {
    const id = `e-rom-${idx + 1}`;
    return store.seedEntrega({ ...seed, id });
  });

  const checklist = {
    documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true,
  };
  const fluxo = resolveRomaneioDespacho({
    entregasSelecionadas: entregasCriadas,
    empresaId: 'emp-a',
    groupId: 'g1',
    motorista: 'Joao',
    veiculo: 'HR',
    placa: 'ABC1D23',
    checklist_saida: checklist,
    confirmed: true,
    usuario: 'tester',
  });
  assert.equal(fluxo.action, 'criar');
  assert.equal(fluxo.despachoPatches.length, 2);
  assert.equal(fluxo.despachoPatches[0].patch.sequencia_rota, 1);
  assert.equal(fluxo.despachoPatches[1].patch.sequencia_rota, 2);

  // Concorrência/idempotência: mesmo conjunto de entregas → reuse
  const romaneio = {
    id: 'rom-1',
    ...fluxo.romaneioRecord,
  };
  store.state.romaneios.set(romaneio.id, romaneio);
  const retryFluxo = resolveRomaneioDespacho({
    entregasSelecionadas: entregasCriadas,
    empresaId: 'emp-a',
    groupId: 'g1',
    motorista: 'Joao',
    veiculo: 'HR',
    placa: 'ABC1D23',
    checklist_saida: checklist,
    confirmed: true,
    romaneiosExistentes: [romaneio],
  });
  assert.equal(retryFluxo.action, 'retry');
  assert.equal(retryFluxo.reuse.id, 'rom-1');

  // Rollback se falhar no meio do despacho
  const mapRollback = new Map(entregasCriadas.map((e) => [String(e.id), { ...e }]));
  const rolled = applyDespachoPatchesWithRollback({
    despachoPatches: fluxo.despachoPatches,
    entregasById: mapRollback,
    failAtIndex: 1,
  });
  assert.equal(rolled.ok, false);
  assert.equal(mapRollback.get('e-rom-1').status, 'Pronto para Expedir');

  // Despacho ok + side-effect legado Pedido
  const mapOk = new Map(entregasCriadas.map((e) => [String(e.id), { ...e }]));
  const ok = applyDespachoPatchesWithRollback({
    despachoPatches: fluxo.despachoPatches.map((item) => ({
      entregaId: item.entregaId,
      patch: { ...item.patch, romaneio_id: romaneio.id },
    })),
    entregasById: mapOk,
  });
  assert.equal(ok.ok, true);
  assert.equal(mapOk.get('e-rom-1').status, 'Saiu para Entrega');
  assert.equal(mapOk.get('e-rom-2').romaneio_id, 'rom-1');

  for (const pedido of plano.pedidos) {
    const legado = resolvePedidoLegadoAposRomaneio({
      pedidoId: pedido.id,
      groupId: 'g1',
      empresaId: 'emp-a',
      romaneioId: romaneio.id,
    });
    const before = pedidosState.get(pedido.id);
    pedidosState.set(pedido.id, {
      ...before,
      status: legado.status,
      historico_status: [
        ...(before.historico_status || []),
        { status: legado.status, observacao: `Romaneio ${romaneio.id}` },
      ],
    });
  }
  assert.equal(pedidosState.get('ped-rom-1').status, 'Em Trânsito');
  assert.equal(pedidosState.get('ped-rom-2').status, 'Em Trânsito');

  // RBAC/contexto fail-closed na policy
  assert.throws(
    () => resolveRomaneioDespacho({
      entregasSelecionadas: entregasCriadas,
      empresaId: 'emp-a',
      groupId: null,
      motorista: 'Joao',
      placa: 'ABC1D23',
      veiculo: 'HR',
      checklist_saida: checklist,
      confirmed: true,
    }),
    /Contexto multiempresa/,
  );
  assert.throws(
    () => resolveRomaneioDespacho({
      entregasSelecionadas: entregasCriadas,
      empresaId: 'emp-a',
      groupId: 'g1',
      motorista: 'Joao',
      placa: 'ABC1D23',
      veiculo: 'HR',
      checklist_saida: checklist,
      confirmed: false,
    }),
    /Confirmacao/,
  );
  assert.throws(
    () => resolveRomaneioDespacho({
      entregasSelecionadas: entregasCriadas,
      empresaId: 'emp-a',
      groupId: 'g1',
      motorista: 'Joao',
      placa: 'ABC1D23',
      veiculo: 'HR',
      checklist_saida: { documentos_ok: true },
      confirmed: true,
      exigirChecklist: true,
    }),
    /checklist/,
  );
});

test('candidata #192–#197: Pedido→separação→romaneio→despacho→parcial→ocorrência→pendências + auditoria/falha', async () => {
  const store = createFluxoStore();
  const pedidos = [
    {
      id: 'ped-cand',
      empresa_id: 'emp-a',
      group_id: 'g1',
      status: 'Faturado',
      numero_pedido: 'C-197',
      cliente_nome: 'Cand',
      peso_total_kg: 20,
      valor_total: 400,
      itens_revenda: [{ id: 'i1', quantidade: 6, unidade: 'UN' }],
    },
  ];

  // 1) Pedido elegível → Entrega (create)
  const plano = planEntregasFromPedidosParaRomaneio({
    pedidos,
    entregasExistentes: [],
    empresaId: 'emp-a',
    groupId: 'g1',
    selectedIds: ['ped-cand'],
  });
  assert.equal(plano.creates.length, 1);
  const entrega = store.seedEntrega({ ...plano.creates[0], id: 'e-cand', status: 'Em Separacao' });

  // 2) Separação/conferência
  const sep = await store.concluirSeparacao({
    entregaId: entrega.id,
    pedidoId: 'ped-cand',
    itens: [{
      id: 'i1',
      quantidade_pedida: 6,
      quantidade_separada: 6,
      unidade: 'UN',
      unidade_separada: 'UN',
    }],
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(sep.conclusion.nextEntregaStatus, 'Pronto para Expedir');
  assert.equal(store.state.entregas.get('e-cand').status, 'Pronto para Expedir');
  assert.ok(store.state.audit.some((a) => a.acao === 'SeparacaoConferencia.concluir' && a.sucesso));

  // 3–4) Romaneio + despacho com falha parcial → recuperação
  const fluxo = resolveRomaneioDespacho({
    entregasSelecionadas: [store.state.entregas.get('e-cand')],
    empresaId: 'emp-a',
    groupId: 'g1',
    motorista: 'CandMotorista',
    veiculo: 'Truck',
    placa: 'CAND123',
    checklist_saida: {
      documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true,
    },
    confirmed: true,
  });
  const mapFail = new Map([['e-cand', { ...store.state.entregas.get('e-cand') }]]);
  // simula falha no patch (único item) via failAtIndex 0
  const failed = applyDespachoPatchesWithRollback({
    despachoPatches: fluxo.despachoPatches,
    entregasById: mapFail,
    failAtIndex: 0,
  });
  assert.equal(failed.ok, false);
  assert.equal(mapFail.get('e-cand').status, 'Pronto para Expedir');

  const rom = await store.gerarRomaneioEDespachar({
    selectedIds: ['e-cand'],
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.ok(rom.romaneio.id);
  assert.equal(store.state.entregas.get('e-cand').status, 'Saiu para Entrega');
  assert.ok(store.state.audit.some((a) => a.acao === 'Romaneio.gerar'));

  // Idempotência: mesmo conjunto de entregas reusa romaneio (não re-seleciona pós-despacho)
  const duplicate = assertRomaneioOnCreate({
    record: {
      empresa_id: 'emp-a',
      motorista: 'Ana',
      placa: 'ABC1D23',
      entregas_ids: ['e-cand'],
    },
    romaneios: [rom.romaneio],
  });
  assert.equal(duplicate.reuse.id, rom.romaneio.id);

  // 5) Entrega parcial → pendência
  await store.registrarFinal({
    entregaId: 'e-cand',
    modo: 'parcial',
    quantidade_entregue: 3,
    comprovante: { nome_recebedor: 'Recebedor', foto_comprovante: 'foto://x' },
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  assert.equal(store.state.entregas.get('e-cand').status, 'Entrega Parcial');
  let pendencias = filterEntregasPendencias(store.listEntregas(), { empresaId: 'emp-a', groupId: 'g1' });
  assert.ok(pendencias.some((p) => p.pendencia.tipo === 'parcial' || p.id === 'e-cand'));

  // 6) Ocorrência no retry (nova tentativa frustrada) — exige motivo
  store.state.entregas.set('e-cand', {
    ...store.state.entregas.get('e-cand'),
    status: 'Saiu para Entrega',
    comprovante_entrega: null,
    entrega_parcial: null,
  });
  assert.throws(
    () => resolveRegistroEntregaFinal({
      before: store.state.entregas.get('e-cand'),
      modo: 'ocorrencia',
      groupId: 'g1',
      empresaId: 'emp-a',
      confirmed: true,
      motivo: '',
    }),
    /motivo/,
  );
  await store.registrarFinal({
    entregaId: 'e-cand',
    modo: 'ocorrencia',
    motivo: 'Cliente ausente',
    groupId: 'g1',
    empresaId: 'emp-a',
    confirmed: true,
  });
  pendencias = filterEntregasPendencias(store.listEntregas(), { empresaId: 'emp-a', groupId: 'g1' });
  assert.ok(pendencias.some((p) => p.pendencia.tipo === 'ocorrencia'));
  assert.ok(store.state.audit.some((a) => a.acao === 'Entrega.registro_ocorrencia'));

  // Isolamento: empresa B não vê pendência
  const cruzadas = filterEntregasPendencias(store.listEntregas(), { empresaId: 'emp-b', groupId: 'g1' });
  assert.equal(cruzadas.length, 0);

  // Falha de auditoria sobe
  store.state.failAudit = true;
  assert.throws(() => store.audit({ acao: 'probe' }), /auditar/);
});

test('quantidades pendentes e compensação≠atômico no despacho/reversa', () => {
  assert.equal(PERSISTENCIA_EXPEDICAO.despachoPatches, 'compensacao');
  assert.equal(PERSISTENCIA_EXPEDICAO.registroFinal, 'atomico_policy');
  assert.equal(PERSISTENCIA_EXPEDICAO.logisticaReversa, 'compensacao');
  assert.equal(PERSISTENCIA_EXPEDICAO.romaneioCreate, 'atomico_policy');

  const parcial = resolveQuantidadesPendentesEntrega({
    status: 'Entrega Parcial',
    volumes: 10,
    entrega_parcial: { ativada: true, quantidade_entregue: 4, quantidade_pedida: 10 },
  });
  assert.equal(parcial.quantidade_pedida, 10);
  assert.equal(parcial.quantidade_entregue, 4);
  assert.equal(parcial.quantidade_pendente, 6);
  assert.equal(parcial.parcial, true);

  const total = resolveQuantidadesPendentesEntrega({
    status: 'Entregue',
    quantidade_total: 5,
    entrega_parcial: { quantidade_entregue: 5 },
  });
  assert.equal(total.quantidade_pendente, 0);

  // Compensação: falha no 2º patch reverte o 1º (não é TX atômica única)
  const map = new Map([
    ['e1', { id: 'e1', empresa_id: 'emp-a', group_id: 'g1', status: 'Pronto para Expedir', historico_status: [] }],
    ['e2', { id: 'e2', empresa_id: 'emp-a', group_id: 'g1', status: 'Pronto para Expedir', historico_status: [] }],
  ]);
  const fluxo = resolveRomaneioDespacho({
    entregasSelecionadas: [...map.values()],
    empresaId: 'emp-a',
    groupId: 'g1',
    motorista: 'Ana',
    placa: 'ABC1D23',
    veiculo: 'Truck',
    checklist_saida: {
      documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true,
    },
    confirmed: true,
  });
  const compensated = applyDespachoPatchesWithRollback({
    despachoPatches: fluxo.despachoPatches,
    entregasById: map,
    failAtIndex: 1,
  });
  assert.equal(compensated.ok, false);
  assert.deepEqual(compensated.rolledBackIds, ['e1']);
  assert.equal(map.get('e1').status, 'Pronto para Expedir');
  assert.equal(map.get('e2').status, 'Pronto para Expedir');

  // Atômico de policy: reuse romaneio sem aplicar patches
  const romaneio = { id: 'r-atom', ...fluxo.romaneioRecord };
  const retry = resolveRomaneioDespacho({
    entregasSelecionadas: [...map.values()],
    empresaId: 'emp-a',
    groupId: 'g1',
    motorista: 'Ana',
    placa: 'ABC1D23',
    veiculo: 'Truck',
    checklist_saida: {
      documentos_ok: true, veiculo_ok: true, carga_conferida: true, combustivel_ok: true,
    },
    confirmed: true,
    romaneiosExistentes: [romaneio],
  });
  assert.equal(retry.action, 'retry');
  assert.equal(retry.despachoPatches.length, 0);
});
