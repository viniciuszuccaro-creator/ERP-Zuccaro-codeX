/**
 * Testes de integração do fluxo efetivamente usado pelas telas Expedição:
 * IntegracaoRomaneio / RomaneioForm / ComprovanteEntregaDigital / LogisticaReversa.
 * Complementa as policies com persistência simulada multi-etapa (compensação ≠ TX).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertEntregaOnUpdate,
  assertRomaneioOnCreate,
} from '../src/components/lib/expedicaoEntregaPolicy.js';
import {
  PERSISTENCIA_EXPEDICAO,
  applyDespachoPatchesWithRollback,
  planEntregasFromPedidosParaRomaneio,
  resolvePedidoLegadoAposRomaneio,
  resolveRegistroEntregaFinal,
  resolveRomaneioDespacho,
  resolveSeparacaoConclusion,
  selectEntregasParaRomaneio,
} from '../src/components/lib/expedicaoFluxoOperacionalPolicy.js';

const checklistOk = {
  conferiu_quantidade: true,
  conferiu_qualidade: true,
  conferiu_embalagem: true,
  conferiu_etiquetas: true,
  conferiu_documentos: true,
};

const checklistSaida = {
  documentos_ok: true,
  veiculo_ok: true,
  carga_conferida: true,
  combustivel_ok: true,
};

/**
 * Store espelhando orquestração das telas (não TX): entregas → romaneio → despacho →
 * Pedido legado → registro final → estoque → devolução.
 * `uiSuccess` só fica true se TODA a cadeia crítica + audit fail-closed concluir.
 */
function createIntegracaoStore() {
  const state = {
    pedidos: new Map(),
    entregas: new Map(),
    romaneios: new Map(),
    estoque: new Map(),
    movimentacoes: [],
    contasReceber: new Map(),
    notificacoes: [],
    audit: [],
    failAt: null, // 'despacho' | 'pedido_legado' | 'estoque' | 'audit_final' | 'financeiro' | 'notificacao'
    failDespachoAtIndex: null,
    uiSuccess: false,
  };

  const audit = (entry, { failClosed = false } = {}) => {
    if (state.failAt === 'audit_final' && failClosed) {
      throw new Error('Falha ao auditar integracao de telas.');
    }
    state.audit.push({ ...entry, at: Date.now() });
  };

  return {
    state,
    audit,
    seedPedido(row) {
      state.pedidos.set(row.id, { ...row, historico_status: row.historico_status || [] });
      return state.pedidos.get(row.id);
    },
    seedEntrega(row) {
      state.entregas.set(row.id, { ...row, historico_status: row.historico_status || [] });
      return state.entregas.get(row.id);
    },
    seedProduto(id, estoque_atual) {
      state.estoque.set(id, { id, estoque_atual });
    },
    seedConta(id, row = {}) {
      state.contasReceber.set(id, { id, status: 'Aberto', ...row });
    },

    /** Espelha SeparacaoConferencia → status Pronto. */
    concluirSeparacao({ entregaId, pedidoId, itens, groupId, empresaId }) {
      const conclusion = resolveSeparacaoConclusion({
        itens,
        checklist: checklistOk,
        groupId,
        empresaId,
        entregaId,
        pedidoId,
        confirmed: true,
      });
      const before = state.entregas.get(entregaId);
      const patch = { status: conclusion.nextEntregaStatus, group_id: groupId, empresa_id: empresaId };
      assertEntregaOnUpdate({ before, patch });
      state.entregas.set(entregaId, { ...before, ...patch });
      audit({ acao: 'SeparacaoConferencia.concluir', sucesso: true, entrega_id: entregaId });
      return conclusion;
    },

    /**
     * Espelha IntegracaoRomaneio / RomaneioForm:
     * create romaneio → patches despacho com rollback → Pedido legado → audit failClosed.
     * selectedIds = IDs de Entrega já seedadas (fluxo RomaneioForm / pós-plan).
     */
    async integracaoRomaneioEDespacho({
      pedidos = [],
      selectedIds,
      groupId,
      empresaId,
      romaneiosExistentes = null,
    }) {
      state.uiSuccess = false;

      const selecionadas = selectEntregasParaRomaneio([...state.entregas.values()], {
        empresaId,
        groupId,
        selectedIds,
        exigirSelecao: true,
      });

      const fluxo = resolveRomaneioDespacho({
        entregasSelecionadas: selecionadas,
        empresaId,
        groupId,
        motorista: 'Motorista UI',
        veiculo: 'Truck',
        placa: 'UIX1A23',
        checklist_saida: checklistSaida,
        confirmed: true,
        romaneiosExistentes: romaneiosExistentes ?? [...state.romaneios.values()],
      });

      if (fluxo.reuse) {
        audit({ acao: 'Romaneio.integracao.retry', reuse_id: fluxo.reuse.id, sucesso: true });
        state.uiSuccess = true;
        return { romaneio: fluxo.reuse, fluxo, retry: true, uiSuccess: true };
      }

      const romId = `rom-ui-${state.romaneios.size + 1}`;
      const romaneio = { id: romId, ...fluxo.romaneioRecord };
      state.romaneios.set(romId, romaneio);

      const map = new Map(selecionadas.map((e) => [String(e.id), { ...e }]));
      const despacho = applyDespachoPatchesWithRollback({
        despachoPatches: fluxo.despachoPatches.map((item) => ({
          ...item,
          patch: { ...item.patch, romaneio_id: romId },
        })),
        entregasById: map,
        failAtIndex: state.failAt === 'despacho' ? (state.failDespachoAtIndex ?? 0) : null,
      });

      if (!despacho.ok) {
        for (const [id, row] of map) {
          state.entregas.set(id, row);
        }
        audit({
          acao: 'Romaneio.integracao.rollback',
          sucesso: false,
          motivo: 'persistencia_parcial',
          rolled_back: despacho.rolledBackIds,
        });
        throw new Error('Estado parcial: falha no despacho apos romaneio; patches revertidos.');
      }

      for (const [id, row] of map) {
        state.entregas.set(id, row);
      }

      const pedidosLegadoAplicados = [];
      const pedidoIds = [...new Set(
        selecionadas.map((e) => e.pedido_id).filter(Boolean),
      )];
      try {
        for (const pedidoId of pedidoIds) {
          if (state.failAt === 'pedido_legado' && pedidosLegadoAplicados.length >= 1) {
            throw new Error('Falha simulada no Pedido legado.');
          }
          const pedido = state.pedidos.get(pedidoId) || pedidos.find((p) => p.id === pedidoId);
          if (!pedido) continue;
          const legadoPatch = resolvePedidoLegadoAposRomaneio({
            pedidoId,
            groupId,
            empresaId: pedido.empresa_id || empresaId,
            romaneioId: romId,
          });
          if (!legadoPatch) continue;
          const { _legado_side_effect, ...patch } = legadoPatch;
          const before = state.pedidos.get(pedidoId);
          if (before) {
            state.pedidos.set(pedidoId, {
              ...before,
              ...patch,
              historico_status: [
                ...(before.historico_status || []),
                { status: patch.status, _legado_side_effect },
              ],
            });
          }
          pedidosLegadoAplicados.push(pedidoId);
        }
      } catch (legadoError) {
        audit({
          acao: 'Romaneio.integracao.parcial',
          sucesso: false,
          motivo: 'pedido_legado_parcial',
          pedidos_ok: pedidosLegadoAplicados,
        });
        throw new Error(
          `Estado parcial: romaneio/despacho persistido, mas Pedido legado incompleto (${pedidosLegadoAplicados.length}). ${legadoError.message}`,
        );
      }

      audit({ acao: 'Romaneio.integracao', sucesso: true, romaneio_id: romId }, { failClosed: true });
      state.uiSuccess = true;
      return { romaneio, fluxo, retry: false, uiSuccess: true };
    },

    /**
     * Espelha ComprovanteEntregaDigital: Entrega → Pedido → estoque → audit failClosed.
     */
    async confirmarComprovante({ entregaId, pedidoId, groupId, empresaId, itens = [] }) {
      state.uiSuccess = false;
      const before = state.entregas.get(entregaId);
      const resolved = resolveRegistroEntregaFinal({
        before,
        modo: 'total',
        comprovante: { nome_recebedor: 'Recebedor UI', foto_comprovante: 'foto://ui' },
        groupId,
        empresaId,
        confirmed: true,
      });
      assertEntregaOnUpdate({ before, patch: resolved.patch });
      state.entregas.set(entregaId, { ...before, ...resolved.patch });

      const ped = state.pedidos.get(pedidoId);
      if (ped) {
        if (state.failAt === 'pedido_legado') {
          audit({ acao: 'Entrega.comprovante.confirmar.parcial', sucesso: false, motivo: 'pedido_legado_parcial' });
          throw new Error('Estado parcial: entrega persistida, mas Pedido legado incompleto.');
        }
        state.pedidos.set(pedidoId, { ...ped, status: 'Entregue' });
      }

      try {
        for (const item of itens) {
          if (state.failAt === 'estoque') {
            throw new Error('Falha simulada na baixa de estoque.');
          }
          const prod = state.estoque.get(item.produto_id);
          if (!prod || prod.estoque_atual < item.quantidade) {
            throw new Error('Estoque insuficiente.');
          }
          const novo = prod.estoque_atual - item.quantidade;
          state.estoque.set(item.produto_id, { ...prod, estoque_atual: novo });
          state.movimentacoes.push({
            tipo: 'saida',
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            origem: 'comprovante',
          });
        }
      } catch (estoqueError) {
        audit({ acao: 'Entrega.comprovante.confirmar.parcial', sucesso: false, motivo: 'estoque_parcial' });
        throw new Error(
          `Estado parcial: entrega/Pedido persistidos, mas baixa de estoque incompleta. ${estoqueError.message}`,
        );
      }

      audit({ acao: 'Entrega.comprovante.confirmar', sucesso: true }, { failClosed: true });
      state.uiSuccess = true;
      return { uiSuccess: true };
    },

    /** Espelha registro parcial (parcial repetida / retry). */
    registrarParcial({ entregaId, quantidade_entregue, groupId, empresaId }) {
      state.uiSuccess = false;
      const before = state.entregas.get(entregaId);
      const resolved = resolveRegistroEntregaFinal({
        before,
        modo: 'parcial',
        quantidade_entregue,
        comprovante: { nome_recebedor: 'Parcial', foto_comprovante: 'foto://p' },
        groupId,
        empresaId,
        confirmed: true,
      });
      if (resolved.action === 'retry') {
        audit({ acao: 'Entrega.registro_parcial.retry', sucesso: true });
        state.uiSuccess = true;
        return { ...resolved, uiSuccess: true };
      }
      assertEntregaOnUpdate({ before, patch: resolved.patch });
      state.entregas.set(entregaId, { ...before, ...resolved.patch });
      audit({ acao: 'Entrega.registro_parcial', sucesso: true }, { failClosed: true });
      state.uiSuccess = true;
      return { ...resolved, uiSuccess: true };
    },

    /**
     * Espelha LogisticaReversa: Entrega → financeiro → estoque → notificação → audit.
     */
    async processarDevolucao({
      entregaId,
      motivo = 'Recusa de Recebimento',
      acao = 'devolver_estoque',
      groupId,
      empresaId,
    }) {
      state.uiSuccess = false;
      const before = state.entregas.get(entregaId);
      const qty = Number(
        (state.pedidos.get(before.pedido_id)?.itens_revenda || [])
          .reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
      ) || Number(before.volumes || before.quantidade_total || 1);
      const patch = {
        status: 'Devolvido',
        group_id: groupId,
        empresa_id: empresaId,
        logistica_reversa: {
          motivo,
          acao_reversa: acao,
          quantidade_devolvida: qty > 0 ? qty : 1,
          persistencia: PERSISTENCIA_EXPEDICAO.logisticaReversa,
        },
        entrega_frustrada: {
          motivo,
          acao_reversa: acao,
          persistencia: PERSISTENCIA_EXPEDICAO.logisticaReversa,
          tentativa_numero: 1,
        },
      };
      assertEntregaOnUpdate({ before, patch });
      state.entregas.set(entregaId, { ...before, ...patch });
      const etapasOk = { entrega: true, financeiro: false, estoque: false, notificacao: false };

      try {
        const ped = state.pedidos.get(before.pedido_id);
        if (ped?.contas_receber_ids?.length) {
          if (state.failAt === 'financeiro') throw new Error('Falha simulada no financeiro.');
          for (const cid of ped.contas_receber_ids) {
            const c = state.contasReceber.get(cid);
            if (c) state.contasReceber.set(cid, { ...c, status: 'Cancelado' });
          }
        }
        etapasOk.financeiro = true;

        if (acao === 'devolver_estoque') {
          if (state.failAt === 'estoque') throw new Error('Falha simulada no estoque da devolucao.');
          for (const item of ped?.itens_revenda || []) {
            const prod = state.estoque.get(item.produto_id) || { id: item.produto_id, estoque_atual: 0 };
            state.estoque.set(item.produto_id, {
              ...prod,
              estoque_atual: prod.estoque_atual + (item.quantidade || 0),
            });
            state.movimentacoes.push({
              tipo: 'entrada',
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              origem: 'devolucao',
            });
          }
        }
        etapasOk.estoque = true;

        if (state.failAt === 'notificacao') throw new Error('Falha simulada na notificacao.');
        state.notificacoes.push({ titulo: `Devolução Total - Pedido ${before.numero_pedido}`, empresa_id: empresaId });
        etapasOk.notificacao = true;
      } catch (secundarioError) {
        audit({
          acao: 'Entrega.logisticaReversa.processar.parcial',
          sucesso: false,
          motivo: 'compensacao_parcial',
          etapas_ok: etapasOk,
        });
        throw new Error(
          `Estado parcial: entrega marcada Devolvido, mas etapas posteriores incompletas (${JSON.stringify(etapasOk)}). ${secundarioError.message}`,
        );
      }

      audit({ acao: 'Entrega.logisticaReversa.processar', sucesso: true, etapas_ok: etapasOk }, { failClosed: true });
      state.uiSuccess = true;
      return { uiSuccess: true, etapasOk };
    },
  };
}

test('integração telas: Pedido→separação→romaneio→despacho→parcial→total com uiSuccess só no fim', async () => {
  const store = createIntegracaoStore();
  const pedidos = [
    {
      id: 'ped-ui-1',
      empresa_id: 'emp-a',
      group_id: 'g1',
      status: 'Faturado',
      numero_pedido: 'UI-1',
      itens_revenda: [{ produto_id: 'prod-1', quantidade: 10, unidade: 'UN', descricao: 'P1' }],
    },
  ];
  store.seedPedido(pedidos[0]);
  store.seedProduto('prod-1', 100);

  const plano = planEntregasFromPedidosParaRomaneio({
    pedidos,
    entregasExistentes: [],
    empresaId: 'emp-a',
    groupId: 'g1',
    selectedIds: ['ped-ui-1'],
  });
  store.seedEntrega({ ...plano.creates[0], id: 'e-ui-1', status: 'Em Separacao', pedido_id: 'ped-ui-1' });
  store.concluirSeparacao({
    entregaId: 'e-ui-1',
    pedidoId: 'ped-ui-1',
    itens: [{ id: 'i1', quantidade_pedida: 10, quantidade_separada: 10, unidade: 'UN', unidade_separada: 'UN' }],
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.equal(store.state.entregas.get('e-ui-1').status, 'Pronto para Expedir');

  const rom = await store.integracaoRomaneioEDespacho({
    pedidos,
    selectedIds: ['e-ui-1'],
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.equal(rom.uiSuccess, true);
  assert.equal(store.state.entregas.get('e-ui-1').status, 'Saiu para Entrega');
  assert.equal(store.state.pedidos.get('ped-ui-1').status, 'Em Trânsito');

  const parcial = store.registrarParcial({
    entregaId: 'e-ui-1',
    quantidade_entregue: 4,
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.equal(parcial.uiSuccess, true);
  assert.equal(store.state.entregas.get('e-ui-1').status, 'Entrega Parcial');

  // Reabrir para total (simula segunda tentativa após completar restante)
  store.state.entregas.set('e-ui-1', {
    ...store.state.entregas.get('e-ui-1'),
    status: 'Saiu para Entrega',
    entrega_parcial: null,
    comprovante_entrega: null,
  });
  const total = await store.confirmarComprovante({
    entregaId: 'e-ui-1',
    pedidoId: 'ped-ui-1',
    groupId: 'g1',
    empresaId: 'emp-a',
    itens: [{ produto_id: 'prod-1', quantidade: 10 }],
  });
  assert.equal(total.uiSuccess, true);
  assert.equal(store.state.entregas.get('e-ui-1').status, 'Entregue');
  assert.equal(store.state.estoque.get('prod-1').estoque_atual, 90);
  assert.ok(store.state.audit.some((a) => a.acao === 'Entrega.comprovante.confirmar'));
});

test('duas operações concorrentes: segundo romaneio reusa (idempotente)', async () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-conc-1',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'ped-c',
  });
  store.seedEntrega({
    id: 'e-conc-2',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'ped-c2',
  });
  store.seedPedido({ id: 'ped-c', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });
  store.seedPedido({ id: 'ped-c2', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });

  const first = await store.integracaoRomaneioEDespacho({
    pedidos: [...store.state.pedidos.values()],
    selectedIds: ['e-conc-1', 'e-conc-2'],
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.equal(first.retry, false);

  // Concorrência: assertRomaneioOnCreate reusa o mesmo conjunto (sem reaplicar patches)
  const duplicate = assertRomaneioOnCreate({
    record: {
      empresa_id: 'emp-a',
      motorista: 'X',
      placa: 'YYY',
      entregas_ids: ['e-conc-1', 'e-conc-2'],
    },
    romaneios: [...store.state.romaneios.values()],
  });
  assert.equal(duplicate.reuse.id, first.romaneio.id);

  // resolveRomaneioDespacho com mesmas entregas (sem romaneio_id no input) + existente → retry
  const retryFluxo = resolveRomaneioDespacho({
    entregasSelecionadas: [
      { id: 'e-conc-1', empresa_id: 'emp-a', group_id: 'g1', status: 'Pronto para Expedir' },
      { id: 'e-conc-2', empresa_id: 'emp-a', group_id: 'g1', status: 'Pronto para Expedir' },
    ],
    empresaId: 'emp-a',
    groupId: 'g1',
    motorista: 'Motorista UI',
    veiculo: 'Truck',
    placa: 'UIX1A23',
    checklist_saida: checklistSaida,
    confirmed: true,
    romaneiosExistentes: [...store.state.romaneios.values()],
  });
  assert.equal(retryFluxo.action, 'retry');
  assert.equal(retryFluxo.despachoPatches.length, 0);
});

test('despacho repetido: após Saiu para Entrega não re-seleciona; reuse via romaneio', async () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-rep',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'ped-rep',
  });
  store.seedPedido({ id: 'ped-rep', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });

  const first = await store.integracaoRomaneioEDespacho({
    pedidos: [...store.state.pedidos.values()],
    selectedIds: ['e-rep'],
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.equal(store.state.entregas.get('e-rep').status, 'Saiu para Entrega');

  assert.throws(
    () => selectEntregasParaRomaneio([...store.state.entregas.values()], {
      empresaId: 'emp-a',
      groupId: 'g1',
      selectedIds: ['e-rep'],
      exigirSelecao: true,
    }),
    /elegivel/,
  );

  const reuse = assertRomaneioOnCreate({
    record: {
      empresa_id: 'emp-a',
      motorista: 'M',
      placa: 'P',
      entregas_ids: first.romaneio.entregas_ids || ['e-rep'],
    },
    romaneios: [...store.state.romaneios.values()],
  });
  assert.equal(reuse.reuse.id, first.romaneio.id);
});

test('falha após atualização parcial no despacho: rollback + sem uiSuccess', async () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-f1',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'p1',
  });
  store.seedEntrega({
    id: 'e-f2',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'p2',
  });
  store.seedPedido({ id: 'p1', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });
  store.seedPedido({ id: 'p2', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });

  store.state.failAt = 'despacho';
  store.state.failDespachoAtIndex = 1;

  await assert.rejects(
    () => store.integracaoRomaneioEDespacho({
      pedidos: [...store.state.pedidos.values()],
      selectedIds: ['e-f1', 'e-f2'],
      groupId: 'g1',
      empresaId: 'emp-a',
    }),
    /Estado parcial.*despacho/,
  );
  assert.equal(store.state.uiSuccess, false);
  assert.equal(store.state.entregas.get('e-f1').status, 'Pronto para Expedir');
  assert.equal(store.state.entregas.get('e-f2').status, 'Pronto para Expedir');
  assert.ok(store.state.audit.some((a) => a.acao === 'Romaneio.integracao.rollback'));
});

test('auditoria final fail-closed: romaneio/despacho ok mas UI sem sucesso', async () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-aud',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'ped-aud',
  });
  store.seedPedido({ id: 'ped-aud', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });
  store.state.failAt = 'audit_final';

  await assert.rejects(
    () => store.integracaoRomaneioEDespacho({
      pedidos: [...store.state.pedidos.values()],
      selectedIds: ['e-aud'],
      groupId: 'g1',
      empresaId: 'emp-a',
    }),
    /auditar/,
  );
  assert.equal(store.state.uiSuccess, false);
  // Persistência do despacho já ocorreu — estado parcial sem toast de sucesso
  assert.equal(store.state.entregas.get('e-aud').status, 'Saiu para Entrega');
});

test('Pedido legado parcial após despacho: Estado parcial sem uiSuccess', async () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-leg-1',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'ped-leg-1',
  });
  store.seedEntrega({
    id: 'e-leg-2',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Pronto para Expedir',
    pedido_id: 'ped-leg-2',
  });
  store.seedPedido({ id: 'ped-leg-1', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });
  store.seedPedido({ id: 'ped-leg-2', empresa_id: 'emp-a', group_id: 'g1', status: 'Faturado' });
  store.state.failAt = 'pedido_legado';

  await assert.rejects(
    () => store.integracaoRomaneioEDespacho({
      pedidos: [...store.state.pedidos.values()],
      selectedIds: ['e-leg-1', 'e-leg-2'],
      groupId: 'g1',
      empresaId: 'emp-a',
    }),
    /Estado parcial.*Pedido legado/,
  );
  assert.equal(store.state.uiSuccess, false);
  assert.equal(store.state.pedidos.get('ped-leg-1').status, 'Em Trânsito');
  assert.equal(store.state.pedidos.get('ped-leg-2').status, 'Faturado');
  assert.ok(store.state.audit.some((a) => a.motivo === 'pedido_legado_parcial'));
});

test('entrega parcial repetida: retry idempotente; redução bloqueada', () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-par',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Saiu para Entrega',
    volumes: 10,
    quantidade_total: 10,
  });

  const first = store.registrarParcial({
    entregaId: 'e-par',
    quantidade_entregue: 5,
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.ok(first.action === 'entregar' || first.action === 'editar' || !first.action || first.action === 'create');
  assert.equal(store.state.entregas.get('e-par').status, 'Entrega Parcial');

  const retry = store.registrarParcial({
    entregaId: 'e-par',
    quantidade_entregue: 5,
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.equal(retry.action, 'retry');
  assert.equal(retry.uiSuccess, true);

  assert.throws(
    () => store.registrarParcial({
      entregaId: 'e-par',
      quantidade_entregue: 3,
      groupId: 'g1',
      empresaId: 'emp-a',
    }),
    /reduzida|estorno/,
  );

  // Aumento de parcial permitido (mais itens entregues)
  const more = store.registrarParcial({
    entregaId: 'e-par',
    quantidade_entregue: 8,
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.notEqual(more.action, 'retry');
  assert.equal(store.state.entregas.get('e-par').entrega_parcial.quantidade_entregue, 8);

  // Após total, parcial bloqueada
  store.state.entregas.set('e-par', {
    ...store.state.entregas.get('e-par'),
    status: 'Entregue',
  });
  assert.throws(
    () => store.registrarParcial({
      entregaId: 'e-par',
      quantidade_entregue: 9,
      groupId: 'g1',
      empresaId: 'emp-a',
    }),
    /finalizada/,
  );
});

test('comprovante: falha estoque após entrega → Estado parcial sem uiSuccess', async () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-est',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Saiu para Entrega',
    pedido_id: 'ped-est',
  });
  store.seedPedido({ id: 'ped-est', empresa_id: 'emp-a', group_id: 'g1', status: 'Em Transito' });
  store.seedProduto('prod-x', 50);
  store.state.failAt = 'estoque';

  await assert.rejects(
    () => store.confirmarComprovante({
      entregaId: 'e-est',
      pedidoId: 'ped-est',
      groupId: 'g1',
      empresaId: 'emp-a',
      itens: [{ produto_id: 'prod-x', quantidade: 5 }],
    }),
    /Estado parcial.*estoque/,
  );
  assert.equal(store.state.uiSuccess, false);
  assert.equal(store.state.entregas.get('e-est').status, 'Entregue');
  assert.equal(store.state.pedidos.get('ped-est').status, 'Entregue');
  assert.equal(store.state.estoque.get('prod-x').estoque_atual, 50);
  assert.ok(store.state.audit.some((a) => a.motivo === 'estoque_parcial'));
});

test('devolução: falha secundária após Entrega Devolvido → Estado parcial', async () => {
  const store = createIntegracaoStore();
  store.seedEntrega({
    id: 'e-dev',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Saiu para Entrega',
    pedido_id: 'ped-dev',
    numero_pedido: 'DEV-1',
  });
  store.seedPedido({
    id: 'ped-dev',
    empresa_id: 'emp-a',
    group_id: 'g1',
    status: 'Em Transito',
    contas_receber_ids: ['cr-1'],
    itens_revenda: [{ produto_id: 'prod-d', quantidade: 2, unidade: 'UN' }],
  });
  store.seedConta('cr-1');
  store.seedProduto('prod-d', 10);
  assert.equal(PERSISTENCIA_EXPEDICAO.logisticaReversa, 'compensacao');
  assert.equal(PERSISTENCIA_EXPEDICAO.comprovanteEntrega, 'compensacao');

  store.state.failAt = 'financeiro';
  await assert.rejects(
    () => store.processarDevolucao({
      entregaId: 'e-dev',
      groupId: 'g1',
      empresaId: 'emp-a',
    }),
    /Estado parcial.*Devolvido/,
  );
  assert.equal(store.state.uiSuccess, false);
  assert.equal(store.state.entregas.get('e-dev').status, 'Devolvido');
  assert.equal(store.state.contasReceber.get('cr-1').status, 'Aberto');
  assert.ok(store.state.audit.some((a) => a.motivo === 'compensacao_parcial'));

  // Retry bem-sucedido completa a cadeia
  store.state.failAt = null;
  const ok = await store.processarDevolucao({
    entregaId: 'e-dev',
    groupId: 'g1',
    empresaId: 'emp-a',
  });
  assert.equal(ok.uiSuccess, true);
  assert.equal(store.state.contasReceber.get('cr-1').status, 'Cancelado');
  assert.equal(store.state.estoque.get('prod-d').estoque_atual, 12);
  assert.equal(store.state.notificacoes.length, 1);
});
