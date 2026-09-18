import type { DbClient, DbQueryExecutor } from '../db/client.js';
import type {
  ObraListFilter,
  ObraRepository,
  ObraScope,
} from './inMemoryObraRepository.js';
import { normalizeObraNome, type Obra, type ObraCreate, type ObraEmpresa, type ObraLocal, type ObraLocalInput, type ObraUpdate } from './obraTypes.js';

function iso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseJson<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') return JSON.parse(value) as T[];
  return [];
}

function mapObra(row: Record<string, unknown>): Obra {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    cliente_id: String(row.cliente_id),
    codigo: String(row.codigo),
    nome: String(row.nome),
    status: String(row.status) as Obra['status'],
    observacao: row.observacao == null ? null : String(row.observacao),
    ativo: Boolean(row.ativo),
    origem: String(row.origem ?? 'ERP'),
    legacy_id: row.legacy_id == null ? null : String(row.legacy_id),
    legacy_code: row.legacy_code == null ? null : String(row.legacy_code),
    source_system: row.source_system == null ? null : String(row.source_system),
    migration_batch: row.migration_batch == null ? null : String(row.migration_batch),
    imported_at: iso(row.imported_at),
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: iso(row.created_at) ?? '',
    updated_at: iso(row.updated_at) ?? '',
    empresas: parseJson<ObraEmpresa>(row.empresas),
    locais: parseJson<ObraLocal>(row.locais),
  };
}

const OBRA_SELECT = `
  SELECT o.*,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', e.id, 'group_id', e.group_id, 'obra_id', e.obra_id,
        'empresa_id', e.empresa_id, 'ativo', e.ativo,
        'created_by', e.created_by, 'updated_by', e.updated_by,
        'created_at', e.created_at, 'updated_at', e.updated_at
      ) ORDER BY e.created_at)
      FROM obra_empresas e WHERE e.obra_id = o.id
    ), '[]'::json) AS empresas,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', l.id, 'group_id', l.group_id, 'obra_id', l.obra_id,
        'cliente_local_id', l.cliente_local_id, 'uso_na_obra', l.uso_na_obra,
        'principal', l.principal, 'ativo', l.ativo,
        'nome_local', cl.nome, 'cidade', cl.cidade, 'uf', cl.uf,
        'created_by', l.created_by, 'updated_by', l.updated_by,
        'created_at', l.created_at, 'updated_at', l.updated_at
      ) ORDER BY l.principal DESC, l.created_at)
      FROM obra_locais l
      JOIN cliente_locais cl ON cl.id = l.cliente_local_id
      WHERE l.obra_id = o.id
    ), '[]'::json) AS locais
  FROM obras o
`;

export class PostgresObraRepository implements ObraRepository {
  constructor(private readonly db: DbClient) {}

  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return this.db.withTransaction(fn);
  }

  private exec(executor?: DbQueryExecutor) {
    return executor ?? this.db;
  }

  async listPage(filter: ObraListFilter, executor?: DbQueryExecutor) {
    const params: unknown[] = [filter.groupId, filter.clienteId];
    const where = ['o.group_id=$1', 'o.cliente_id=$2'];
    params.push(typeof filter.ativo === 'boolean' ? filter.ativo : true);
    where.push(`o.ativo=$${params.length}`);
    if (filter.status) {
      params.push(filter.status);
      where.push(`o.status=$${params.length}`);
    }
    if (filter.operacional) {
      where.push(`o.ativo=true`);
      where.push(`o.status='ATIVA'`);
      where.push(`EXISTS (
        SELECT 1 FROM obra_locais pl0
        WHERE pl0.obra_id=o.id AND pl0.principal=true AND pl0.ativo=true
      )`);
    }
    if (filter.empresaId) {
      params.push(filter.empresaId);
      where.push(`EXISTS (
        SELECT 1 FROM obra_empresas oe
        WHERE oe.obra_id=o.id AND oe.empresa_id=$${params.length} AND oe.ativo=true
      )`);
    }
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      where.push(`(lower(o.nome) LIKE $${params.length} OR o.codigo LIKE $${params.length})`);
    }
    if (filter.cidade) {
      params.push(filter.cidade.toLowerCase());
      where.push(`EXISTS (
        SELECT 1 FROM obra_locais pl
        JOIN cliente_locais clp ON clp.id=pl.cliente_local_id
        WHERE pl.obra_id=o.id AND pl.principal=true AND pl.ativo=true
          AND lower(clp.cidade)=$${params.length}
      )`);
    }
    if (filter.uf) {
      params.push(filter.uf.toUpperCase());
      where.push(`EXISTS (
        SELECT 1 FROM obra_locais pl2
        JOIN cliente_locais clp2 ON clp2.id=pl2.cliente_local_id
        WHERE pl2.obra_id=o.id AND pl2.principal=true AND pl2.ativo=true
          AND clp2.uf=$${params.length}
      )`);
    }
    const orderCol = filter.orderBy === 'nome'
      ? 'o.nome'
      : filter.orderBy === 'codigo' ? 'o.codigo' : 'o.created_at';
    const orderDir = filter.orderDir === 'desc' ? 'DESC' : 'ASC';
    const count = await this.exec(executor).query<{ total: number }>(
      `SELECT count(*)::int AS total FROM obras o WHERE ${where.join(' AND ')}`,
      params,
    );
    params.push(filter.limit, filter.offset);
    const page = await this.exec(executor).query(
      `${OBRA_SELECT} WHERE ${where.join(' AND ')}
       ORDER BY ${orderCol} ${orderDir}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: page.rows.map((row) => mapObra(row as Record<string, unknown>)),
      total: count.rows[0]?.total ?? 0,
    };
  }

  async get(scope: ObraScope, obraId: string, executor?: DbQueryExecutor) {
    const params: unknown[] = [scope.groupId, scope.clienteId, obraId];
    let empresaSql = '';
    if (scope.empresaId) {
      params.push(scope.empresaId);
      empresaSql = ` AND EXISTS (
        SELECT 1 FROM obra_empresas oe
        WHERE oe.obra_id=o.id AND oe.empresa_id=$4 AND oe.ativo=true
      )`;
    }
    const result = await this.exec(executor).query(
      `${OBRA_SELECT} WHERE o.group_id=$1 AND o.cliente_id=$2 AND o.id=$3${empresaSql}`,
      params,
    );
    return result.rows[0] ? mapObra(result.rows[0] as Record<string, unknown>) : null;
  }

  async lock(scope: ObraScope, obraId: string, executor?: DbQueryExecutor) {
    await this.exec(executor).query(
      'SELECT id FROM obras WHERE group_id=$1 AND cliente_id=$2 AND id=$3 FOR UPDATE',
      [scope.groupId, scope.clienteId, obraId],
    );
  }

  async create(scope: ObraScope, data: ObraCreate, actorId: string | null | undefined, executor?: DbQueryExecutor) {
    if (!scope.empresaId) throw new Error('EMPRESA_ID_REQUIRED');
    const db = this.exec(executor);
    const codigo = await db.query<{ codigo: string }>(
      'SELECT reserve_entity_codigo($1, $2, 6) AS codigo',
      [scope.groupId, 'Obra'],
    );
    const inserted = await db.query(
      `INSERT INTO obras (
         group_id, cliente_id, codigo, nome, status, observacao, origem,
         legacy_id, legacy_code, source_system, migration_batch, imported_at,
         created_by, updated_by
       ) VALUES ($1,$2,$3,$4,'ATIVA',$5,$6,$7,$8,$9,$10,$11,$12,$12)
       RETURNING id`,
      [
        scope.groupId, scope.clienteId, codigo.rows[0].codigo, data.nome,
        data.observacao ?? null, data.origem ?? 'ERP',
        data.legacy_id ?? null, data.legacy_code ?? null, data.source_system ?? null,
        data.migration_batch ?? null, data.imported_at ?? null, actorId ?? null,
      ],
    );
    const obraId = String(inserted.rows[0].id);
    await db.query(
      `INSERT INTO obra_empresas (group_id, obra_id, empresa_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$4)`,
      [scope.groupId, obraId, scope.empresaId, actorId ?? null],
    );
    for (const local of data.locais) {
      await db.query(
        `INSERT INTO obra_locais (
           group_id, obra_id, cliente_local_id, uso_na_obra, principal, created_by, updated_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [
          scope.groupId, obraId, local.cliente_local_id, local.uso_na_obra,
          Boolean(local.principal), actorId ?? null,
        ],
      );
    }
    const created = await this.get({ ...scope, empresaId: undefined }, obraId, executor);
    if (!created) throw new Error('OBRA_NOT_FOUND');
    return created;
  }

  async update(
    scope: ObraScope,
    obraId: string,
    data: ObraUpdate,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const assignments: string[] = ['updated_by=$4', 'updated_at=timezone(\'utc\', now())'];
    const params: unknown[] = [scope.groupId, scope.clienteId, obraId, actorId ?? null];
    if (data.nome !== undefined) {
      params.push(data.nome);
      assignments.push(`nome=$${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(data.status);
      assignments.push(`status=$${params.length}`);
    }
    if (data.observacao !== undefined) {
      params.push(data.observacao);
      assignments.push(`observacao=$${params.length}`);
    }
    await this.exec(executor).query(
      `UPDATE obras SET ${assignments.join(', ')}
       WHERE group_id=$1 AND cliente_id=$2 AND id=$3 AND ativo=true`,
      params,
    );
    return this.get({ ...scope, empresaId: undefined }, obraId, executor);
  }

  async softDelete(scope: ObraScope, obraId: string, actorId: string | null | undefined, executor?: DbQueryExecutor) {
    await this.exec(executor).query(
      `UPDATE obras SET ativo=false, updated_by=$4, updated_at=timezone('utc', now())
       WHERE group_id=$1 AND cliente_id=$2 AND id=$3 AND ativo=true`,
      [scope.groupId, scope.clienteId, obraId, actorId ?? null],
    );
    return this.get({ ...scope, empresaId: undefined }, obraId, executor);
  }

  async restore(scope: ObraScope, obraId: string, actorId: string | null | undefined, executor?: DbQueryExecutor) {
    await this.exec(executor).query(
      `UPDATE obras SET ativo=true, updated_by=$4, updated_at=timezone('utc', now())
       WHERE group_id=$1 AND cliente_id=$2 AND id=$3 AND ativo=false`,
      [scope.groupId, scope.clienteId, obraId, actorId ?? null],
    );
    return this.get({ ...scope, empresaId: undefined }, obraId, executor);
  }

  async linkEmpresa(
    scope: ObraScope,
    obraId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    await this.exec(executor).query(
      `INSERT INTO obra_empresas (group_id, obra_id, empresa_id, ativo, created_by, updated_by)
       VALUES ($1,$2,$3,true,$4,$4)
       ON CONFLICT (obra_id, empresa_id) DO UPDATE SET
         ativo=true, updated_by=EXCLUDED.updated_by, updated_at=timezone('utc', now())`,
      [scope.groupId, obraId, empresaId, actorId ?? null],
    );
    return this.require(scope, obraId, executor);
  }

  async unlinkEmpresa(
    scope: ObraScope,
    obraId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE obra_empresas SET ativo=false, updated_by=$4, updated_at=timezone('utc', now())
       WHERE group_id=$1 AND obra_id=$2 AND empresa_id=$3 AND ativo=true
       RETURNING id`,
      [scope.groupId, obraId, empresaId, actorId ?? null],
    );
    if (!result.rows[0]) return null;
    return this.require(scope, obraId, executor);
  }

  async restoreEmpresa(
    scope: ObraScope,
    obraId: string,
    empresaId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    return this.linkEmpresa(scope, obraId, empresaId, actorId, executor);
  }

  async linkLocal(
    scope: ObraScope,
    obraId: string,
    input: ObraLocalInput,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const db = this.exec(executor);
    if (input.principal) {
      await db.query(
        `UPDATE obra_locais SET principal=false, updated_by=$2, updated_at=timezone('utc', now())
         WHERE obra_id=$1 AND principal=true AND ativo=true`,
        [obraId, actorId ?? null],
      );
    }
    await db.query(
      `INSERT INTO obra_locais (
         group_id, obra_id, cliente_local_id, uso_na_obra, principal, ativo, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,true,$6,$6)
       ON CONFLICT (obra_id, cliente_local_id, uso_na_obra) DO UPDATE SET
         ativo=true, principal=EXCLUDED.principal,
         updated_by=EXCLUDED.updated_by, updated_at=timezone('utc', now())`,
      [
        scope.groupId, obraId, input.cliente_local_id, input.uso_na_obra,
        Boolean(input.principal), actorId ?? null,
      ],
    );
    return this.require(scope, obraId, executor);
  }

  async unlinkLocal(
    scope: ObraScope,
    obraId: string,
    localId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `UPDATE obra_locais SET ativo=false, principal=false, updated_by=$4,
         updated_at=timezone('utc', now())
       WHERE group_id=$1 AND obra_id=$2 AND cliente_local_id=$3 AND ativo=true
         AND principal=false
       RETURNING id`,
      [scope.groupId, obraId, localId, actorId ?? null],
    );
    if (!result.rows[0]) return null;
    return this.require(scope, obraId, executor);
  }

  async restoreLocal(
    scope: ObraScope,
    obraId: string,
    localId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    await this.exec(executor).query(
      `UPDATE obra_locais SET ativo=true, updated_by=$4, updated_at=timezone('utc', now())
       WHERE group_id=$1 AND obra_id=$2 AND cliente_local_id=$3 AND ativo=false`,
      [scope.groupId, obraId, localId, actorId ?? null],
    );
    return this.require(scope, obraId, executor);
  }

  async setPrincipal(
    scope: ObraScope,
    obraId: string,
    localId: string,
    actorId: string | null | undefined,
    executor?: DbQueryExecutor,
  ) {
    const db = this.exec(executor);
    const target = await db.query<{ id: string }>(
      `SELECT id FROM obra_locais
       WHERE group_id=$1 AND obra_id=$2 AND cliente_local_id=$3 AND ativo=true
       FOR UPDATE`,
      [scope.groupId, obraId, localId],
    );
    if (!target.rows[0]) return null;
    await db.query(
      `UPDATE obra_locais SET principal=false, updated_by=$2, updated_at=timezone('utc', now())
       WHERE obra_id=$1 AND principal=true AND ativo=true AND cliente_local_id<>$3`,
      [obraId, actorId ?? null, localId],
    );
    await db.query(
      `UPDATE obra_locais SET principal=true, updated_by=$3, updated_at=timezone('utc', now())
       WHERE id=$1 AND group_id=$2 AND ativo=true`,
      [target.rows[0].id, scope.groupId, actorId ?? null],
    );
    return this.require(scope, obraId, executor);
  }

  async findPossibleDuplicate(
    scope: ObraScope,
    nome: string,
    principalLocalId: string,
    excludeObraId?: string,
    executor?: DbQueryExecutor,
  ) {
    const result = await this.exec(executor).query(
      `${OBRA_SELECT}
       WHERE o.group_id=$1 AND o.cliente_id=$2 AND o.ativo=true
         AND ($4::uuid IS NULL OR o.id<>$4)
         AND btrim(regexp_replace(lower(o.nome), '\\s+', ' ', 'g')) = $5
         AND EXISTS (
           SELECT 1 FROM obra_locais l
           WHERE l.obra_id=o.id AND l.principal=true AND l.ativo=true
             AND l.cliente_local_id=$3
         )
       LIMIT 1`,
      [
        scope.groupId, scope.clienteId, principalLocalId, excludeObraId ?? null,
        normalizeObraNome(nome),
      ],
    );
    return result.rows[0] ? mapObra(result.rows[0] as Record<string, unknown>) : null;
  }

  async findActiveObraUsingLocal(groupId: string, localId: string, executor?: DbQueryExecutor) {
    const result = await this.exec(executor).query<{ obra_id: string; principal: boolean }>(
      `SELECT l.obra_id, l.principal
       FROM obra_locais l
       JOIN obras o ON o.id=l.obra_id
       WHERE o.group_id=$1 AND o.ativo=true AND l.cliente_local_id=$2 AND l.ativo=true
       LIMIT 1`,
      [groupId, localId],
    );
    const row = result.rows[0];
    return row ? { obraId: row.obra_id, principal: row.principal } : null;
  }

  private async require(scope: ObraScope, obraId: string, executor?: DbQueryExecutor) {
    const obra = await this.get({ ...scope, empresaId: undefined }, obraId, executor);
    if (!obra) throw new Error('OBRA_NOT_FOUND');
    return obra;
  }
}
