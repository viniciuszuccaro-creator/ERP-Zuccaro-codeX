import type { DbClient, DbQueryExecutor } from '../db/client.js';
import {
  buildClienteLocalFingerprint,
  type ClienteLocal,
  type ClienteLocalCreate,
  type ClienteLocalFinalidade,
  type ClienteLocalFinalidadeInput,
  type ClienteLocalUpdate,
} from './clienteLocalTypes.js';
import type {
  ClienteLocalListFilter,
  ClienteLocalRepository,
  ClienteLocalScope,
} from './inMemoryClienteLocalRepository.js';

function iso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function parsePurposes(value: unknown): ClienteLocalFinalidade[] {
  if (Array.isArray(value)) return value as ClienteLocalFinalidade[];
  if (typeof value === 'string') return JSON.parse(value) as ClienteLocalFinalidade[];
  return [];
}

function mapLocal(row: Record<string, unknown>): ClienteLocal {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    cliente_id: String(row.cliente_id),
    nome: String(row.nome),
    cep: String(row.cep ?? ''),
    logradouro: String(row.logradouro ?? ''),
    numero: String(row.numero ?? ''),
    complemento: row.complemento == null ? null : String(row.complemento),
    bairro: String(row.bairro ?? ''),
    cidade: String(row.cidade ?? ''),
    uf: String(row.uf ?? ''),
    pais: String(row.pais ?? 'BRASIL'),
    referencia: row.referencia == null ? null : String(row.referencia),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    coordinate_source: row.coordinate_source == null
      ? null
      : String(row.coordinate_source) as ClienteLocal['coordinate_source'],
    geocode_status: String(row.geocode_status) as ClienteLocal['geocode_status'],
    geocode_source: row.geocode_source == null ? null : String(row.geocode_source),
    geocode_precision: row.geocode_precision == null
      ? null
      : String(row.geocode_precision) as ClienteLocal['geocode_precision'],
    geocoded_at: iso(row.geocoded_at),
    endereco_incompleto: Boolean(row.endereco_incompleto),
    endereco_fingerprint: String(row.endereco_fingerprint),
    ativo: Boolean(row.ativo),
    origem: String(row.origem) as ClienteLocal['origem'],
    legacy_id: row.legacy_id == null ? null : String(row.legacy_id),
    legacy_code: row.legacy_code == null ? null : String(row.legacy_code),
    source_system: row.source_system == null ? null : String(row.source_system),
    migration_batch: row.migration_batch == null ? null : String(row.migration_batch),
    imported_at: iso(row.imported_at),
    created_by: row.created_by == null ? null : String(row.created_by),
    updated_by: row.updated_by == null ? null : String(row.updated_by),
    created_at: iso(row.created_at) ?? '',
    updated_at: iso(row.updated_at) ?? '',
    finalidades: parsePurposes(row.finalidades),
  };
}

const LOCAL_SELECT = `
  SELECT cl.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id', f.id,
          'group_id', f.group_id,
          'cliente_id', f.cliente_id,
          'cliente_local_id', f.cliente_local_id,
          'finalidade', f.finalidade,
          'principal', f.principal,
          'ativo', f.ativo,
          'created_by', f.created_by,
          'updated_by', f.updated_by,
          'created_at', f.created_at,
          'updated_at', f.updated_at
        ) ORDER BY f.finalidade
      ) FILTER (WHERE f.id IS NOT NULL AND f.ativo=true),
      '[]'::json
    ) AS finalidades
  FROM cliente_locais cl
  LEFT JOIN cliente_local_finalidades f ON f.cliente_local_id = cl.id
`;

export class PostgresClienteLocalRepository implements ClienteLocalRepository {
  constructor(private readonly db: DbClient) {}

  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> {
    return this.db.withTransaction(fn);
  }

  async listPage(filter: ClienteLocalListFilter) {
    const params: unknown[] = [filter.groupId, filter.clienteId];
    const where = ['cl.group_id=$1', 'cl.cliente_id=$2'];
    params.push(typeof filter.ativo === 'boolean' ? filter.ativo : true);
    where.push(`cl.ativo=$${params.length}`);
    if (filter.finalidade) {
      params.push(filter.finalidade);
      where.push(`EXISTS (
        SELECT 1 FROM cliente_local_finalidades ff
        WHERE ff.cliente_local_id=cl.id AND ff.ativo=true
          AND ff.finalidade=$${params.length}
      )`);
    }
    if (typeof filter.principal === 'boolean') {
      params.push(filter.principal);
      where.push(`EXISTS (
        SELECT 1 FROM cliente_local_finalidades fp
        WHERE fp.cliente_local_id=cl.id AND fp.ativo=true
          AND fp.principal=$${params.length}
      )`);
    }
    if (filter.cidade) {
      params.push(filter.cidade.toLowerCase());
      where.push(`lower(cl.cidade)=$${params.length}`);
    }
    if (filter.uf) {
      params.push(filter.uf.toUpperCase());
      where.push(`cl.uf=$${params.length}`);
    }
    if (filter.search) {
      params.push(`%${filter.search.toLowerCase()}%`);
      where.push(`(
        lower(cl.nome) LIKE $${params.length}
        OR lower(cl.cep) LIKE $${params.length}
        OR lower(cl.logradouro) LIKE $${params.length}
        OR lower(cl.bairro) LIKE $${params.length}
        OR lower(cl.cidade) LIKE $${params.length}
        OR lower(cl.uf) LIKE $${params.length}
      )`);
    }
    const whereSql = where.join(' AND ');
    const orderColumn = filter.orderBy === 'nome'
      ? 'cl.nome'
      : filter.orderBy === 'cidade' ? 'cl.cidade' : 'cl.created_at';
    const orderDirection = filter.orderDir === 'desc' ? 'DESC' : 'ASC';
    const count = await this.db.query(
      `SELECT count(*)::int AS total FROM cliente_locais cl WHERE ${whereSql}`,
      params,
    );
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    params.push(limit, offset);
    const result = await this.db.query(
      `${LOCAL_SELECT}
       WHERE ${whereSql}
       GROUP BY cl.id
       ORDER BY ${orderColumn} ${orderDirection}, cl.id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: result.rows.map((row) => mapLocal(row as Record<string, unknown>)),
      total: Number(count.rows[0]?.total ?? 0),
    };
  }

  async get(
    scope: ClienteLocalScope,
    localId: string,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null> {
    const result = await (executor ?? this.db).query(
      `${LOCAL_SELECT}
       WHERE cl.group_id=$1 AND cl.cliente_id=$2 AND cl.id=$3
       GROUP BY cl.id`,
      [scope.groupId, scope.clienteId, localId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapLocal(row) : null;
  }

  async create(
    scope: ClienteLocalScope,
    data: ClienteLocalCreate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal> {
    const execute = async (client: DbQueryExecutor) => {
      await this.lockCliente(client, scope);
      const fingerprint = buildClienteLocalFingerprint(scope.groupId, scope.clienteId, data);
      await this.assertNoDuplicate(client, scope, fingerprint);
      const geo = this.geoValues(data);
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO cliente_locais (
          group_id, cliente_id, nome, cep, logradouro, numero, complemento,
          bairro, cidade, uf, pais, referencia, latitude, longitude,
          coordinate_source, geocode_status, geocode_source, geocode_precision,
          geocoded_at,
          endereco_incompleto, endereco_fingerprint, ativo, origem,
          legacy_id, legacy_code, source_system, migration_batch, imported_at,
          created_by, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
          false,$20,true,$21,$22,$23,$24,$25,$26,$27,$27
        ) RETURNING id`,
        [
          scope.groupId, scope.clienteId, data.nome, data.cep, data.logradouro,
          data.numero, data.complemento ?? null, data.bairro, data.cidade,
          data.uf, data.pais, data.referencia ?? null, data.latitude ?? null,
          data.longitude ?? null, geo.coordinateSource, geo.status, geo.source, geo.precision,
          geo.geocodedAt, fingerprint, data.origem, data.legacy_id ?? null,
          data.legacy_code ?? null, data.source_system ?? null,
          data.migration_batch ?? null, data.imported_at ?? null, actorId ?? null,
        ],
      );
      const id = String(inserted.rows[0].id);
      await this.replaceFinalidades(scope, id, data.finalidades, actorId, client);
      const row = await this.get(scope, id, client);
      if (!row) throw new Error('cliente local insert failed');
      return row;
    };
    return executor ? execute(executor) : this.db.withTransaction(execute);
  }

  async update(
    scope: ClienteLocalScope,
    localId: string,
    data: ClienteLocalUpdate,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null> {
    const execute = async (client: DbQueryExecutor) => {
      await this.lockCliente(client, scope);
      const current = await this.get(scope, localId, client);
      if (!current) return null;
      const next = { ...current, ...data };
      const fingerprint = buildClienteLocalFingerprint(scope.groupId, scope.clienteId, next);
      await this.assertNoDuplicate(client, scope, fingerprint, localId);
      const geo = this.geoValues(next, current, data);
      await client.query(
        `UPDATE cliente_locais SET
          nome=$1, cep=$2, logradouro=$3, numero=$4, complemento=$5,
          bairro=$6, cidade=$7, uf=$8, pais=$9, referencia=$10,
          latitude=$11, longitude=$12, coordinate_source=$13,
          geocode_status=$14, geocode_source=$15, geocode_precision=$16,
          geocoded_at=$17, endereco_fingerprint=$18,
          origem=$19, legacy_id=$20, legacy_code=$21, source_system=$22,
          migration_batch=$23, imported_at=$24, updated_by=$25
         WHERE group_id=$26 AND cliente_id=$27 AND id=$28`,
        [
          next.nome, next.cep, next.logradouro, next.numero, next.complemento,
          next.bairro, next.cidade, next.uf, next.pais, next.referencia,
          next.latitude, next.longitude, geo.coordinateSource, geo.status,
          geo.source, geo.precision,
          geo.geocodedAt, fingerprint, next.origem, next.legacy_id,
          next.legacy_code, next.source_system, next.migration_batch,
          next.imported_at, actorId ?? null, scope.groupId, scope.clienteId,
          localId,
        ],
      );
      return this.get(scope, localId, client);
    };
    return executor ? execute(executor) : this.db.withTransaction(execute);
  }

  async replaceFinalidades(
    scope: ClienteLocalScope,
    localId: string,
    finalidades: ClienteLocalFinalidadeInput[],
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null> {
    const execute = async (client: DbQueryExecutor) => {
      await this.lockCliente(client, scope);
      const local = await this.get(scope, localId, client);
      if (!local) return null;
      const requested = new Set(finalidades.map((row) => row.finalidade));
      for (const existing of local.finalidades) {
        if (!requested.has(existing.finalidade)) {
          await client.query(
            `UPDATE cliente_local_finalidades SET
              ativo=false, principal=false, updated_by=$1
             WHERE id=$2`,
            [actorId ?? null, existing.id],
          );
        }
      }
      for (const purpose of finalidades) {
        if (purpose.principal) {
          await client.query(
            `UPDATE cliente_local_finalidades SET
              principal=false, updated_by=$1
             WHERE group_id=$2 AND cliente_id=$3 AND finalidade=$4
               AND ativo=true AND cliente_local_id<>$5`,
            [actorId ?? null, scope.groupId, scope.clienteId, purpose.finalidade, localId],
          );
        }
        await client.query(
          `INSERT INTO cliente_local_finalidades (
            group_id, cliente_id, cliente_local_id, finalidade, principal,
            ativo, created_by, updated_by
          ) VALUES ($1,$2,$3,$4,$5,true,$6,$6)
          ON CONFLICT (cliente_local_id, finalidade) DO UPDATE SET
            principal=EXCLUDED.principal,
            ativo=true,
            updated_by=EXCLUDED.updated_by`,
          [
            scope.groupId, scope.clienteId, localId, purpose.finalidade,
            purpose.principal, actorId ?? null,
          ],
        );
      }
      return this.get(scope, localId, client);
    };
    return executor ? execute(executor) : this.db.withTransaction(execute);
  }

  async softDelete(
    scope: ClienteLocalScope,
    localId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null> {
    const result = await (executor ?? this.db).query(
      `UPDATE cliente_locais SET ativo=false, updated_by=$1
       WHERE group_id=$2 AND cliente_id=$3 AND id=$4 AND ativo=true`,
      [actorId ?? null, scope.groupId, scope.clienteId, localId],
    );
    if (result.rowCount === 0) return null;
    return this.get(scope, localId, executor);
  }

  async restore(
    scope: ClienteLocalScope,
    localId: string,
    actorId?: string | null,
    executor?: DbQueryExecutor,
  ): Promise<ClienteLocal | null> {
    const result = await (executor ?? this.db).query(
      `UPDATE cliente_locais SET ativo=true, updated_by=$1
       WHERE group_id=$2 AND cliente_id=$3 AND id=$4 AND ativo=false`,
      [actorId ?? null, scope.groupId, scope.clienteId, localId],
    );
    if (result.rowCount === 0) return null;
    return this.get(scope, localId, executor);
  }

  private async lockCliente(client: DbQueryExecutor, scope: ClienteLocalScope) {
    const result = await client.query(
      'SELECT id FROM clientes WHERE group_id=$1 AND id=$2 FOR UPDATE',
      [scope.groupId, scope.clienteId],
    );
    if (result.rowCount === 0) throw new Error('CLIENTE_NOT_FOUND');
  }

  private async assertNoDuplicate(
    client: DbQueryExecutor,
    scope: ClienteLocalScope,
    fingerprint: string,
    excludeId?: string,
  ) {
    const result = await client.query<{ id: string }>(
      `SELECT id FROM cliente_locais
       WHERE group_id=$1 AND cliente_id=$2 AND endereco_fingerprint=$3
         AND ativo=true AND ($4::uuid IS NULL OR id<>$4)
       LIMIT 1`,
      [scope.groupId, scope.clienteId, fingerprint, excludeId ?? null],
    );
    if (result.rows[0]) throw new Error(`POSSIBLE_DUPLICATE:${result.rows[0].id}`);
  }

  private geoValues(
    data: Pick<
      ClienteLocalCreate,
      | 'latitude'
      | 'longitude'
      | 'coordinate_source'
      | 'geocode_status'
      | 'geocode_source'
      | 'geocode_precision'
      | 'geocoded_at'
    >,
    current?: ClienteLocal,
    changed?: ClienteLocalUpdate,
  ) {
    const coordinatesChanged = !current
      || changed?.latitude !== undefined
      || changed?.longitude !== undefined;
    const hasCoordinates = data.latitude != null && data.longitude != null;
    const status = coordinatesChanged
      ? changed?.geocode_status ?? data.geocode_status ?? 'NAO_GEOCODIFICADO'
      : changed?.geocode_status ?? current?.geocode_status ?? 'NAO_GEOCODIFICADO';
    return {
      coordinateSource: hasCoordinates
        ? changed?.coordinate_source ?? data.coordinate_source
          ?? current?.coordinate_source ?? 'MANUAL'
        : null,
      status,
      source: status === 'NAO_GEOCODIFICADO'
        ? null
        : changed?.geocode_source ?? data.geocode_source ?? current?.geocode_source ?? null,
      precision: status === 'GEOCODIFICADO'
        ? changed?.geocode_precision ?? data.geocode_precision
          ?? current?.geocode_precision ?? 'DESCONHECIDA'
        : null,
      geocodedAt: status === 'GEOCODIFICADO'
        ? changed?.geocoded_at ?? data.geocoded_at ?? current?.geocoded_at ?? null
        : null,
    };
  }
}
