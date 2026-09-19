import { randomUUID } from 'node:crypto';
import type { ListOptions, Scope, TenantEntityRepository } from '../services/tenantCrudService.js';
import { normalizeDocumento } from '../db/documentoValidators.js';
import type { DbQueryExecutor } from '../db/client.js';
import type {
  Cliente,
  ClienteCreate,
  ClienteEmpresa,
  ClienteEmpresaCreate,
  ClienteEmpresaUpdate,
  ClienteUpdate,
} from './clienteTypes.js';

function nowIso() { return new Date().toISOString(); }

export type ClienteListFilter = Scope & ListOptions & {
  offset?: number;
  codigo?: string;
  documento?: string;
  orderBy?: 'codigo' | 'nome';
  orderDir?: 'asc' | 'desc';
};

export type ClienteEmpresaListFilter = Scope & ListOptions & {
  clienteId: string;
  empresaId?: string;
  situacaoComercial?: string;
  bloqueado?: boolean;
  offset?: number;
  orderBy?: 'empresa' | 'situacao' | 'created_at';
  orderDir?: 'asc' | 'desc';
};

export interface ClienteRepository extends TenantEntityRepository<Cliente, ClienteCreate, ClienteUpdate> {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  create(
    scope: Scope,
    data: ClienteCreate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<Cliente>;
  listPage(filter: ClienteListFilter): Promise<{ rows: Cliente[]; total: number }>;
  findByDocumento(groupId: string, documentoNormalizado: string): Promise<Cliente | null>;
  restore(scope: Scope, id: string): Promise<Cliente | null>;
  listEmpresaLinks(filter: ClienteEmpresaListFilter): Promise<{ rows: ClienteEmpresa[]; total: number }>;
  getEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null>;
  createEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    data: ClienteEmpresaCreate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<{ row: ClienteEmpresa; created: boolean }>;
  updateEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    data: ClienteEmpresaUpdate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null>;
  setEmpresaLinkBlocked(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    blocked: boolean,
    actorId?: string | null,
    motivo?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null>;
  softDeleteEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null>;
  restoreEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null>;
}

function displayName(data: ClienteCreate | Cliente): string | null {
  if ('tipo' in data && data.tipo === 'Pessoa Jurídica') {
    return (data as ClienteCreate).razao_social || (data as Cliente).nome_fantasia || (data as Cliente).nome || null;
  }
  return (data as ClienteCreate).nome || (data as Cliente).razao_social || null;
}

function buildCliente(
  scope: Scope,
  data: ClienteCreate,
  id: string,
  codigo: string,
  ts: string,
  actors: { createdBy?: string | null; updatedBy?: string | null },
): Cliente {
  const raw = data.documento ?? data.cpf_cnpj ?? '';
  const docNorm = normalizeDocumento(raw) || null;
  return {
    id,
    group_id: scope.groupId,
    empresa_id: data.empresa_id ?? scope.empresaId ?? null,
    codigo,
    tipo: data.tipo,
    documento: raw ? String(raw).trim() : docNorm,
    documento_normalizado: docNorm,
    nome: data.nome ?? (data.tipo === 'Pessoa Física' ? displayName(data) : null),
    razao_social: data.razao_social ?? null,
    nome_fantasia: data.nome_fantasia ?? null,
    nome_social: data.nome_social ?? null,
    inscricao_estadual: data.inscricao_estadual ?? null,
    inscricao_municipal: data.inscricao_municipal ?? null,
    email: data.email ?? null,
    telefone: data.telefone ?? null,
    celular: data.celular ?? null,
    status: data.status ?? 'Ativo',
    origem: data.origem ?? 'ERP',
    codigo_legado: data.codigo_legado ?? null,
    legacy_id: data.legacy_id ?? null,
    source_system: data.source_system ?? null,
    migration_batch: data.migration_batch ?? null,
    observacoes: data.observacoes ?? null,
    ativo: data.ativo ?? true,
    created_by: actors.createdBy ?? null,
    updated_by: actors.updatedBy ?? null,
    created_at: ts,
    updated_at: ts,
  };
}

export class InMemoryClienteRepository implements ClienteRepository {
  private readonly rows = new Map<string, Cliente>();
  private readonly sequences = new Map<string, number>();
  private readonly empresaLinks = new Map<string, ClienteEmpresa>();

  async withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    const rowsSnapshot = new Map(this.rows);
    const sequencesSnapshot = new Map(this.sequences);
    const linksSnapshot = new Map(this.empresaLinks);
    try {
      return await fn(undefined);
    } catch (error) {
      this.rows.clear();
      rowsSnapshot.forEach((value, key) => this.rows.set(key, value));
      this.sequences.clear();
      sequencesSnapshot.forEach((value, key) => this.sequences.set(key, value));
      this.empresaLinks.clear();
      linksSnapshot.forEach((value, key) => this.empresaLinks.set(key, value));
      throw error;
    }
  }

  seed(rows: Cliente[]) {
    for (const row of rows) this.rows.set(row.id, row);
  }

  private nextCodigo(groupId: string): string {
    const key = `${groupId}:Cliente`;
    const next = (this.sequences.get(key) ?? 1);
    this.sequences.set(key, next + 1);
    return String(next).padStart(6, '0');
  }

  private matches(filter: ClienteListFilter, r: Cliente): boolean {
    if (r.group_id !== filter.groupId) return false;
    if (filter.empresaId && r.empresa_id && r.empresa_id !== filter.empresaId) {
      // identidade no grupo: listagem por empresa ainda vê clientes do grupo;
      // filtro empresa restringe apenas quando solicitado e cliente tem empresa preferencial
      // Para isolamento de listagem operacional: se empresaId no scope, não bloquear identidade do grupo
    }
    const ativoFilter = typeof filter.ativo === 'boolean' ? filter.ativo : true;
    if (r.ativo !== ativoFilter) return false;
    if (filter.codigo && String(r.codigo) !== filter.codigo) return false;
    if (filter.documento) {
      const d = normalizeDocumento(filter.documento);
      if (r.documento_normalizado !== d) return false;
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const docQ = normalizeDocumento(filter.search);
      const hay = `${r.codigo} ${r.nome || ''} ${r.razao_social || ''} ${r.nome_fantasia || ''} ${r.email || ''} ${r.telefone || ''} ${r.celular || ''} ${r.documento_normalizado || ''}`.toLowerCase();
      if (!hay.includes(q) && !(docQ && r.documento_normalizado?.includes(docQ))) return false;
    }
    return true;
  }

  async list(filter: Scope & ListOptions): Promise<Cliente[]> {
    const page = await this.listPage({ ...filter, offset: 0 });
    return page.rows;
  }

  async listPage(filter: ClienteListFilter): Promise<{ rows: Cliente[]; total: number }> {
    let all = [...this.rows.values()].filter((r) => this.matches(filter, r));
    const orderBy = filter.orderBy ?? 'codigo';
    const dir = filter.orderDir === 'desc' ? -1 : 1;
    all.sort((a, b) => {
      if (orderBy === 'nome') {
        const an = (a.nome || a.razao_social || '').toLowerCase();
        const bn = (b.nome || b.razao_social || '').toLowerCase();
        return an < bn ? -1 * dir : an > bn ? 1 * dir : 0;
      }
      const an = Number(a.codigo.replace(/\D/g, '')) || 0;
      const bn = Number(b.codigo.replace(/\D/g, '')) || 0;
      return (an - bn) * dir;
    });
    const total = all.length;
    const offset = Math.max(filter.offset ?? 0, 0);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    return { rows: all.slice(offset, offset + limit), total };
  }

  async getById(scope: Scope, id: string): Promise<Cliente | null> {
    const row = this.rows.get(id);
    if (!row || row.group_id !== scope.groupId) return null;
    return row;
  }

  async findByDocumento(groupId: string, documentoNormalizado: string): Promise<Cliente | null> {
    return [...this.rows.values()].find(
      (r) => r.group_id === groupId && r.documento_normalizado === documentoNormalizado,
    ) ?? null;
  }

  async create(
    scope: Scope,
    data: ClienteCreate,
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ): Promise<Cliente> {
    const doc = normalizeDocumento(data.documento ?? data.cpf_cnpj ?? '');
    if (doc) {
      const dup = await this.findByDocumento(scope.groupId, doc);
      if (dup) throw new Error('unique constraint clientes documento');
    }
    const ts = nowIso();
    const codigo = this.nextCodigo(scope.groupId);
    const row = buildCliente(scope, data, randomUUID(), codigo, ts, {
      createdBy: actorId,
      updatedBy: actorId,
    });
    this.rows.set(row.id, row);
    if (row.empresa_id) {
      const link = this.buildEmpresaLink(
        scope,
        row.id,
        row.empresa_id,
        {},
        actorId,
      );
      this.empresaLinks.set(this.empresaLinkKey(row.id, row.empresa_id), link);
    }
    return row;
  }

  async update(scope: Scope, id: string, data: ClienteUpdate): Promise<Cliente | null> {
    const current = await this.getById(scope, id);
    if (!current) return null;
    if (data.documento !== undefined || data.cpf_cnpj !== undefined) {
      const raw = data.documento ?? data.cpf_cnpj ?? '';
      const doc = normalizeDocumento(raw);
      if (doc) {
        const dup = await this.findByDocumento(scope.groupId, doc);
        if (dup && dup.id !== id) throw new Error('unique constraint clientes documento');
      }
    }
    const next: Cliente = {
      ...current,
      ...Object.fromEntries(
        Object.entries(data).filter(([k]) => k !== 'cpf_cnpj' && k !== 'documento'),
      ),
      updated_at: nowIso(),
    } as Cliente;
    if (data.documento !== undefined || data.cpf_cnpj !== undefined) {
      const raw = data.documento ?? data.cpf_cnpj ?? '';
      const doc = normalizeDocumento(raw);
      next.documento = raw ? String(raw).trim() : doc;
      next.documento_normalizado = doc || null;
    }
    this.rows.set(id, next);
    return next;
  }

  softDelete(scope: Scope, id: string) {
    return this.update(scope, id, { ativo: false, status: 'Inativo' });
  }

  restore(scope: Scope, id: string) {
    return this.update(scope, id, { ativo: true, status: 'Ativo' });
  }

  async listEmpresaLinks(
    filter: ClienteEmpresaListFilter,
  ): Promise<{ rows: ClienteEmpresa[]; total: number }> {
    const ativo = typeof filter.ativo === 'boolean' ? filter.ativo : true;
    const q = String(filter.search ?? '').trim().toLowerCase();
    let rows = [...this.empresaLinks.values()].filter((row) => (
      row.group_id === filter.groupId
      && row.cliente_id === filter.clienteId
      && row.ativo === ativo
      && (!filter.empresaId || row.empresa_id === filter.empresaId)
      && (!filter.situacaoComercial || row.situacao_comercial === filter.situacaoComercial)
      && (typeof filter.bloqueado !== 'boolean' || row.bloqueado === filter.bloqueado)
      && (!q || [
        row.empresa_id,
        row.situacao_comercial,
        row.observacao_comercial,
        row.legacy_id,
        row.legacy_code,
        row.source_system,
      ].some((value) => String(value ?? '').toLowerCase().includes(q)))
    ));
    const direction = filter.orderDir === 'desc' ? -1 : 1;
    const field = filter.orderBy ?? 'created_at';
    rows.sort((a, b) => String(
      field === 'empresa' ? a.empresa_id : field === 'situacao'
        ? a.situacao_comercial : a.created_at,
    ).localeCompare(String(
      field === 'empresa' ? b.empresa_id : field === 'situacao'
        ? b.situacao_comercial : b.created_at,
    )) * direction);
    const total = rows.length;
    const offset = Math.max(filter.offset ?? 0, 0);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    return { rows: rows.slice(offset, offset + limit), total };
  }

  async getEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    _executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const row = this.empresaLinks.get(this.empresaLinkKey(clienteId, empresaId));
    return row?.group_id === scope.groupId ? row : null;
  }

  async createEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    data: ClienteEmpresaCreate,
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ): Promise<{ row: ClienteEmpresa; created: boolean }> {
    const key = this.empresaLinkKey(clienteId, empresaId);
    const existing = this.empresaLinks.get(key);
    if (existing) return { row: existing, created: false };
    const row = this.buildEmpresaLink(scope, clienteId, empresaId, data, actorId);
    this.empresaLinks.set(key, row);
    return { row, created: true };
  }

  async updateEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    data: ClienteEmpresaUpdate,
    actorId?: string | null,
    _executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const current = await this.getEmpresaLink(scope, clienteId, empresaId);
    if (!current) return null;
    const next = this.withEligibility({
      ...current,
      ...data,
      updated_by: actorId ?? null,
      updated_at: nowIso(),
    });
    this.empresaLinks.set(this.empresaLinkKey(clienteId, empresaId), next);
    return next;
  }

  async setEmpresaLinkBlocked(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    blocked: boolean,
    actorId?: string | null,
    motivo?: string | null,
    _executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const current = await this.getEmpresaLink(scope, clienteId, empresaId);
    if (!current) return null;
    const next = this.withEligibility({
      ...current,
      bloqueado: blocked,
      motivo_bloqueio: blocked ? motivo ?? null : null,
      bloqueado_em: blocked ? nowIso() : null,
      bloqueado_por: blocked ? actorId ?? null : null,
      updated_by: actorId ?? null,
      updated_at: nowIso(),
    });
    this.empresaLinks.set(this.empresaLinkKey(clienteId, empresaId), next);
    return next;
  }

  softDeleteEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ) {
    return this.updateEmpresaLink(
      scope,
      clienteId,
      empresaId,
      { ativo: false, situacao_comercial: 'INATIVO', habilitado_operacao: false } as never,
      actorId,
      executor,
    );
  }

  restoreEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ) {
    return this.updateEmpresaLink(
      scope,
      clienteId,
      empresaId,
      { ativo: true, situacao_comercial: 'ATIVO', habilitado_operacao: true } as never,
      actorId,
      executor,
    );
  }

  private empresaLinkKey(clienteId: string, empresaId: string) {
    return `${clienteId}:${empresaId}`;
  }

  private withEligibility(row: Omit<ClienteEmpresa, 'elegivel_operacao'>): ClienteEmpresa {
    return {
      ...row,
      elegivel_operacao: row.ativo
        && row.situacao_comercial === 'ATIVO'
        && row.habilitado_operacao
        && !row.bloqueado,
    };
  }

  private buildEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    data: Partial<ClienteEmpresaCreate>,
    actorId?: string | null,
  ): ClienteEmpresa {
    const timestamp = nowIso();
    return this.withEligibility({
      id: randomUUID(),
      group_id: scope.groupId,
      cliente_id: clienteId,
      empresa_id: empresaId,
      ativo: true,
      situacao_comercial: data.situacao_comercial ?? 'ATIVO',
      habilitado_operacao: data.habilitado_operacao ?? true,
      bloqueado: false,
      motivo_bloqueio: null,
      bloqueado_em: null,
      bloqueado_por: null,
      observacao_comercial: data.observacao_comercial ?? null,
      tabela_preco_id: data.tabela_preco_id ?? null,
      origem: data.origem ?? 'ERP',
      legacy_id: data.legacy_id ?? null,
      legacy_code: data.legacy_code ?? null,
      source_system: data.source_system ?? null,
      migration_batch: data.migration_batch ?? null,
      imported_at: data.imported_at ?? null,
      created_by: actorId ?? null,
      updated_by: actorId ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
}

export function createInMemoryClienteRepo() {
  return new InMemoryClienteRepository();
}
