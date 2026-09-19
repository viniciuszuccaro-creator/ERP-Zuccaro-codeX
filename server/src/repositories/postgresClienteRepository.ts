import type { DbClient, DbQueryExecutor } from '../db/client.js';
import { normalizeDocumento } from '../db/documentoValidators.js';
import type { ListOptions, Scope } from '../services/tenantCrudService.js';
import type {
  Cliente,
  ClienteCreate,
  ClienteEmpresa,
  ClienteEmpresaCreate,
  ClienteEmpresaUpdate,
  ClienteUpdate,
} from './clienteTypes.js';
import type {
  ClienteEmpresaListFilter,
  ClienteListFilter,
  ClienteRepository,
} from './inMemoryClienteRepository.js';

function mapCliente(row: Record<string, unknown>): Cliente {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    empresa_id: row.empresa_id == null ? null : String(row.empresa_id),
    codigo: String(row.codigo),
    tipo: String(row.tipo),
    documento: row.documento == null ? null : String(row.documento),
    documento_normalizado: row.documento_normalizado == null ? null : String(row.documento_normalizado),
    nome: row.nome == null ? null : String(row.nome),
    razao_social: row.razao_social == null ? null : String(row.razao_social),
    nome_fantasia: row.nome_fantasia == null ? null : String(row.nome_fantasia),
    nome_social: row.nome_social == null ? null : String(row.nome_social),
    inscricao_estadual: row.inscricao_estadual == null ? null : String(row.inscricao_estadual),
    inscricao_municipal: row.inscricao_municipal == null ? null : String(row.inscricao_municipal),
    email: row.email == null ? null : String(row.email),
    telefone: row.telefone == null ? null : String(row.telefone),
    celular: row.celular == null ? null : String(row.celular),
    status: String(row.status ?? 'Ativo'),
    origem: String(row.origem ?? 'ERP'),
    codigo_legado: row.codigo_legado == null ? null : String(row.codigo_legado),
    legacy_id: row.legacy_id == null ? null : String(row.legacy_id),
    source_system: row.source_system == null ? null : String(row.source_system),
    migration_batch: row.migration_batch == null ? null : String(row.migration_batch),
    observacoes: row.observacoes == null ? null : String(row.observacoes),
    ativo: Boolean(row.ativo),
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapTimestamp(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapClienteEmpresa(row: Record<string, unknown>): ClienteEmpresa {
  const ativo = Boolean(row.ativo);
  const situacao = String(row.situacao_comercial ?? 'ATIVO') as ClienteEmpresa['situacao_comercial'];
  const habilitado = Boolean(row.habilitado_operacao);
  const bloqueado = Boolean(row.bloqueado);
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    cliente_id: String(row.cliente_id),
    empresa_id: String(row.empresa_id),
    ativo,
    situacao_comercial: situacao,
    habilitado_operacao: habilitado,
    bloqueado,
    motivo_bloqueio: row.motivo_bloqueio == null ? null : String(row.motivo_bloqueio),
    bloqueado_em: mapTimestamp(row.bloqueado_em),
    bloqueado_por: row.bloqueado_por == null ? null : String(row.bloqueado_por),
    observacao_comercial: row.observacao_comercial == null
      ? null
      : String(row.observacao_comercial),
    tabela_preco_id: row.tabela_preco_id == null ? null : String(row.tabela_preco_id),
    condicao_pagamento_id: row.condicao_pagamento_id == null ? null : String(row.condicao_pagamento_id),
    origem: String(row.origem ?? 'ERP') as ClienteEmpresa['origem'],
    legacy_id: row.legacy_id == null ? null : String(row.legacy_id),
    legacy_code: row.legacy_code == null ? null : String(row.legacy_code),
    source_system: row.source_system == null ? null : String(row.source_system),
    migration_batch: row.migration_batch == null ? null : String(row.migration_batch),
    imported_at: mapTimestamp(row.imported_at),
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: mapTimestamp(row.created_at) ?? '',
    updated_at: mapTimestamp(row.updated_at) ?? '',
    elegivel_operacao: ativo && situacao === 'ATIVO' && habilitado && !bloqueado,
  };
}

export class PostgresClienteRepository implements ClienteRepository {
  constructor(private readonly db: DbClient) {}

  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return this.db.withTransaction(fn);
  }

  async list(filter: Scope & ListOptions): Promise<Cliente[]> {
    const page = await this.listPage({ ...filter, offset: 0 });
    return page.rows;
  }

  async listPage(filter: ClienteListFilter): Promise<{ rows: Cliente[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [filter.groupId];
    const where = ['group_id = $1'];
    const ativoFilter = typeof filter.ativo === 'boolean' ? filter.ativo : true;
    params.push(ativoFilter);
    where.push(`ativo = $${params.length}`);
    if (filter.codigo) {
      params.push(filter.codigo);
      where.push(`codigo = $${params.length}`);
    }
    if (filter.documento) {
      params.push(normalizeDocumento(filter.documento));
      where.push(`documento_normalizado = $${params.length}`);
    }
    if (filter.search) {
      const q = `%${filter.search.toLowerCase()}%`;
      const docQ = normalizeDocumento(filter.search);
      params.push(q);
      const searchIdx = params.length;
      if (docQ) {
        params.push(`%${docQ}%`);
        where.push(`(
          lower(coalesce(nome,'')) LIKE $${searchIdx}
          OR lower(coalesce(razao_social,'')) LIKE $${searchIdx}
          OR lower(coalesce(nome_fantasia,'')) LIKE $${searchIdx}
          OR lower(coalesce(email,'')) LIKE $${searchIdx}
          OR lower(coalesce(telefone,'')) LIKE $${searchIdx}
          OR lower(coalesce(celular,'')) LIKE $${searchIdx}
          OR lower(codigo) LIKE $${searchIdx}
          OR documento_normalizado LIKE $${params.length}
        )`);
      } else {
        where.push(`(
          lower(coalesce(nome,'')) LIKE $${searchIdx}
          OR lower(coalesce(razao_social,'')) LIKE $${searchIdx}
          OR lower(coalesce(nome_fantasia,'')) LIKE $${searchIdx}
          OR lower(coalesce(email,'')) LIKE $${searchIdx}
          OR lower(coalesce(telefone,'')) LIKE $${searchIdx}
          OR lower(coalesce(celular,'')) LIKE $${searchIdx}
          OR lower(codigo) LIKE $${searchIdx}
        )`);
      }
    }
    const whereSql = where.join(' AND ');
    const orderBy = filter.orderBy === 'nome'
      ? `lower(coalesce(nome, razao_social, '')) ${filter.orderDir === 'desc' ? 'DESC' : 'ASC'}`
      : `(NULLIF(regexp_replace(codigo, '\\D', '', 'g'), '')::BIGINT) ${filter.orderDir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`;

    const countResult = await this.db.query(
      `SELECT count(*)::int AS total FROM clientes WHERE ${whereSql}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);
    params.push(limit, offset);
    const result = await this.db.query(
      `SELECT * FROM clientes WHERE ${whereSql} ORDER BY ${orderBy}, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: result.rows.map((row) => mapCliente(row as Record<string, unknown>)),
      total,
    };
  }

  async getById(scope: Scope, id: string): Promise<Cliente | null> {
    const result = await this.db.query(
      'SELECT * FROM clientes WHERE group_id = $1 AND id = $2',
      [scope.groupId, id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapCliente(row) : null;
  }

  async findByDocumento(groupId: string, documentoNormalizado: string): Promise<Cliente | null> {
    const result = await this.db.query(
      'SELECT * FROM clientes WHERE group_id = $1 AND documento_normalizado = $2 LIMIT 1',
      [groupId, documentoNormalizado],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapCliente(row) : null;
  }

  async create(
    scope: Scope,
    data: ClienteCreate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<Cliente> {
    const raw = data.documento ?? data.cpf_cnpj ?? '';
    const docNorm = normalizeDocumento(raw) || null;
    const empresaId = data.empresa_id ?? scope.empresaId ?? null;

    const execute = async (client: DbQueryExecutor) => {
      const codigoResult = await client.query<{ codigo: string }>(
        'SELECT reserve_entity_codigo($1, $2, 6) AS codigo',
        [scope.groupId, 'Cliente'],
      );
      const codigo = codigoResult.rows[0]?.codigo;
      if (!codigo) throw new Error('failed to reserve cliente codigo');

      const insert = await client.query(
        `INSERT INTO clientes (
          group_id, empresa_id, codigo, tipo, documento, documento_normalizado,
          nome, razao_social, nome_fantasia, nome_social,
          inscricao_estadual, inscricao_municipal, email, telefone, celular,
          status, origem, codigo_legado, legacy_id, source_system, migration_batch,
          observacoes, ativo, created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24
        ) RETURNING *`,
        [
          scope.groupId,
          empresaId,
          codigo,
          data.tipo,
          raw ? String(raw).trim() : docNorm,
          docNorm,
          data.nome ?? null,
          data.razao_social ?? null,
          data.nome_fantasia ?? null,
          data.nome_social ?? null,
          data.inscricao_estadual ?? null,
          data.inscricao_municipal ?? null,
          data.email ?? null,
          data.telefone ?? null,
          data.celular ?? null,
          data.status ?? 'Ativo',
          data.origem ?? 'ERP',
          data.codigo_legado ?? null,
          data.legacy_id ?? null,
          data.source_system ?? null,
          data.migration_batch ?? null,
          data.observacoes ?? null,
          data.ativo ?? true,
          actorId ?? null,
        ],
      );
      const created = mapCliente(insert.rows[0] as Record<string, unknown>);
      if (empresaId) {
        await client.query(
          `INSERT INTO cliente_empresas (
             group_id, cliente_id, empresa_id, ativo, created_by, updated_by
           )
           VALUES ($1,$2,$3,true,$4,$4)
           ON CONFLICT (cliente_id, empresa_id) DO NOTHING`,
          [scope.groupId, created.id, empresaId, actorId ?? null],
        );
      }
      return created;
    };
    return executor ? execute(executor) : this.db.withTransaction(execute);
  }

  async update(scope: Scope, id: string, data: ClienteUpdate): Promise<Cliente | null> {
    const current = await this.getById(scope, id);
    if (!current) return null;
    const rawDoc = data.documento !== undefined || data.cpf_cnpj !== undefined
      ? (data.documento ?? data.cpf_cnpj ?? '')
      : undefined;
    const docNorm = rawDoc !== undefined ? (normalizeDocumento(rawDoc) || null) : current.documento_normalizado;
    const documento = rawDoc !== undefined
      ? (rawDoc ? String(rawDoc).trim() : docNorm)
      : current.documento;

    const next = {
      empresa_id: data.empresa_id === undefined ? current.empresa_id : data.empresa_id,
      tipo: data.tipo ?? current.tipo,
      documento,
      documento_normalizado: docNorm,
      nome: data.nome === undefined ? current.nome : data.nome,
      razao_social: data.razao_social === undefined ? current.razao_social : data.razao_social,
      nome_fantasia: data.nome_fantasia === undefined ? current.nome_fantasia : data.nome_fantasia,
      nome_social: data.nome_social === undefined ? current.nome_social : data.nome_social,
      inscricao_estadual: data.inscricao_estadual === undefined ? current.inscricao_estadual : data.inscricao_estadual,
      inscricao_municipal: data.inscricao_municipal === undefined ? current.inscricao_municipal : data.inscricao_municipal,
      email: data.email === undefined ? current.email : data.email,
      telefone: data.telefone === undefined ? current.telefone : data.telefone,
      celular: data.celular === undefined ? current.celular : data.celular,
      status: data.status ?? current.status,
      origem: data.origem ?? current.origem,
      codigo_legado: data.codigo_legado === undefined ? current.codigo_legado : data.codigo_legado,
      legacy_id: data.legacy_id === undefined ? current.legacy_id : data.legacy_id,
      source_system: data.source_system === undefined ? current.source_system : data.source_system,
      migration_batch: data.migration_batch === undefined ? current.migration_batch : data.migration_batch,
      observacoes: data.observacoes === undefined ? current.observacoes : data.observacoes,
      ativo: data.ativo === undefined ? current.ativo : data.ativo,
    };

    const result = await this.db.query(
      `UPDATE clientes SET
        empresa_id=$1, tipo=$2, documento=$3, documento_normalizado=$4,
        nome=$5, razao_social=$6, nome_fantasia=$7, nome_social=$8,
        inscricao_estadual=$9, inscricao_municipal=$10, email=$11, telefone=$12, celular=$13,
        status=$14, origem=$15, codigo_legado=$16, legacy_id=$17, source_system=$18,
        migration_batch=$19, observacoes=$20, ativo=$21
       WHERE group_id=$22 AND id=$23
       RETURNING *`,
      [
        next.empresa_id, next.tipo, next.documento, next.documento_normalizado,
        next.nome, next.razao_social, next.nome_fantasia, next.nome_social,
        next.inscricao_estadual, next.inscricao_municipal, next.email, next.telefone, next.celular,
        next.status, next.origem, next.codigo_legado, next.legacy_id, next.source_system,
        next.migration_batch, next.observacoes, next.ativo,
        scope.groupId, id,
      ],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapCliente(row) : null;
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
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const params: unknown[] = [filter.groupId, filter.clienteId];
    const where = ['ce.group_id = $1', 'ce.cliente_id = $2'];
    params.push(typeof filter.ativo === 'boolean' ? filter.ativo : true);
    where.push(`ce.ativo = $${params.length}`);
    if (filter.empresaId) {
      params.push(filter.empresaId);
      where.push(`ce.empresa_id = $${params.length}`);
    }
    if (filter.situacaoComercial) {
      params.push(filter.situacaoComercial);
      where.push(`ce.situacao_comercial = $${params.length}`);
    }
    if (typeof filter.bloqueado === 'boolean') {
      params.push(filter.bloqueado);
      where.push(`ce.bloqueado = $${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      where.push(`(
        lower(ce.empresa_id::text) LIKE $${params.length}
        OR lower(ce.situacao_comercial) LIKE $${params.length}
        OR lower(coalesce(ce.observacao_comercial, '')) LIKE $${params.length}
        OR lower(coalesce(ce.legacy_id, '')) LIKE $${params.length}
        OR lower(coalesce(ce.legacy_code, '')) LIKE $${params.length}
        OR lower(coalesce(ce.source_system, '')) LIKE $${params.length}
      )`);
    }
    const whereSql = where.join(' AND ');
    const orderColumn = filter.orderBy === 'empresa'
      ? 'ce.empresa_id'
      : filter.orderBy === 'situacao'
        ? 'ce.situacao_comercial'
        : 'ce.created_at';
    const orderDirection = filter.orderDir === 'desc' ? 'DESC' : 'ASC';
    const count = await this.db.query(
      `SELECT count(*)::int AS total FROM cliente_empresas ce WHERE ${whereSql}`,
      params,
    );
    params.push(limit, offset);
    const result = await this.db.query(
      `SELECT ce.* FROM cliente_empresas ce
       WHERE ${whereSql}
       ORDER BY ${orderColumn} ${orderDirection}, ce.id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: result.rows.map((row) => mapClienteEmpresa(row as Record<string, unknown>)),
      total: Number(count.rows[0]?.total ?? 0),
    };
  }

  async getEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const result = await (executor ?? this.db).query(
      `SELECT * FROM cliente_empresas
       WHERE group_id = $1 AND cliente_id = $2 AND empresa_id = $3
       ${executor ? 'FOR UPDATE' : ''}`,
      [scope.groupId, clienteId, empresaId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapClienteEmpresa(row) : null;
  }

  async createEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    data: ClienteEmpresaCreate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<{ row: ClienteEmpresa; created: boolean }> {
    const execute = async (client: DbQueryExecutor) => {
      const inserted = await client.query(
        `INSERT INTO cliente_empresas (
          group_id, cliente_id, empresa_id, ativo, situacao_comercial,
          habilitado_operacao, bloqueado, observacao_comercial, condicao_pagamento_id, origem,
          legacy_id, legacy_code, source_system, migration_batch, imported_at,
          created_by, updated_by
        ) VALUES (
          $1,$2,$3,true,$4,$5,false,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14
        )
        ON CONFLICT (cliente_id, empresa_id) DO NOTHING
        RETURNING *`,
        [
          scope.groupId,
          clienteId,
          empresaId,
          data.situacao_comercial ?? 'ATIVO',
          data.habilitado_operacao ?? true,
          data.observacao_comercial ?? null,
          data.condicao_pagamento_id ?? null,
          data.origem ?? 'ERP',
          data.legacy_id ?? null,
          data.legacy_code ?? null,
          data.source_system ?? null,
          data.migration_batch ?? null,
          data.imported_at ?? null,
          actorId ?? null,
        ],
      );
      const insertedRow = inserted.rows[0] as Record<string, unknown> | undefined;
      if (insertedRow) return { row: mapClienteEmpresa(insertedRow), created: true };

      const existing = await client.query(
        `SELECT * FROM cliente_empresas
         WHERE group_id = $1 AND cliente_id = $2 AND empresa_id = $3`,
        [scope.groupId, clienteId, empresaId],
      );
      const row = existing.rows[0] as Record<string, unknown> | undefined;
      if (!row) throw new Error('cliente_empresa conflict without visible row');
      return { row: mapClienteEmpresa(row), created: false };
    };
    return executor ? execute(executor) : this.db.withTransaction(execute);
  }

  async updateEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    data: ClienteEmpresaUpdate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const client = executor ?? this.db;
    const current = await this.getEmpresaLink(scope, clienteId, empresaId, executor);
    if (!current) return null;
    const result = await client.query(
      `UPDATE cliente_empresas SET
        situacao_comercial=$1, habilitado_operacao=$2, observacao_comercial=$3,
        tabela_preco_id=$4, condicao_pagamento_id=$5,
        origem=$6, legacy_id=$7, legacy_code=$8, source_system=$9,
        migration_batch=$10, imported_at=$11, updated_by=$12
       WHERE group_id=$13 AND cliente_id=$14 AND empresa_id=$15
       RETURNING *`,
      [
        data.situacao_comercial ?? current.situacao_comercial,
        data.habilitado_operacao ?? current.habilitado_operacao,
        data.observacao_comercial === undefined
          ? current.observacao_comercial
          : data.observacao_comercial,
        data.tabela_preco_id === undefined
          ? current.tabela_preco_id
          : data.tabela_preco_id,
        data.condicao_pagamento_id === undefined ? current.condicao_pagamento_id : data.condicao_pagamento_id,
        data.origem ?? current.origem,
        data.legacy_id === undefined ? current.legacy_id : data.legacy_id,
        data.legacy_code === undefined ? current.legacy_code : data.legacy_code,
        data.source_system === undefined ? current.source_system : data.source_system,
        data.migration_batch === undefined ? current.migration_batch : data.migration_batch,
        data.imported_at === undefined ? current.imported_at : data.imported_at,
        actorId ?? null,
        scope.groupId,
        clienteId,
        empresaId,
      ],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapClienteEmpresa(row) : null;
  }

  async setEmpresaLinkBlocked(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    blocked: boolean,
    actorId?: string | null,
    motivo?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const result = await (executor ?? this.db).query(
      `UPDATE cliente_empresas SET
        bloqueado=$1,
        motivo_bloqueio=CASE WHEN $1 THEN $2 ELSE NULL END,
        bloqueado_em=CASE WHEN $1 THEN timezone('utc', now()) ELSE NULL END,
        bloqueado_por=CASE WHEN $1 THEN $3::uuid ELSE NULL END,
        updated_by=$3
       WHERE group_id=$4 AND cliente_id=$5 AND empresa_id=$6 AND ativo=true
       RETURNING *`,
      [blocked, motivo ?? null, actorId ?? null, scope.groupId, clienteId, empresaId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapClienteEmpresa(row) : null;
  }

  async softDeleteEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const result = await (executor ?? this.db).query(
      `UPDATE cliente_empresas SET
        ativo=false, situacao_comercial='INATIVO', habilitado_operacao=false,
        updated_by=$1
       WHERE group_id=$2 AND cliente_id=$3 AND empresa_id=$4 AND ativo=true
       RETURNING *`,
      [actorId ?? null, scope.groupId, clienteId, empresaId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapClienteEmpresa(row) : null;
  }

  async restoreEmpresaLink(
    scope: Scope,
    clienteId: string,
    empresaId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteEmpresa | null> {
    const result = await (executor ?? this.db).query(
      `UPDATE cliente_empresas SET
        ativo=true, situacao_comercial='ATIVO', habilitado_operacao=true,
        updated_by=$1
       WHERE group_id=$2 AND cliente_id=$3 AND empresa_id=$4 AND ativo=false
       RETURNING *`,
      [actorId ?? null, scope.groupId, clienteId, empresaId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapClienteEmpresa(row) : null;
  }
}
