import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import {
  calculateOrcamento,
  type Orcamento,
  type OrcamentoAnexo,
  type OrcamentoAnexoCreate,
  type OrcamentoCreate,
  type OrcamentoListFilters,
  type OrcamentoOrigem,
  type OrcamentoRepository,
  type OrcamentoScope,
} from './orcamentoTypes.js';

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryOrcamentoRepository implements OrcamentoRepository {
  private rows = new Map<string, Orcamento>();
  private anexos = new Map<string, OrcamentoAnexo>();
  private next = new Map<string, number>();

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const rows = clone(this.rows);
    const anexos = clone(this.anexos);
    const next = new Map(this.next);
    try { return await fn(); }
    catch (error) { this.rows = rows; this.anexos = anexos; this.next = next; throw error; }
  }

  async create(scope: OrcamentoScope, data: OrcamentoCreate, _executor?: DbQueryExecutor): Promise<Orcamento> {
    const origem = data.origem ?? 'MANUAL';
    if (data.idempotency_key && await this.getByIdempotencyKey(scope, origem, data.idempotency_key)) {
      throw new Error('ORCAMENTO_IDEMPOTENCY_CONFLICT');
    }
    if (data.external_id && await this.getByExternalId(scope, origem, data.external_id)) {
      throw new Error('ORCAMENTO_EXTERNAL_ID_CONFLICT');
    }
    const now = new Date().toISOString();
    const id = randomUUID();
    const number = this.next.get(scope.empresaId) ?? 1;
    const totals = calculateOrcamento(data.itens);
    const row: Orcamento = {
      id,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      numero: String(number).padStart(8, '0'),
      versao: 1,
      orcamento_raiz_id: id,
      supersedido_por_id: null,
      status: 'EM_ABERTO',
      cliente_empresa_id: data.cliente_empresa_id,
      condicao_pagamento_id: data.condicao_pagamento_id,
      validade_em: data.validade_em,
      observacoes: data.observacoes ?? null,
      origem,
      canal: data.canal ?? null,
      external_id: data.external_id ?? null,
      idempotency_key: data.idempotency_key ?? null,
      campanha: data.campanha ?? null,
      desconto: totals.desconto,
      subtotal: totals.subtotal,
      total: totals.total,
      ativo: true,
      itens: totals.itens,
      created_at: now,
      updated_at: now,
    };
    this.next.set(scope.empresaId, number + 1);
    this.rows.set(id, row);
    return clone(row);
  }

  async get(scope: OrcamentoScope, id: string, _executor?: DbQueryExecutor): Promise<Orcamento | null> {
    const row = this.rows.get(id);
    return row && row.group_id === scope.groupId && row.empresa_id === scope.empresaId ? clone(row) : null;
  }

  async getByIdempotencyKey(scope: OrcamentoScope, origem: OrcamentoOrigem, idempotencyKey: string, _executor?: DbQueryExecutor): Promise<Orcamento | null> {
    const row = [...this.rows.values()].find((item) =>
      item.group_id === scope.groupId
      && item.empresa_id === scope.empresaId
      && item.origem === origem
      && item.idempotency_key === idempotencyKey);
    return row ? clone(row) : null;
  }

  async getByExternalId(scope: OrcamentoScope, origem: OrcamentoOrigem, externalId: string, _executor?: DbQueryExecutor): Promise<Orcamento | null> {
    const row = [...this.rows.values()].find((item) =>
      item.group_id === scope.groupId
      && item.empresa_id === scope.empresaId
      && item.origem === origem
      && item.external_id === externalId);
    return row ? clone(row) : null;
  }

  async list(
    scope: OrcamentoScope,
    limit = 50,
    offset = 0,
    _executor?: DbQueryExecutor,
    filters: OrcamentoListFilters = {},
  ): Promise<{ rows: Orcamento[]; total: number }> {
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const search = filters.search?.toLocaleLowerCase('pt-BR');
    const rows = [...this.rows.values()].filter((row) => row.group_id === scope.groupId && row.empresa_id === scope.empresaId
      && (!search || row.numero.toLocaleLowerCase('pt-BR').includes(search))
      && (!filters.status || row.status === filters.status)
      && (!filters.clienteEmpresaId || row.cliente_empresa_id === filters.clienteEmpresaId)
      && (!filters.validadeDe || row.validade_em >= filters.validadeDe)
      && (!filters.validadeAte || row.validade_em <= filters.validadeAte)
      && (!filters.origem || row.origem === filters.origem))
      .sort((a, b) => b.numero.localeCompare(a.numero) || b.versao - a.versao || b.id.localeCompare(a.id));
    return { rows: clone(rows.slice(safeOffset, safeOffset + safeLimit)), total: rows.length };
  }

  async listVersions(scope: OrcamentoScope, raizId: string, _executor?: DbQueryExecutor): Promise<Orcamento[]> {
    const rows = [...this.rows.values()]
      .filter((row) => row.group_id === scope.groupId && row.empresa_id === scope.empresaId && row.orcamento_raiz_id === raizId)
      .sort((a, b) => b.versao - a.versao || b.id.localeCompare(a.id));
    return clone(rows);
  }

  async update(scope: OrcamentoScope, id: string, data: OrcamentoCreate, _executor?: DbQueryExecutor): Promise<Orcamento | null> {
    const current = await this.get(scope, id);
    if (!current || current.status !== 'EM_ABERTO') return null;
    const totals = calculateOrcamento(data.itens);
    const updated: Orcamento = {
      ...current,
      cliente_empresa_id: data.cliente_empresa_id,
      condicao_pagamento_id: data.condicao_pagamento_id,
      validade_em: data.validade_em,
      observacoes: data.observacoes ?? null,
      origem: current.origem,
      canal: current.canal,
      external_id: current.external_id,
      idempotency_key: current.idempotency_key,
      campanha: current.campanha,
      itens: totals.itens,
      subtotal: totals.subtotal,
      desconto: totals.desconto,
      total: totals.total,
      updated_at: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return clone(updated);
  }

  async cancel(scope: OrcamentoScope, id: string, _executor?: DbQueryExecutor): Promise<Orcamento | null> {
    const current = await this.get(scope, id);
    if (!current || current.status !== 'EM_ABERTO') return null;
    const updated = { ...current, status: 'CANCELADO' as const, ativo: false, updated_at: new Date().toISOString() };
    this.rows.set(id, updated);
    return clone(updated);
  }

  async createVersion(
    scope: OrcamentoScope,
    sourceId: string,
    data: OrcamentoCreate,
    _executor?: DbQueryExecutor,
  ): Promise<{ previous: Orcamento; current: Orcamento }> {
    const source = await this.get(scope, sourceId);
    if (!source || source.status !== 'EM_ABERTO') throw new Error('ORCAMENTO_STATE_CONFLICT');
    const now = new Date().toISOString();
    const newId = randomUUID();
    const totals = calculateOrcamento(data.itens);
    const current: Orcamento = {
      id: newId,
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      numero: source.numero,
      versao: source.versao + 1,
      orcamento_raiz_id: source.orcamento_raiz_id,
      supersedido_por_id: null,
      status: 'EM_ABERTO',
      cliente_empresa_id: data.cliente_empresa_id,
      condicao_pagamento_id: data.condicao_pagamento_id,
      validade_em: data.validade_em,
      observacoes: data.observacoes ?? null,
      origem: source.origem,
      canal: source.canal,
      external_id: source.external_id,
      idempotency_key: null,
      campanha: source.campanha,
      subtotal: totals.subtotal,
      desconto: totals.desconto,
      total: totals.total,
      ativo: true,
      itens: totals.itens,
      created_at: now,
      updated_at: now,
    };
    const previous: Orcamento = {
      ...source,
      status: 'SUPERSEDIDO',
      supersedido_por_id: newId,
      updated_at: now,
    };
    this.rows.set(sourceId, previous);
    this.rows.set(newId, current);
    return { previous: clone(previous), current: clone(current) };
  }

  async listAnexos(scope: OrcamentoScope, orcamentoId: string, _executor?: DbQueryExecutor): Promise<OrcamentoAnexo[]> {
    const rows = [...this.anexos.values()]
      .filter((row) => row.group_id === scope.groupId && row.empresa_id === scope.empresaId && row.orcamento_id === orcamentoId && row.ativo)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    return clone(rows);
  }

  async createAnexo(
    scope: OrcamentoScope,
    orcamentoId: string,
    data: OrcamentoAnexoCreate,
    _actorId: string,
    _executor?: DbQueryExecutor,
  ): Promise<OrcamentoAnexo> {
    if (!(await this.get(scope, orcamentoId))) throw new Error('ORCAMENTO_NOT_FOUND');
    if ([...this.anexos.values()].some((row) =>
      row.group_id === scope.groupId && row.empresa_id === scope.empresaId && row.storage_key === data.storage_key)) {
      throw new Error('ORCAMENTO_ANEXO_STORAGE_KEY_CONFLICT');
    }
    const now = new Date().toISOString();
    const row: OrcamentoAnexo = {
      id: randomUUID(),
      group_id: scope.groupId,
      empresa_id: scope.empresaId,
      orcamento_id: orcamentoId,
      ...data,
      status: 'QUARENTENA',
      ativo: true,
      created_at: now,
      updated_at: now,
    };
    this.anexos.set(row.id, row);
    return clone(row);
  }

  async deactivateAnexo(
    scope: OrcamentoScope,
    orcamentoId: string,
    anexoId: string,
    _actorId: string,
    _executor?: DbQueryExecutor,
  ): Promise<OrcamentoAnexo | null> {
    const current = this.anexos.get(anexoId);
    if (!current || current.group_id !== scope.groupId || current.empresa_id !== scope.empresaId || current.orcamento_id !== orcamentoId) {
      return null;
    }
    const updated = { ...current, status: 'INATIVO' as const, ativo: false, updated_at: new Date().toISOString() };
    this.anexos.set(anexoId, updated);
    return clone(updated);
  }
}
