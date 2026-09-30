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
  assertConfirmacaoDupla,
  assertSeparacaoChecklist,
  assertSeparacaoQuantidades,
  filterEntregasPendencias,
  resolveRegistroEntregaFinal,
  resolveRomaneioDespacho,
  resolveSeparacaoConclusion,
  revalidarSelecaoAposTrocaEmpresa,
  selectEntregasParaRomaneio,
  selectPedidosParaSeparacao,
  applyDespachoPatchesWithRollback,
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
