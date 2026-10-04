import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import {
  entregaStatusToLabel,
  sortedEntregasKey,
  sumQty,
  type Entrega,
  type EntregaCreate,
  type EntregaHistorico,
  type EntregaItem,
  type EntregaListFilters,
  type EntregaStatus,
  type ExpedicaoRepository,
  type ExpedicaoScope,
  type Romaneio,
  type RomaneioCreate,
  type RomaneioStatus,
  type Separacao,
} from './expedicaoTypes.js';

const clone = <T>(value: T): T => structuredClone(value);
const keyOf = (scope: ExpedicaoScope) => `${scope.groupId}:${scope.empresaId}`;

function mapEntrega(row: Entrega): Entrega {
  return {
    ...clone(row),
    status_label: entregaStatusToLabel(row.status),
    numero_entrega: row.qr_code || row.numero,
  };
}

export class InMemoryExpedicaoRepository implements ExpedicaoRepository {
  private entregas = new Map<string, Entrega>();
  private historico: EntregaHistorico[] = [];
  private romaneios = new Map<string, Romaneio>();
  private separacoes = new Map<string, Separacao>();
  private nextEntrega = new Map<string, number>();
  private nextRomaneio = new Map<string, number>();

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const snap = {
      entregas: clone(this.entregas),
      historico: clone(this.historico),
      romaneios: clone(this.romaneios),
      separacoes: clone(this.separacoes),
      nextEntrega: new Map(this.nextEntrega),
      nextRomaneio: new Map(this.nextRomaneio),
    };
    try {
      return await fn();
    } catch (error) {
      this.entregas = snap.entregas;
      this.historico = snap.historico;
      this.romaneios = snap.romaneios;
      this.separacoes = snap.separacoes;
      this.nextEntrega = snap.nextEntrega;
      this.nextRomaneio = snap.nextRomaneio;
      throw error;
    }
  }

  async createEntrega(scope: ExpedicaoScope, data: EntregaCreate, actorId: string): Promise<Entrega> {
    if (data.idempotency_key) {
      const existing = await this.getEntregaByIdempotency(scope, data.idempotency_key);
      if (existing) return existing;
    }
    if (data.pedido_id) {
      const byPedido = await this.getEntregaByPedido(scope, data.pedido_id);
      if (byPedido && byPedido.status !== 'CANCELADA') return byPedido;
    }
    const now = new Date().toISOString();
    const sequenceKey = keyOf(scope);
    const number = this.nextEntrega.get(sequenceKey) ?? 1;
    const itens: EntregaItem[] = data.itens.map((item) => ({
      id: randomUUID(),
      produto_id: item.produto_id ?? null,
      descricao: item.descricao,
      unidade_sigla: item.unidade_sigla || 'UN',
      quantidade_pedida: item.quantidade_pedida,
      quantidade_separada: item.quantidade_separada ?? '0.000000',
      quantidade_entregue: item.quantidade_entregue ?? '0.000000',
      quantidade_devolvida: item.quantidade_devolvida ?? '0.000000',
    }));
    const total = sumQty(itens.map((i) => i.quantidade_pedida));
    const row: Entrega = {
      id: randomUUID(),
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      numero: String(number).padStart(8, '0'),
      status: 'AGUARDANDO_SEPARACAO',
      status_label: entregaStatusToLabel('AGUARDANDO_SEPARACAO'),
      pedido_id: data.pedido_id ?? null,
      pedido_numero: data.pedido_numero ?? null,
      cliente_id: data.cliente_id ?? null,
      cliente_nome: data.cliente_nome ?? null,
      cliente_empresa_id: data.cliente_empresa_id ?? null,
      cliente_local_id: data.cliente_local_id ?? null,
      tipo_frete: data.tipo_frete ?? 'ENTREGA',
      data_entrega_solicitada: data.data_entrega_solicitada ?? null,
      data_previsao: data.data_previsao ?? null,
      data_saida: null,
      data_entrega: null,
      romaneio_id: null,
      motorista_id: null,
      motorista_nome: null,
      veiculo: null,
      placa: null,
      sequencia_rota: null,
      cidade: data.cidade ?? null,
      endereco: data.endereco ?? {},
      comprovante_entrega: {},
      entrega_parcial: {},
      entrega_frustrada: {},
      logistica_reversa: {},
      quantidade_total: total,
      volumes: data.volumes ?? total,
      observacoes: data.observacoes ?? null,
      idempotency_key: data.idempotency_key ?? null,
      qr_code: null,
      numero_entrega: String(number).padStart(8, '0'),
      ativo: true,
      itens,
      created_at: now,
      updated_at: now,
    };
    row.qr_code = `ENT-${row.numero}`;
    row.numero_entrega = row.qr_code;
    this.nextEntrega.set(sequenceKey, number + 1);
    this.entregas.set(row.id, row);
    this.historico.push({
      id: randomUUID(),
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      entrega_id: row.id,
      status_anterior: null,
      status_novo: 'AGUARDANDO_SEPARACAO',
      actor_id: actorId,
      motivo: null,
      idempotency_key: null,
      created_at: now,
    });
    return mapEntrega(row);
  }

  async getEntrega(scope: ExpedicaoScope, id: string): Promise<Entrega | null> {
    const row = this.entregas.get(id);
    return row?.group_id === scope.groupId && row.empresa_id === scope.empresaId ? mapEntrega(row) : null;
  }

  async getEntregaForUpdate(scope: ExpedicaoScope, id: string): Promise<Entrega | null> {
    return this.getEntrega(scope, id);
  }

  async getEntregaByPedido(scope: ExpedicaoScope, pedidoId: string): Promise<Entrega | null> {
    const row = [...this.entregas.values()].find(
      (item) => item.group_id === scope.groupId && item.empresa_id === scope.empresaId && item.pedido_id === pedidoId && item.status !== 'CANCELADA',
    );
    return row ? mapEntrega(row) : null;
  }

  async getEntregaByIdempotency(scope: ExpedicaoScope, key: string): Promise<Entrega | null> {
    const row = [...this.entregas.values()].find(
      (item) => item.group_id === scope.groupId && item.empresa_id === scope.empresaId && item.idempotency_key === key,
    );
    return row ? mapEntrega(row) : null;
  }

  async listEntregas(scope: ExpedicaoScope, limit = 50, offset = 0, _executor?: DbQueryExecutor, filters: EntregaListFilters = {}) {
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const search = filters.search?.toLocaleLowerCase('pt-BR');
    const rows = [...this.entregas.values()].filter((row) => row.group_id === scope.groupId && row.empresa_id === scope.empresaId
      && (!search || [row.numero, row.pedido_numero, row.cliente_nome, row.cidade, row.qr_code].some((v) => String(v || '').toLocaleLowerCase('pt-BR').includes(search)))
      && (!filters.status || row.status === filters.status)
      && (!filters.pedidoId || row.pedido_id === filters.pedidoId)
      && (!filters.cidade || String(row.cidade || '').toLocaleLowerCase('pt-BR').includes(filters.cidade.toLocaleLowerCase('pt-BR')))
      && (!filters.clienteId || row.cliente_id === filters.clienteId))
      .sort((a, b) => b.numero.localeCompare(a.numero) || b.id.localeCompare(a.id));
    return { rows: rows.slice(safeOffset, safeOffset + safeLimit).map(mapEntrega), total: rows.length };
  }

  async updateEntregaRow(scope: ExpedicaoScope, id: string, patch: Partial<Entrega> & { itens?: EntregaItem[] }, _actorId: string): Promise<Entrega | null> {
    const current = await this.getEntrega(scope, id);
    if (!current) return null;
    const updated: Entrega = {
      ...current,
      ...patch,
      id: current.id,
      group_id: current.group_id,
      empresa_id: current.empresa_id,
      numero: current.numero,
      status_label: entregaStatusToLabel((patch.status as EntregaStatus) || current.status),
      itens: patch.itens ?? current.itens,
      updated_at: new Date().toISOString(),
    };
    this.entregas.set(id, updated);
    return mapEntrega(updated);
  }

  async changeEntregaStatus(
    scope: ExpedicaoScope,
    id: string,
    status: EntregaStatus,
    actorId: string,
    motivo?: string,
    idempotencyKey?: string,
  ): Promise<Entrega | null> {
    const current = await this.getEntrega(scope, id);
    if (!current) return null;
    if (idempotencyKey) {
      const hit = this.historico.find(
        (h) => h.empresa_id === scope.empresaId && h.entrega_id === id && h.idempotency_key === idempotencyKey,
      );
      if (hit) return current;
    }
    const now = new Date().toISOString();
    const updated: Entrega = {
      ...current,
      status,
      status_label: entregaStatusToLabel(status),
      ativo: status !== 'CANCELADA',
      updated_at: now,
    };
    this.entregas.set(id, updated);
    this.historico.push({
      id: randomUUID(),
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      entrega_id: id,
      status_anterior: current.status,
      status_novo: status,
      actor_id: actorId,
      motivo: motivo ?? null,
      idempotency_key: idempotencyKey ?? null,
      created_at: now,
    });
    return mapEntrega(updated);
  }

  async historyEntrega(scope: ExpedicaoScope, id: string): Promise<EntregaHistorico[]> {
    return clone(this.historico.filter((h) => h.group_id === scope.groupId && h.empresa_id === scope.empresaId && h.entrega_id === id));
  }

  async createSeparacao(scope: ExpedicaoScope, row: Omit<Separacao, 'id' | 'created_at' | 'updated_at'>, _actorId: string): Promise<Separacao> {
    const existing = await this.getSeparacaoByEntrega(scope, row.entrega_id, row.tipo);
    if (existing) return existing;
    const now = new Date().toISOString();
    const created: Separacao = { ...row, id: randomUUID(), created_at: now, updated_at: now };
    this.separacoes.set(created.id, created);
    return clone(created);
  }

  async getSeparacaoByEntrega(scope: ExpedicaoScope, entregaId: string, tipo = 'conferencia'): Promise<Separacao | null> {
    const row = [...this.separacoes.values()].find(
      (item) => item.group_id === scope.groupId && item.empresa_id === scope.empresaId
        && item.entrega_id === entregaId && item.tipo === tipo,
    );
    return row ? clone(row) : null;
  }

  async createRomaneio(scope: ExpedicaoScope, data: RomaneioCreate & { entregas_key: string }, actorId: string): Promise<Romaneio> {
    if (data.idempotency_key) {
      const byIdem = await this.getRomaneioByIdempotency(scope, data.idempotency_key);
      if (byIdem) return byIdem;
    }
    const byKey = await this.getRomaneioByEntregasKey(scope, data.entregas_key);
    if (byKey && byKey.status !== 'CANCELADO') return byKey;
    const now = new Date().toISOString();
    const sequenceKey = keyOf(scope);
    const number = this.nextRomaneio.get(sequenceKey) ?? 1;
    const row: Romaneio = {
      id: randomUUID(),
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      numero: String(number).padStart(8, '0'),
      status: 'APROVADO',
      data_romaneio: now.slice(0, 10),
      data_saida: data.despachar ? now : null,
      motorista_id: data.motorista_id ?? null,
      motorista_nome: data.motorista_nome,
      veiculo: data.veiculo,
      placa: data.placa,
      tipo_veiculo: data.tipo_veiculo || 'Caminhao',
      entregas_ids: [...data.entregas_ids],
      entregas_key: data.entregas_key || sortedEntregasKey(data.entregas_ids),
      quantidade_entregas: data.entregas_ids.length,
      instrucoes_motorista: data.instrucoes_motorista ?? null,
      checklist_saida: data.checklist_saida,
      idempotency_key: data.idempotency_key ?? null,
      ativo: true,
      created_at: now,
      updated_at: now,
    };
    void actorId;
    this.nextRomaneio.set(sequenceKey, number + 1);
    this.romaneios.set(row.id, row);
    return clone(row);
  }

  async getRomaneio(scope: ExpedicaoScope, id: string): Promise<Romaneio | null> {
    const row = this.romaneios.get(id);
    return row?.group_id === scope.groupId && row.empresa_id === scope.empresaId ? clone(row) : null;
  }

  async getRomaneioByEntregasKey(scope: ExpedicaoScope, key: string): Promise<Romaneio | null> {
    const row = [...this.romaneios.values()].find(
      (item) => item.group_id === scope.groupId && item.empresa_id === scope.empresaId && item.entregas_key === key,
    );
    return row ? clone(row) : null;
  }

  async getRomaneioByIdempotency(scope: ExpedicaoScope, key: string): Promise<Romaneio | null> {
    const row = [...this.romaneios.values()].find(
      (item) => item.group_id === scope.groupId && item.empresa_id === scope.empresaId && item.idempotency_key === key,
    );
    return row ? clone(row) : null;
  }

  async listRomaneios(scope: ExpedicaoScope, limit = 50, offset = 0) {
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const rows = [...this.romaneios.values()]
      .filter((row) => row.group_id === scope.groupId && row.empresa_id === scope.empresaId)
      .sort((a, b) => b.numero.localeCompare(a.numero) || b.id.localeCompare(a.id));
    return { rows: clone(rows.slice(safeOffset, safeOffset + safeLimit)), total: rows.length };
  }

  async updateRomaneioStatus(scope: ExpedicaoScope, id: string, status: RomaneioStatus, _actorId: string): Promise<Romaneio | null> {
    const current = await this.getRomaneio(scope, id);
    if (!current) return null;
    const updated = { ...current, status, ativo: status !== 'CANCELADO', updated_at: new Date().toISOString() };
    this.romaneios.set(id, updated);
    return clone(updated);
  }
}
