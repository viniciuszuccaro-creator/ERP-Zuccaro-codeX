import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import { calculatePedido, type Pedido, type PedidoCreate, type PedidoHistorico, type PedidoListFilters, type PedidoRepository, type PedidoScope, type PedidoStatus } from './pedidoTypes.js';

const clone = <T>(value: T): T => structuredClone(value);
const key = (scope: PedidoScope) => `${scope.groupId}:${scope.empresaId}`;

export class InMemoryPedidoRepository implements PedidoRepository {
  private rows = new Map<string, Pedido>();
  private events: PedidoHistorico[] = [];
  private next = new Map<string, number>();
  private idempotency = new Map<string, { id: string; fingerprint: string }>();
  private transactionTail: Promise<void> = Promise.resolve();

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    let release!: () => void;
    const turn = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.transactionTail;
    this.transactionTail = turn;
    await previous;
    const rows = clone(this.rows);
    const events = clone(this.events);
    const next = new Map(this.next);
    const idempotency = new Map(this.idempotency);
    try { return await fn(); }
    catch (error) { this.rows = rows; this.events = events; this.next = next; this.idempotency = idempotency; throw error; }
    finally { release(); }
  }

  async lockIdempotency(_scope: PedidoScope, _key: string, _executor?: DbQueryExecutor): Promise<void> {
    // withTransaction serializa a fixture inteira como o advisory lock da implementação PostgreSQL.
  }

  async getByIdempotencyKey(scope: PedidoScope, value: string, _executor?: DbQueryExecutor) {
    const indexed = this.idempotency.get(`${key(scope)}:${value}`);
    const row = indexed && this.rows.get(indexed.id);
    return row ? { row: clone(row), fingerprint: indexed.fingerprint } : null;
  }

  async create(scope: PedidoScope, data: PedidoCreate, actorId: string, _executor?: DbQueryExecutor, fingerprint?: string): Promise<Pedido> {
    if (data.orcamento_id && await this.getByOrcamento(scope, data.orcamento_id)) throw new Error('PEDIDO_ORCAMENTO_ALREADY_CONVERTED');
    const now = new Date().toISOString();
    const sequenceKey = key(scope);
    const number = this.next.get(sequenceKey) ?? 1;
    const totals = calculatePedido(data.itens);
    const row: Pedido = {
      id: randomUUID(), group_id: scope.groupId, empresa_id: scope.empresaId,
      numero: String(number).padStart(8, '0'), status: 'EM_ABERTO',
      cliente_empresa_id: data.cliente_empresa_id, cliente_local_id: data.cliente_local_id ?? null,
      obra_id: data.obra_id ?? null, tabela_preco_id: data.tabela_preco_id ?? null,
      condicao_pagamento_id: data.condicao_pagamento_id, orcamento_id: data.orcamento_id ?? null,
      vendedor_id: actorId, tipo_operacao: data.tipo_operacao,
      data_entrega_solicitada: data.data_entrega_solicitada, observacoes: data.observacoes ?? null,
      subtotal: totals.subtotal, desconto: totals.desconto, total: totals.total,
      ativo: true, itens: totals.itens, created_at: now, updated_at: now,
    };
    this.next.set(sequenceKey, number + 1);
    this.rows.set(row.id, row);
    if (data.idempotency_key) {
      if (!fingerprint) throw new Error('PEDIDO_IDEMPOTENCY_FINGERPRINT_REQUIRED');
      const scopedKey = `${key(scope)}:${data.idempotency_key}`;
      if (this.idempotency.has(scopedKey)) throw new Error('PEDIDO_IDEMPOTENCY_DUPLICATE');
      this.idempotency.set(scopedKey, { id: row.id, fingerprint });
    }
    this.events.push({ id: randomUUID(), group_id: scope.groupId, empresa_id: scope.empresaId, pedido_id: row.id, status_anterior: null, status_novo: 'EM_ABERTO', actor_id: actorId, motivo: null, created_at: now });
    return clone(row);
  }

  async get(scope: PedidoScope, id: string, _executor?: DbQueryExecutor, _lock=false): Promise<Pedido | null> {
    const row = this.rows.get(id);
    return row?.group_id === scope.groupId && row.empresa_id === scope.empresaId ? clone(row) : null;
  }

  async getByOrcamento(scope: PedidoScope, orcamentoId: string, _executor?: DbQueryExecutor): Promise<Pedido | null> {
    const row = [...this.rows.values()].find((item) => item.group_id === scope.groupId && item.empresa_id === scope.empresaId && item.orcamento_id === orcamentoId);
    return row ? clone(row) : null;
  }

  async list(scope: PedidoScope, limit = 50, offset = 0, _executor?: DbQueryExecutor, filters: PedidoListFilters = {}): Promise<{ rows: Pedido[]; total: number }> {
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const search = filters.search?.toLocaleLowerCase('pt-BR');
    const rows = [...this.rows.values()].filter((row) => row.group_id === scope.groupId && row.empresa_id === scope.empresaId
      && (!search || row.numero.toLocaleLowerCase('pt-BR').includes(search))
      && (!filters.status || row.status === filters.status)
      && (!filters.clienteEmpresaId || row.cliente_empresa_id === filters.clienteEmpresaId)
      && (!filters.tipoOperacao || row.tipo_operacao === filters.tipoOperacao))
      .sort((a, b) => b.numero.localeCompare(a.numero) || b.id.localeCompare(a.id));
    return { rows: clone(rows.slice(safeOffset, safeOffset + safeLimit)), total: rows.length };
  }

  async update(scope: PedidoScope, id: string, data: PedidoCreate, _actorId: string, _executor?: DbQueryExecutor): Promise<Pedido | null> {
    const current = await this.get(scope, id);
    if (!current || current.status !== 'EM_ABERTO') return null;
    const totals = calculatePedido(data.itens);
    const updated: Pedido = { ...current, ...data, cliente_local_id: data.cliente_local_id ?? null, obra_id: data.obra_id ?? null, tabela_preco_id: data.tabela_preco_id ?? null, orcamento_id: current.orcamento_id, observacoes: data.observacoes ?? null, ...totals, updated_at: new Date().toISOString() };
    this.rows.set(id, updated);
    return clone(updated);
  }

  async changeStatus(scope: PedidoScope, id: string, status: PedidoStatus, actorId: string, motivo?: string, _executor?: DbQueryExecutor): Promise<Pedido | null> {
    const current = await this.get(scope, id);
    if (!current) return null;
    const now = new Date().toISOString();
    const updated = { ...current, status, ativo: status !== 'CANCELADO', updated_at: now };
    this.rows.set(id, updated);
    this.events.push({ id: randomUUID(), group_id: scope.groupId, empresa_id: scope.empresaId, pedido_id: id, status_anterior: current.status, status_novo: status, actor_id: actorId, motivo: motivo ?? null, created_at: now });
    return clone(updated);
  }

  async history(scope: PedidoScope, id: string, _executor?: DbQueryExecutor): Promise<PedidoHistorico[]> {
    return clone(this.events.filter((event) => event.group_id === scope.groupId && event.empresa_id === scope.empresaId && event.pedido_id === id));
  }
}
