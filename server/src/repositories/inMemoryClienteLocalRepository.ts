import { randomUUID } from 'node:crypto';
import type { DbQueryExecutor } from '../db/client.js';
import {
  buildClienteLocalFingerprint,
  type ClienteLocal,
  type ClienteLocalCreate,
  type ClienteLocalFinalidade,
  type ClienteLocalFinalidadeInput,
  type ClienteLocalUpdate,
} from './clienteLocalTypes.js';

export type ClienteLocalScope = {
  groupId: string;
  clienteId: string;
};

export type ClienteLocalListFilter = ClienteLocalScope & {
  ativo?: boolean;
  finalidade?: string;
  principal?: boolean;
  cidade?: string;
  uf?: string;
  search?: string;
  orderBy?: 'nome' | 'cidade' | 'created_at';
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export interface ClienteLocalRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  listPage(filter: ClienteLocalListFilter): Promise<{ rows: ClienteLocal[]; total: number }>;
  get(scope: ClienteLocalScope, localId: string, executor?: DbQueryExecutor): Promise<ClienteLocal | null>;
  create(
    scope: ClienteLocalScope,
    data: ClienteLocalCreate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal>;
  update(
    scope: ClienteLocalScope,
    localId: string,
    data: ClienteLocalUpdate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null>;
  replaceFinalidades(
    scope: ClienteLocalScope,
    localId: string,
    finalidades: ClienteLocalFinalidadeInput[],
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null>;
  softDelete(
    scope: ClienteLocalScope,
    localId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null>;
  restore(
    scope: ClienteLocalScope,
    localId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null>;
}

function timestamp() {
  return new Date().toISOString();
}

export class InMemoryClienteLocalRepository implements ClienteLocalRepository {
  private readonly rows = new Map<string, ClienteLocal>();
  private readonly purposes = new Map<string, ClienteLocalFinalidade>();
  private transactionQueue: Promise<void> = Promise.resolve();

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const previous = this.transactionQueue;
    let release = () => {};
    this.transactionQueue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const rowsSnapshot = new Map(this.rows);
    const purposesSnapshot = new Map(this.purposes);
    try {
      return await fn(undefined);
    } catch (error) {
      this.rows.clear();
      rowsSnapshot.forEach((value, key) => this.rows.set(key, value));
      this.purposes.clear();
      purposesSnapshot.forEach((value, key) => this.purposes.set(key, value));
      throw error;
    } finally {
      release();
    }
  }

  async listPage(filter: ClienteLocalListFilter) {
    const ativo = typeof filter.ativo === 'boolean' ? filter.ativo : true;
    const search = String(filter.search ?? '').toLowerCase();
    let rows = [...this.rows.values()].filter((row) => {
      if (row.group_id !== filter.groupId || row.cliente_id !== filter.clienteId) return false;
      if (row.ativo !== ativo) return false;
      if (filter.cidade && row.cidade.toLowerCase() !== filter.cidade.toLowerCase()) return false;
      if (filter.uf && row.uf !== filter.uf.toUpperCase()) return false;
      const purposes = this.activePurposes(row.id);
      if (
        filter.finalidade
        && !purposes.some((purpose) => purpose.finalidade === filter.finalidade)
      ) return false;
      if (
        typeof filter.principal === 'boolean'
        && !purposes.some((purpose) => purpose.principal === filter.principal)
      ) return false;
      if (search) {
        const haystack = [
          row.nome, row.cep, row.logradouro, row.bairro, row.cidade, row.uf,
        ].join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    }).map((row) => this.withPurposes(row));

    const field = filter.orderBy ?? 'created_at';
    const direction = filter.orderDir === 'desc' ? -1 : 1;
    rows.sort((a, b) => String(
      field === 'nome' ? a.nome : field === 'cidade' ? a.cidade : a.created_at,
    ).localeCompare(String(
      field === 'nome' ? b.nome : field === 'cidade' ? b.cidade : b.created_at,
    )) * direction);
    const total = rows.length;
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    return { rows: rows.slice(offset, offset + limit), total };
  }

  async get(
    scope: ClienteLocalScope,
    localId: string,
    _executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null> {
    const row = this.rows.get(localId);
    if (!row || row.group_id !== scope.groupId || row.cliente_id !== scope.clienteId) return null;
    return this.withPurposes(row);
  }

  async create(
    scope: ClienteLocalScope,
    data: ClienteLocalCreate,
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ) {
    const fingerprint = buildClienteLocalFingerprint(scope.groupId, scope.clienteId, data);
    this.assertNoDuplicate(scope, fingerprint);
    const now = timestamp();
    const hasCoordinates = data.latitude != null && data.longitude != null;
    const row: ClienteLocal = {
      id: randomUUID(),
      group_id: scope.groupId,
      cliente_id: scope.clienteId,
      nome: data.nome,
      cep: data.cep,
      logradouro: data.logradouro,
      numero: data.numero,
      complemento: data.complemento ?? null,
      bairro: data.bairro,
      cidade: data.cidade,
      uf: data.uf,
      pais: data.pais,
      referencia: data.referencia ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      geocode_status: hasCoordinates ? 'GEOCODIFICADO' : 'NAO_GEOCODIFICADO',
      geocode_source: hasCoordinates ? data.geocode_source ?? 'MANUAL' : null,
      geocode_precision: hasCoordinates
        ? data.geocode_precision ?? 'DESCONHECIDA'
        : null,
      geocoded_at: hasCoordinates ? data.geocoded_at ?? now : null,
      endereco_incompleto: false,
      endereco_fingerprint: fingerprint,
      ativo: true,
      origem: data.origem,
      legacy_id: data.legacy_id ?? null,
      legacy_code: data.legacy_code ?? null,
      source_system: data.source_system ?? null,
      migration_batch: data.migration_batch ?? null,
      imported_at: data.imported_at ?? null,
      created_by: actorId ?? null,
      updated_by: actorId ?? null,
      created_at: now,
      updated_at: now,
      finalidades: [],
    };
    this.rows.set(row.id, row);
    await this.replaceFinalidades(scope, row.id, data.finalidades, actorId);
    return this.withPurposes(row);
  }

  async update(
    scope: ClienteLocalScope,
    localId: string,
    data: ClienteLocalUpdate,
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ) {
    const current = await this.get(scope, localId);
    if (!current) return null;
    const candidate = { ...current, ...data };
    const fingerprint = buildClienteLocalFingerprint(scope.groupId, scope.clienteId, candidate);
    this.assertNoDuplicate(scope, fingerprint, localId);
    const coordinatesChanged = data.latitude !== undefined || data.longitude !== undefined;
    const hasCoordinates = candidate.latitude != null && candidate.longitude != null;
    const next: ClienteLocal = {
      ...candidate,
      endereco_fingerprint: fingerprint,
      geocode_status: coordinatesChanged
        ? hasCoordinates ? 'GEOCODIFICADO' : 'NAO_GEOCODIFICADO'
        : current.geocode_status,
      geocode_source: coordinatesChanged
        ? hasCoordinates ? data.geocode_source ?? 'MANUAL' : null
        : candidate.geocode_source ?? null,
      geocode_precision: coordinatesChanged
        ? hasCoordinates ? data.geocode_precision ?? 'DESCONHECIDA' : null
        : candidate.geocode_precision ?? null,
      geocoded_at: coordinatesChanged
        ? hasCoordinates ? data.geocoded_at ?? timestamp() : null
        : candidate.geocoded_at ?? null,
      updated_by: actorId ?? null,
      updated_at: timestamp(),
      finalidades: current.finalidades,
    };
    this.rows.set(localId, next);
    return this.withPurposes(next);
  }

  async replaceFinalidades(
    scope: ClienteLocalScope,
    localId: string,
    finalidades: ClienteLocalFinalidadeInput[],
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ) {
    const local = await this.get(scope, localId);
    if (!local) return null;
    const requested = new Set(finalidades.map((row) => row.finalidade));
    for (const purpose of this.purposes.values()) {
      if (
        purpose.cliente_local_id === localId
        && purpose.ativo
        && !requested.has(purpose.finalidade)
      ) {
        this.purposes.set(this.purposeKey(localId, purpose.finalidade), {
          ...purpose,
          ativo: false,
          principal: false,
          updated_by: actorId ?? null,
          updated_at: timestamp(),
        });
      }
    }
    for (const input of finalidades) {
      if (input.principal) {
        for (const purpose of this.purposes.values()) {
          if (
            purpose.group_id === scope.groupId
            && purpose.cliente_id === scope.clienteId
            && purpose.finalidade === input.finalidade
            && purpose.ativo
          ) {
            this.purposes.set(this.purposeKey(purpose.cliente_local_id, purpose.finalidade), {
              ...purpose,
              principal: false,
              updated_by: actorId ?? null,
              updated_at: timestamp(),
            });
          }
        }
      }
      const key = this.purposeKey(localId, input.finalidade);
      const existing = this.purposes.get(key);
      const now = timestamp();
      this.purposes.set(key, {
        id: existing?.id ?? randomUUID(),
        group_id: scope.groupId,
        cliente_id: scope.clienteId,
        cliente_local_id: localId,
        finalidade: input.finalidade,
        principal: input.principal,
        ativo: true,
        created_by: existing?.created_by ?? actorId ?? null,
        updated_by: actorId ?? null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      });
    }
    return this.get(scope, localId);
  }

  async softDelete(
    scope: ClienteLocalScope,
    localId: string,
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ) {
    const current = await this.get(scope, localId);
    if (!current) return null;
    const next = {
      ...current,
      ativo: false,
      updated_by: actorId ?? null,
      updated_at: timestamp(),
    };
    this.rows.set(localId, next);
    return this.withPurposes(next);
  }

  async restore(
    scope: ClienteLocalScope,
    localId: string,
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ) {
    const current = await this.get(scope, localId);
    if (!current) return null;
    const next = {
      ...current,
      ativo: true,
      updated_by: actorId ?? null,
      updated_at: timestamp(),
    };
    this.rows.set(localId, next);
    return this.withPurposes(next);
  }

  private assertNoDuplicate(
    scope: ClienteLocalScope,
    fingerprint: string,
    excludeId?: string,
  ) {
    const duplicate = [...this.rows.values()].find((row) => (
      row.group_id === scope.groupId
      && row.cliente_id === scope.clienteId
      && row.endereco_fingerprint === fingerprint
      && row.id !== excludeId
      && row.ativo
    ));
    if (duplicate) throw new Error(`POSSIBLE_DUPLICATE:${duplicate.id}`);
  }

  private activePurposes(localId: string) {
    return [...this.purposes.values()].filter(
      (purpose) => purpose.cliente_local_id === localId && purpose.ativo,
    );
  }

  private withPurposes(row: ClienteLocal): ClienteLocal {
    return { ...row, finalidades: this.activePurposes(row.id) };
  }

  private purposeKey(localId: string, finalidade: string) {
    return `${localId}:${finalidade}`;
  }
}
