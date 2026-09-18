import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import {
  normalizeObraNome,
  type Obra,
  type ObraCreate,
  type ObraEmpresa,
  type ObraLocal,
  type ObraLocalInput,
  type ObraUpdate,
} from './obraTypes.js';

export type ObraScope = { groupId: string; clienteId: string; empresaId?: string | null };

export type ObraListFilter = ObraScope & {
  ativo?: boolean;
  status?: string;
  operacional?: boolean;
  search?: string;
  cidade?: string;
  uf?: string;
  orderBy?: 'nome' | 'codigo' | 'created_at';
  orderDir?: 'asc' | 'desc';
  limit: number;
  offset: number;
};

export interface ObraRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  listPage(filter: ObraListFilter, executor?: DbQueryExecutor): Promise<{ rows: Obra[]; total: number }>;
  get(scope: ObraScope, obraId: string, executor?: DbQueryExecutor): Promise<Obra | null>;
  create(
    scope: ObraScope,
    data: ObraCreate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra>;
  update(
    scope: ObraScope,
    obraId: string,
    data: ObraUpdate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  softDelete(
    scope: ObraScope,
    obraId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  restore(
    scope: ObraScope,
    obraId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  lock(scope: ObraScope, obraId: string, executor?: DbQueryExecutor): Promise<void>;
  linkEmpresa(
    scope: ObraScope,
    obraId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra>;
  unlinkEmpresa(
    scope: ObraScope,
    obraId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  restoreEmpresa(
    scope: ObraScope,
    obraId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra>;
  linkLocal(
    scope: ObraScope,
    obraId: string,
    input: ObraLocalInput,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra>;
  unlinkLocal(
    scope: ObraScope,
    obraId: string,
    localId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  restoreLocal(
    scope: ObraScope,
    obraId: string,
    localId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  setPrincipal(
    scope: ObraScope,
    obraId: string,
    localId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  findPossibleDuplicate(
    scope: ObraScope,
    nome: string,
    principalLocalId: string,
    excludeObraId?: string,
    executor?: DbQueryExecutor,
  ): Promise<Obra | null>;
  findActiveObraUsingLocal(
    groupId: string,
    localId: string,
    executor?: DbQueryExecutor,
  ): Promise<{ obraId: string; principal: boolean } | null>;
}

function nowIso() {
  return new Date().toISOString();
}

function stamp(
  actorId: string | null | undefined,
  existing?: { created_by: string | null; created_at: string },
) {
  const ts = nowIso();
  return {
    created_by: existing?.created_by ?? actorId ?? null,
    updated_by: actorId ?? null,
    created_at: existing?.created_at ?? ts,
    updated_at: ts,
  };
}

export class InMemoryObraRepository implements ObraRepository {
  private obras = new Map<string, Obra>();
  private sequences = new Map<string, number>();
  private locais = new Map<string, {
    id: string;
    group_id: string;
    cliente_id: string;
    nome: string;
    cidade: string;
    uf: string;
    ativo: boolean;
  }>();
  private clienteEmpresas = new Set<string>();

  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const obras = new Map(this.obras);
    const sequences = new Map(this.sequences);
    return Promise.resolve(fn(undefined)).catch((error) => {
      this.obras = obras;
      this.sequences = sequences;
      throw error;
    });
  }

  seedLocal(local: {
    id: string; group_id: string; cliente_id: string; nome: string; cidade: string; uf: string; ativo?: boolean;
  }) {
    this.locais.set(local.id, { ...local, ativo: local.ativo !== false });
  }

  seedClienteEmpresa(groupId: string, clienteId: string, empresaId: string) {
    this.clienteEmpresas.add(`${groupId}:${clienteId}:${empresaId}`);
  }

  async listPage(filter: ObraListFilter) {
    let rows = [...this.obras.values()].filter((obra) => (
      obra.group_id === filter.groupId
      && obra.cliente_id === filter.clienteId
    ));
    const ativo = typeof filter.ativo === 'boolean' ? filter.ativo : true;
    rows = rows.filter((obra) => obra.ativo === ativo);
    if (filter.status) rows = rows.filter((obra) => obra.status === filter.status);
    if (filter.operacional) {
      rows = rows.filter((obra) => (
        obra.ativo
        && obra.status === 'ATIVA'
        && obra.locais.some((row) => row.principal && row.ativo)
      ));
    }
    if (filter.empresaId) {
      rows = rows.filter((obra) => obra.empresas.some(
        (row) => row.empresa_id === filter.empresaId && row.ativo,
      ));
    }
    if (filter.search) {
      const search = filter.search.toLowerCase();
      rows = rows.filter((obra) => (
        obra.nome.toLowerCase().includes(search) || obra.codigo.includes(search)
      ));
    }
    if (filter.cidade || filter.uf) {
      rows = rows.filter((obra) => {
        const principal = obra.locais.find((row) => row.principal && row.ativo);
        if (!principal) return false;
        if (filter.cidade && (principal.cidade ?? '').toLowerCase() !== filter.cidade.toLowerCase()) {
          return false;
        }
        if (filter.uf && (principal.uf ?? '').toUpperCase() !== filter.uf.toUpperCase()) return false;
        return true;
      });
    }
    const dir = filter.orderDir === 'desc' ? -1 : 1;
    const key = filter.orderBy ?? 'created_at';
    rows.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * dir);
    return { rows: rows.slice(filter.offset, filter.offset + filter.limit), total: rows.length };
  }

  async get(scope: ObraScope, obraId: string) {
    const obra = this.obras.get(obraId);
    if (!obra || obra.group_id !== scope.groupId || obra.cliente_id !== scope.clienteId) return null;
    if (scope.empresaId && !obra.empresas.some((row) => row.empresa_id === scope.empresaId && row.ativo)) {
      return null;
    }
    return structuredClone(obra);
  }

  async lock() {}

  async create(scope: ObraScope, data: ObraCreate, actorId: string | null | undefined) {
    if (!scope.empresaId) throw new Error('EMPRESA_ID_REQUIRED');
    const principal = data.locais.find((row) => row.principal);
    if (!principal) throw new Error('PRINCIPAL_REQUIRED');
    this.assertEmpresa(scope, scope.empresaId);
    data.locais.forEach((row) => this.assertLocal(scope, row.cliente_local_id));
    const next = (this.sequences.get(scope.groupId) ?? 0) + 1;
    this.sequences.set(scope.groupId, next);
    const id = randomUUID();
    const times = stamp(actorId);
    const obra: Obra = {
      id,
      group_id: scope.groupId,
      cliente_id: scope.clienteId,
      codigo: String(next).padStart(6, '0'),
      nome: data.nome,
      status: 'ATIVA',
      observacao: data.observacao ?? null,
      ativo: true,
      origem: data.origem ?? 'ERP',
      legacy_id: data.legacy_id ?? null,
      legacy_code: data.legacy_code ?? null,
      source_system: data.source_system ?? null,
      migration_batch: data.migration_batch ?? null,
      imported_at: data.imported_at ?? null,
      ...times,
      empresas: [this.empresaRow(scope, id, scope.empresaId, actorId)],
      locais: data.locais.map((row) => this.localRow(scope, id, row, actorId)),
    };
    this.obras.set(id, obra);
    return structuredClone(obra);
  }

  async update(scope: ObraScope, obraId: string, data: ObraUpdate, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    Object.assign(current, data, stamp(actorId, current));
    return structuredClone(current);
  }

  async softDelete(scope: ObraScope, obraId: string, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    current.ativo = false;
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async restore(scope: ObraScope, obraId: string, actorId: string | null | undefined) {
    const current = this.obras.get(obraId);
    if (!current || current.group_id !== scope.groupId || current.cliente_id !== scope.clienteId) {
      return null;
    }
    current.ativo = true;
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async linkEmpresa(scope: ObraScope, obraId: string, empresaId: string, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    this.assertEmpresa(scope, empresaId);
    const existing = current.empresas.find((row) => row.empresa_id === empresaId);
    if (existing) {
      existing.ativo = true;
      existing.updated_by = actorId ?? null;
      existing.updated_at = nowIso();
    } else {
      current.empresas.push(this.empresaRow(scope, obraId, empresaId, actorId));
    }
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async unlinkEmpresa(scope: ObraScope, obraId: string, empresaId: string, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    const existing = current.empresas.find((row) => row.empresa_id === empresaId && row.ativo);
    if (!existing) return null;
    existing.ativo = false;
    existing.updated_by = actorId ?? null;
    existing.updated_at = nowIso();
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async restoreEmpresa(scope: ObraScope, obraId: string, empresaId: string, actorId: string | null | undefined) {
    return this.linkEmpresa(scope, obraId, empresaId, actorId);
  }

  async linkLocal(scope: ObraScope, obraId: string, input: ObraLocalInput, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    this.assertLocal(scope, input.cliente_local_id);
    if (input.principal) {
      current.locais.forEach((row) => {
        if (row.principal) row.principal = false;
      });
    }
    const existing = current.locais.find((row) => (
      row.cliente_local_id === input.cliente_local_id && row.uso_na_obra === input.uso_na_obra
    ));
    if (existing) {
      existing.ativo = true;
      existing.principal = Boolean(input.principal);
      existing.updated_by = actorId ?? null;
      existing.updated_at = nowIso();
    } else {
      current.locais.push(this.localRow(scope, obraId, input, actorId));
    }
    this.assertSinglePrincipal(current);
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async unlinkLocal(scope: ObraScope, obraId: string, localId: string, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    const existing = current.locais.find((row) => row.cliente_local_id === localId && row.ativo);
    if (!existing) return null;
    if (existing.principal && current.ativo) {
      throw new Error('PRINCIPAL_REQUIRED');
    }
    existing.ativo = false;
    existing.principal = false;
    existing.updated_by = actorId ?? null;
    existing.updated_at = nowIso();
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async restoreLocal(scope: ObraScope, obraId: string, localId: string, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    const existing = current.locais.find((row) => row.cliente_local_id === localId);
    if (!existing) return null;
    existing.ativo = true;
    existing.updated_by = actorId ?? null;
    existing.updated_at = nowIso();
    this.assertSinglePrincipal(current);
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async setPrincipal(scope: ObraScope, obraId: string, localId: string, actorId: string | null | undefined) {
    const current = await this.require(scope, obraId);
    const next = current.locais.find((row) => row.cliente_local_id === localId && row.ativo);
    if (!next) return null;
    current.locais.forEach((row) => {
      row.principal = row === next;
    });
    Object.assign(current, stamp(actorId, current));
    return structuredClone(current);
  }

  async findPossibleDuplicate(
    scope: ObraScope,
    nome: string,
    principalLocalId: string,
    excludeObraId?: string,
  ) {
    const normalized = normalizeObraNome(nome);
    return [...this.obras.values()].find((obra) => (
      obra.group_id === scope.groupId
      && obra.cliente_id === scope.clienteId
      && obra.ativo
      && obra.id !== excludeObraId
      && normalizeObraNome(obra.nome) === normalized
      && obra.locais.some((row) => row.principal && row.ativo && row.cliente_local_id === principalLocalId)
    )) ?? null;
  }

  async findActiveObraUsingLocal(groupId: string, localId: string) {
    for (const obra of this.obras.values()) {
      if (obra.group_id !== groupId || !obra.ativo) continue;
      const link = obra.locais.find((row) => row.cliente_local_id === localId && row.ativo);
      if (link) return { obraId: obra.id, principal: link.principal };
    }
    return null;
  }

  private async require(scope: ObraScope, obraId: string) {
    const obra = this.obras.get(obraId);
    if (!obra || obra.group_id !== scope.groupId || obra.cliente_id !== scope.clienteId || !obra.ativo) {
      throw new Error('OBRA_NOT_FOUND');
    }
    return obra;
  }

  private assertEmpresa(scope: ObraScope, empresaId: string) {
    if (!this.clienteEmpresas.has(`${scope.groupId}:${scope.clienteId}:${empresaId}`)) {
      throw new Error('CLIENTE_EMPRESA_REQUIRED');
    }
  }

  private assertLocal(scope: ObraScope, localId: string) {
    const local = this.locais.get(localId);
    if (!local || local.group_id !== scope.groupId || local.cliente_id !== scope.clienteId || !local.ativo) {
      throw new Error('TENANT_FK_MISMATCH');
    }
  }

  private assertSinglePrincipal(obra: Obra) {
    const count = obra.locais.filter((row) => row.principal && row.ativo).length;
    if (obra.ativo && count !== 1) throw new Error('PRINCIPAL_REQUIRED');
  }

  private empresaRow(
    scope: ObraScope,
    obraId: string,
    empresaId: string,
    actorId: string | null | undefined,
  ): ObraEmpresa {
    return {
      id: randomUUID(),
      group_id: scope.groupId,
      obra_id: obraId,
      empresa_id: empresaId,
      ativo: true,
      ...stamp(actorId),
    };
  }

  private localRow(
    scope: ObraScope,
    obraId: string,
    input: ObraLocalInput,
    actorId: string | null | undefined,
  ): ObraLocal {
    const local = this.locais.get(input.cliente_local_id);
    return {
      id: randomUUID(),
      group_id: scope.groupId,
      obra_id: obraId,
      cliente_local_id: input.cliente_local_id,
      uso_na_obra: input.uso_na_obra,
      principal: Boolean(input.principal),
      ativo: true,
      nome_local: local?.nome ?? null,
      cidade: local?.cidade ?? null,
      uf: local?.uf ?? null,
      ...stamp(actorId),
    };
  }
}
