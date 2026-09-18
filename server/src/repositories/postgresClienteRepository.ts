import type { DbClient } from '../db/client.js';
import { normalizeDocumento } from '../db/documentoValidators.js';
import type { ListOptions, Scope } from '../services/tenantCrudService.js';
import type { Cliente, ClienteCreate, ClienteUpdate } from './clienteTypes.js';
import type { ClienteListFilter, ClienteRepository } from './inMemoryClienteRepository.js';

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

export class PostgresClienteRepository implements ClienteRepository {
  constructor(private readonly db: DbClient) {}

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

  async create(scope: Scope, data: ClienteCreate): Promise<Cliente> {
    const raw = data.documento ?? data.cpf_cnpj ?? '';
    const docNorm = normalizeDocumento(raw) || null;
    const empresaId = data.empresa_id ?? scope.empresaId ?? null;

    return this.db.withTransaction(async (client) => {
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
          observacoes, ativo
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
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
        ],
      );
      const created = mapCliente(insert.rows[0] as Record<string, unknown>);
      if (empresaId) {
        await client.query(
          `INSERT INTO cliente_empresas (group_id, cliente_id, empresa_id, ativo)
           VALUES ($1,$2,$3,true)
           ON CONFLICT (cliente_id, empresa_id) DO NOTHING`,
          [scope.groupId, created.id, empresaId],
        );
      }
      return created;
    });
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
}
