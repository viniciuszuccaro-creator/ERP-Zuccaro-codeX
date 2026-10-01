import type { DbClient, DbQueryExecutor } from '../db/client.js';
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
  type SeparacaoStatus,
} from './expedicaoTypes.js';

type Row = Record<string, unknown>;

const asIso = (value: unknown) => (value == null ? null : new Date(String(value)).toISOString());
const asStr = (value: unknown) => (value == null ? null : String(value));
const asJson = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
};

function mapItem(row: Row): EntregaItem {
  return {
    id: String(row.id),
    produto_id: row.produto_id == null ? null : String(row.produto_id),
    descricao: String(row.descricao_snapshot),
    unidade_sigla: String(row.unidade_snapshot),
    quantidade_pedida: String(row.quantidade_pedida),
    quantidade_separada: String(row.quantidade_separada),
    quantidade_entregue: String(row.quantidade_entregue),
    quantidade_devolvida: String(row.quantidade_devolvida),
  };
}

function mapEntrega(row: Row, itens: EntregaItem[] = []): Entrega {
  const status = row.status as EntregaStatus;
  const qr = asStr(row.qr_code) || `ENT-${String(row.numero)}`;
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    empresa_id: String(row.empresa_id),
    numero: String(row.numero),
    status,
    status_label: entregaStatusToLabel(status),
    pedido_id: asStr(row.pedido_id),
    pedido_numero: asStr(row.pedido_numero),
    cliente_id: asStr(row.cliente_id),
    cliente_nome: asStr(row.cliente_nome),
    cliente_empresa_id: asStr(row.cliente_empresa_id),
    cliente_local_id: asStr(row.cliente_local_id),
    tipo_frete: (row.tipo_frete as 'ENTREGA' | 'RETIRADA') || 'ENTREGA',
    data_entrega_solicitada: asIso(row.data_entrega_solicitada),
    data_previsao: asIso(row.data_previsao),
    data_saida: asIso(row.data_saida),
    data_entrega: asIso(row.data_entrega),
    romaneio_id: asStr(row.romaneio_id),
    motorista_id: asStr(row.motorista_id),
    motorista_nome: asStr(row.motorista_nome),
    veiculo: asStr(row.veiculo),
    placa: asStr(row.placa),
    sequencia_rota: row.sequencia_rota == null ? null : Number(row.sequencia_rota),
    cidade: asStr(row.cidade),
    endereco: asJson(row.endereco_json),
    comprovante_entrega: asJson(row.comprovante_json),
    entrega_parcial: asJson(row.entrega_parcial_json),
    entrega_frustrada: asJson(row.entrega_frustrada_json),
    logistica_reversa: asJson(row.logistica_reversa_json),
    quantidade_total: String(row.quantidade_total ?? '0'),
    volumes: String(row.volumes ?? '0'),
    observacoes: asStr(row.observacoes),
    idempotency_key: asStr(row.idempotency_key),
    qr_code: qr,
    numero_entrega: asStr(row.numero) ? qr : qr,
    ativo: Boolean(row.ativo),
    itens,
    created_at: asIso(row.created_at)!,
    updated_at: asIso(row.updated_at)!,
  };
}

function mapRomaneio(row: Row, entregasIds: string[] = []): Romaneio {
  return {
    id: String(row.id),
    group_id: String(row.group_id),
    empresa_id: String(row.empresa_id),
    numero: String(row.numero),
    status: row.status as RomaneioStatus,
    data_romaneio: String(row.data_romaneio).slice(0, 10),
    data_saida: asIso(row.data_saida),
    motorista_id: asStr(row.motorista_id),
    motorista_nome: String(row.motorista_nome),
    veiculo: String(row.veiculo),
    placa: String(row.placa),
    tipo_veiculo: String(row.tipo_veiculo || 'Caminhao'),
    entregas_ids: entregasIds,
    entregas_key: String(row.entregas_key),
    quantidade_entregas: Number(row.quantidade_entregas || 0),
    instrucoes_motorista: asStr(row.instrucoes_motorista),
    checklist_saida: asJson(row.checklist_saida_json),
    idempotency_key: asStr(row.idempotency_key),
    ativo: Boolean(row.ativo),
    created_at: asIso(row.created_at)!,
    updated_at: asIso(row.updated_at)!,
  };
}

export class PostgresExpedicaoRepository implements ExpedicaoRepository {
  constructor(private readonly db: DbClient) {}
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T> { return this.db.withTransaction(fn); }
  private run<T>(executor: DbQueryExecutor | undefined, fn: (query: DbQueryExecutor) => Promise<T>): Promise<T> {
    return executor ? fn(executor) : this.db.withTransaction(fn);
  }

  private async loadItens(query: DbQueryExecutor, scope: ExpedicaoScope, entregaId: string): Promise<EntregaItem[]> {
    const result = await query.query<Row>(
      'SELECT * FROM entrega_itens WHERE entrega_id=$1 AND group_id=$2 AND empresa_id=$3 AND ativo ORDER BY created_at,id',
      [entregaId, scope.groupId, scope.empresaId],
    );
    return result.rows.map(mapItem);
  }

  private async loadRomaneioEntregas(query: DbQueryExecutor, scope: ExpedicaoScope, romaneioId: string): Promise<string[]> {
    const result = await query.query<{ entrega_id: string }>(
      'SELECT entrega_id FROM romaneio_entregas WHERE romaneio_id=$1 AND group_id=$2 AND empresa_id=$3 ORDER BY sequencia',
      [romaneioId, scope.groupId, scope.empresaId],
    );
    return result.rows.map((r) => String(r.entrega_id));
  }

  async getEntrega(scope: ExpedicaoScope, id: string, executor: DbQueryExecutor = this.db): Promise<Entrega | null> {
    const result = await executor.query<Row>(
      'SELECT * FROM entregas WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
      [id, scope.groupId, scope.empresaId],
    );
    if (!result.rows[0]) return null;
    return mapEntrega(result.rows[0], await this.loadItens(executor, scope, id));
  }

  async getEntregaByPedido(scope: ExpedicaoScope, pedidoId: string, executor: DbQueryExecutor = this.db): Promise<Entrega | null> {
    const result = await executor.query<Row>(
      "SELECT * FROM entregas WHERE pedido_id=$1 AND group_id=$2 AND empresa_id=$3 AND status <> 'CANCELADA' ORDER BY created_at DESC LIMIT 1",
      [pedidoId, scope.groupId, scope.empresaId],
    );
    if (!result.rows[0]) return null;
    const id = String(result.rows[0].id);
    return mapEntrega(result.rows[0], await this.loadItens(executor, scope, id));
  }

  async getEntregaByIdempotency(scope: ExpedicaoScope, key: string, executor: DbQueryExecutor = this.db): Promise<Entrega | null> {
    const result = await executor.query<Row>(
      'SELECT * FROM entregas WHERE idempotency_key=$1 AND group_id=$2 AND empresa_id=$3 LIMIT 1',
      [key, scope.groupId, scope.empresaId],
    );
    if (!result.rows[0]) return null;
    const id = String(result.rows[0].id);
    return mapEntrega(result.rows[0], await this.loadItens(executor, scope, id));
  }

  private async insertItems(query: DbQueryExecutor, scope: ExpedicaoScope, entregaId: string, data: EntregaCreate, actorId: string) {
    for (const item of data.itens) {
      await query.query(
        `INSERT INTO entrega_itens(group_id,empresa_id,entrega_id,produto_id,descricao_snapshot,unidade_snapshot,
          quantidade_pedida,quantidade_separada,quantidade_entregue,quantidade_devolvida,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
        [
          scope.groupId, scope.empresaId, entregaId, item.produto_id ?? null, item.descricao, item.unidade_sigla || 'UN',
          item.quantidade_pedida, item.quantidade_separada ?? '0', item.quantidade_entregue ?? '0', item.quantidade_devolvida ?? '0', actorId,
        ],
      );
    }
  }

  async createEntrega(scope: ExpedicaoScope, data: EntregaCreate, actorId: string, executor?: DbQueryExecutor): Promise<Entrega> {
    return this.run(executor, async (query) => {
      if (data.idempotency_key) {
        const existing = await this.getEntregaByIdempotency(scope, data.idempotency_key, query);
        if (existing) return existing;
      }
      if (data.pedido_id) {
        const byPedido = await this.getEntregaByPedido(scope, data.pedido_id, query);
        if (byPedido) return byPedido;
      }
      await query.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`entrega:${scope.empresaId}`]);
      const sequence = await query.query<{ next: string }>('SELECT COALESCE(MAX(numero::int),0)+1 next FROM entregas WHERE empresa_id=$1', [scope.empresaId]);
      const numero = String(sequence.rows[0]?.next ?? '').padStart(8, '0');
      if (!/^\d{8}$/.test(numero)) throw new Error('ENTREGA_NUMERO_RESERVATION_FAILED');
      const total = sumQty(data.itens.map((i) => i.quantidade_pedida));
      const inserted = await query.query<{ id: string }>(
        `INSERT INTO entregas(group_id,empresa_id,numero,pedido_id,pedido_numero,cliente_id,cliente_nome,cliente_empresa_id,cliente_local_id,
          tipo_frete,data_entrega_solicitada,data_previsao,cidade,endereco_json,quantidade_total,volumes,observacoes,idempotency_key,qr_code,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$20) RETURNING id`,
        [
          scope.groupId, scope.empresaId, numero, data.pedido_id ?? null, data.pedido_numero ?? null,
          data.cliente_id ?? null, data.cliente_nome ?? null, data.cliente_empresa_id ?? null, data.cliente_local_id ?? null,
          data.tipo_frete ?? 'ENTREGA', data.data_entrega_solicitada ?? null, data.data_previsao ?? null,
          data.cidade ?? null, JSON.stringify(data.endereco ?? {}), total, data.volumes ?? total,
          data.observacoes ?? null, data.idempotency_key ?? null, `ENT-${numero}`, actorId,
        ],
      );
      const id = String(inserted.rows[0]?.id);
      await this.insertItems(query, scope, id, data, actorId);
      await query.query(
        'INSERT INTO entrega_historico(group_id,empresa_id,entrega_id,status_anterior,status_novo,actor_id) VALUES($1,$2,$3,NULL,$4,$5)',
        [scope.groupId, scope.empresaId, id, 'AGUARDANDO_SEPARACAO', actorId],
      );
      return (await this.getEntrega(scope, id, query))!;
    });
  }

  async listEntregas(scope: ExpedicaoScope, limit = 50, offset = 0, executor?: DbQueryExecutor, filters: EntregaListFilters = {}) {
    const query = executor ?? this.db;
    const where = `group_id=$1 AND empresa_id=$2
      AND ($3::text IS NULL OR numero ILIKE '%'||$3||'%' OR COALESCE(pedido_numero,'') ILIKE '%'||$3||'%' OR COALESCE(cliente_nome,'') ILIKE '%'||$3||'%' OR COALESCE(cidade,'') ILIKE '%'||$3||'%')
      AND ($4::text IS NULL OR status=$4)
      AND ($5::uuid IS NULL OR pedido_id=$5)
      AND ($6::text IS NULL OR COALESCE(cidade,'') ILIKE '%'||$6||'%')
      AND ($7::uuid IS NULL OR cliente_id=$7)`;
    const filterParams = [scope.groupId, scope.empresaId, filters.search || null, filters.status || null, filters.pedidoId || null, filters.cidade || null, filters.clienteId || null];
    const params = [...filterParams, Math.min(200, Math.max(1, Math.trunc(limit))), Math.max(0, Math.trunc(offset))];
    const [count, rows] = await Promise.all([
      query.query<{ total: number }>(`SELECT count(*)::int total FROM entregas WHERE ${where}`, filterParams),
      query.query<Row>(`SELECT * FROM entregas WHERE ${where} ORDER BY numero DESC,id DESC LIMIT $8 OFFSET $9`, params),
    ]);
    const mapped: Entrega[] = [];
    for (const row of rows.rows) {
      mapped.push(mapEntrega(row, await this.loadItens(query, scope, String(row.id))));
    }
    return { rows: mapped, total: Number(count.rows[0]?.total ?? 0) };
  }

  async updateEntregaRow(scope: ExpedicaoScope, id: string, patch: Partial<Entrega> & { itens?: EntregaItem[] }, actorId: string, executor?: DbQueryExecutor): Promise<Entrega | null> {
    return this.run(executor, async (query) => {
      const current = await this.getEntrega(scope, id, query);
      if (!current) return null;
      await query.query(
        `UPDATE entregas SET
          status=COALESCE($4,status),
          data_saida=COALESCE($5,data_saida),
          data_entrega=COALESCE($6,data_entrega),
          romaneio_id=COALESCE($7,romaneio_id),
          motorista_id=COALESCE($8,motorista_id),
          motorista_nome=COALESCE($9,motorista_nome),
          veiculo=COALESCE($10,veiculo),
          placa=COALESCE($11,placa),
          sequencia_rota=COALESCE($12,sequencia_rota),
          comprovante_json=COALESCE($13::jsonb,comprovante_json),
          entrega_parcial_json=COALESCE($14::jsonb,entrega_parcial_json),
          entrega_frustrada_json=COALESCE($15::jsonb,entrega_frustrada_json),
          logistica_reversa_json=COALESCE($16::jsonb,logistica_reversa_json),
          observacoes=COALESCE($17,observacoes),
          ativo=COALESCE($18,ativo),
          updated_by=$19
         WHERE id=$1 AND group_id=$2 AND empresa_id=$3`,
        [
          id, scope.groupId, scope.empresaId,
          patch.status ?? null,
          patch.data_saida ?? null,
          patch.data_entrega ?? null,
          patch.romaneio_id ?? null,
          patch.motorista_id ?? null,
          patch.motorista_nome ?? null,
          patch.veiculo ?? null,
          patch.placa ?? null,
          patch.sequencia_rota ?? null,
          patch.comprovante_entrega ? JSON.stringify(patch.comprovante_entrega) : null,
          patch.entrega_parcial ? JSON.stringify(patch.entrega_parcial) : null,
          patch.entrega_frustrada ? JSON.stringify(patch.entrega_frustrada) : null,
          patch.logistica_reversa ? JSON.stringify(patch.logistica_reversa) : null,
          patch.observacoes ?? null,
          patch.ativo ?? null,
          actorId,
        ],
      );
      if (patch.itens) {
        for (const item of patch.itens) {
          await query.query(
            `UPDATE entrega_itens SET quantidade_separada=$4,quantidade_entregue=$5,quantidade_devolvida=$6,updated_by=$7
             WHERE id=$1 AND entrega_id=$8 AND group_id=$2 AND empresa_id=$3`,
            [item.id, scope.groupId, scope.empresaId, item.quantidade_separada, item.quantidade_entregue, item.quantidade_devolvida, actorId, id],
          );
        }
      }
      return this.getEntrega(scope, id, query);
    });
  }

  async changeEntregaStatus(
    scope: ExpedicaoScope,
    id: string,
    status: EntregaStatus,
    actorId: string,
    motivo?: string,
    idempotencyKey?: string,
    executor?: DbQueryExecutor,
  ): Promise<Entrega | null> {
    return this.run(executor, async (query) => {
      const current = await this.getEntrega(scope, id, query);
      if (!current) return null;
      if (idempotencyKey) {
        const hit = await query.query<{ id: string }>(
          'SELECT id FROM entrega_historico WHERE empresa_id=$1 AND entrega_id=$2 AND idempotency_key=$3 LIMIT 1',
          [scope.empresaId, id, idempotencyKey],
        );
        if (hit.rows[0]) return current;
      }
      await query.query(
        'UPDATE entregas SET status=$4,ativo=$5,updated_by=$6 WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [id, scope.groupId, scope.empresaId, status, status !== 'CANCELADA', actorId],
      );
      await query.query(
        'INSERT INTO entrega_historico(group_id,empresa_id,entrega_id,status_anterior,status_novo,actor_id,motivo,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [scope.groupId, scope.empresaId, id, current.status, status, actorId, motivo ?? null, idempotencyKey ?? null],
      );
      return this.getEntrega(scope, id, query);
    });
  }

  async historyEntrega(scope: ExpedicaoScope, id: string, executor?: DbQueryExecutor): Promise<EntregaHistorico[]> {
    const result = await (executor ?? this.db).query<Row>(
      'SELECT * FROM entrega_historico WHERE entrega_id=$1 AND group_id=$2 AND empresa_id=$3 ORDER BY ordem',
      [id, scope.groupId, scope.empresaId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      group_id: String(row.group_id),
      empresa_id: String(row.empresa_id),
      entrega_id: String(row.entrega_id),
      status_anterior: row.status_anterior == null ? null : row.status_anterior as EntregaStatus,
      status_novo: row.status_novo as EntregaStatus,
      actor_id: String(row.actor_id),
      motivo: asStr(row.motivo),
      idempotency_key: asStr(row.idempotency_key),
      created_at: asIso(row.created_at)!,
    }));
  }

  async createSeparacao(scope: ExpedicaoScope, row: Omit<Separacao, 'id' | 'created_at' | 'updated_at'>, actorId: string, executor?: DbQueryExecutor): Promise<Separacao> {
    return this.run(executor, async (query) => {
      const existing = await this.getSeparacaoByEntrega(scope, row.entrega_id, row.tipo, query);
      if (existing) return existing;
      const inserted = await query.query<Row>(
        `INSERT INTO separacoes(group_id,empresa_id,entrega_id,pedido_id,tipo,status,tem_divergencia,divergencias_resumo,checklist_json,itens_json,idempotency_key,ativo,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$13)
         RETURNING *`,
        [
          scope.groupId, scope.empresaId, row.entrega_id, row.pedido_id, row.tipo, row.status,
          row.tem_divergencia, row.divergencias_resumo, JSON.stringify(row.checklist), JSON.stringify(row.itens),
          row.idempotency_key, row.ativo, actorId,
        ],
      );
      const r = inserted.rows[0];
      return {
        id: String(r.id),
        group_id: String(r.group_id),
        empresa_id: String(r.empresa_id),
        entrega_id: String(r.entrega_id),
        pedido_id: asStr(r.pedido_id),
        tipo: String(r.tipo),
        status: r.status as SeparacaoStatus,
        tem_divergencia: Boolean(r.tem_divergencia),
        divergencias_resumo: asStr(r.divergencias_resumo),
        checklist: asJson(r.checklist_json),
        itens: Array.isArray(r.itens_json) ? r.itens_json as unknown[] : JSON.parse(String(r.itens_json || '[]')),
        idempotency_key: asStr(r.idempotency_key),
        ativo: Boolean(r.ativo),
        created_at: asIso(r.created_at)!,
        updated_at: asIso(r.updated_at)!,
      };
    });
  }

  async getSeparacaoByEntrega(scope: ExpedicaoScope, entregaId: string, tipo = 'conferencia', executor: DbQueryExecutor = this.db): Promise<Separacao | null> {
    const result = await executor.query<Row>(
      'SELECT * FROM separacoes WHERE entrega_id=$1 AND group_id=$2 AND empresa_id=$3 AND tipo=$4 LIMIT 1',
      [entregaId, scope.groupId, scope.empresaId, tipo],
    );
    if (!result.rows[0]) return null;
    const r = result.rows[0];
    return {
      id: String(r.id),
      group_id: String(r.group_id),
      empresa_id: String(r.empresa_id),
      entrega_id: String(r.entrega_id),
      pedido_id: asStr(r.pedido_id),
      tipo: String(r.tipo),
      status: r.status as SeparacaoStatus,
      tem_divergencia: Boolean(r.tem_divergencia),
      divergencias_resumo: asStr(r.divergencias_resumo),
      checklist: asJson(r.checklist_json),
      itens: Array.isArray(r.itens_json) ? r.itens_json as unknown[] : JSON.parse(String(r.itens_json || '[]')),
      idempotency_key: asStr(r.idempotency_key),
      ativo: Boolean(r.ativo),
      created_at: asIso(r.created_at)!,
      updated_at: asIso(r.updated_at)!,
    };
  }

  async createRomaneio(scope: ExpedicaoScope, data: RomaneioCreate & { entregas_key: string }, actorId: string, executor?: DbQueryExecutor): Promise<Romaneio> {
    return this.run(executor, async (query) => {
      if (data.idempotency_key) {
        const byIdem = await this.getRomaneioByIdempotency(scope, data.idempotency_key, query);
        if (byIdem) return byIdem;
      }
      const key = data.entregas_key || sortedEntregasKey(data.entregas_ids);
      const byKey = await this.getRomaneioByEntregasKey(scope, key, query);
      if (byKey && byKey.status !== 'CANCELADO') return byKey;
      await query.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`romaneio:${scope.empresaId}`]);
      const sequence = await query.query<{ next: string }>('SELECT COALESCE(MAX(numero::int),0)+1 next FROM romaneios WHERE empresa_id=$1', [scope.empresaId]);
      const numero = String(sequence.rows[0]?.next ?? '').padStart(8, '0');
      if (!/^\d{8}$/.test(numero)) throw new Error('ROMANEIO_NUMERO_RESERVATION_FAILED');
      const now = new Date().toISOString();
      const inserted = await query.query<{ id: string }>(
        `INSERT INTO romaneios(group_id,empresa_id,numero,status,data_romaneio,data_saida,motorista_id,motorista_nome,veiculo,placa,tipo_veiculo,
          entregas_key,quantidade_entregas,instrucoes_motorista,checklist_saida_json,idempotency_key,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$17) RETURNING id`,
        [
          scope.groupId, scope.empresaId, numero, data.despachar ? 'EM_ROTA' : 'APROVADO',
          now.slice(0, 10), data.despachar ? now : null,
          data.motorista_id ?? null, data.motorista_nome, data.veiculo, data.placa, data.tipo_veiculo || 'Caminhao',
          key, data.entregas_ids.length, data.instrucoes_motorista ?? null,
          JSON.stringify(data.checklist_saida), data.idempotency_key ?? null, actorId,
        ],
      );
      const id = String(inserted.rows[0]?.id);
      for (let i = 0; i < data.entregas_ids.length; i += 1) {
        await query.query(
          'INSERT INTO romaneio_entregas(group_id,empresa_id,romaneio_id,entrega_id,sequencia) VALUES($1,$2,$3,$4,$5)',
          [scope.groupId, scope.empresaId, id, data.entregas_ids[i], i + 1],
        );
      }
      return (await this.getRomaneio(scope, id, query))!;
    });
  }

  async getRomaneio(scope: ExpedicaoScope, id: string, executor: DbQueryExecutor = this.db): Promise<Romaneio | null> {
    const result = await executor.query<Row>(
      'SELECT * FROM romaneios WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
      [id, scope.groupId, scope.empresaId],
    );
    if (!result.rows[0]) return null;
    return mapRomaneio(result.rows[0], await this.loadRomaneioEntregas(executor, scope, id));
  }

  async getRomaneioByEntregasKey(scope: ExpedicaoScope, key: string, executor: DbQueryExecutor = this.db): Promise<Romaneio | null> {
    const result = await executor.query<Row>(
      'SELECT * FROM romaneios WHERE entregas_key=$1 AND group_id=$2 AND empresa_id=$3 LIMIT 1',
      [key, scope.groupId, scope.empresaId],
    );
    if (!result.rows[0]) return null;
    const id = String(result.rows[0].id);
    return mapRomaneio(result.rows[0], await this.loadRomaneioEntregas(executor, scope, id));
  }

  async getRomaneioByIdempotency(scope: ExpedicaoScope, key: string, executor: DbQueryExecutor = this.db): Promise<Romaneio | null> {
    const result = await executor.query<Row>(
      'SELECT * FROM romaneios WHERE idempotency_key=$1 AND group_id=$2 AND empresa_id=$3 LIMIT 1',
      [key, scope.groupId, scope.empresaId],
    );
    if (!result.rows[0]) return null;
    const id = String(result.rows[0].id);
    return mapRomaneio(result.rows[0], await this.loadRomaneioEntregas(executor, scope, id));
  }

  async listRomaneios(scope: ExpedicaoScope, limit = 50, offset = 0, executor?: DbQueryExecutor) {
    const query = executor ?? this.db;
    const where = 'group_id=$1 AND empresa_id=$2';
    const filterParams = [scope.groupId, scope.empresaId];
    const params = [...filterParams, Math.min(200, Math.max(1, Math.trunc(limit))), Math.max(0, Math.trunc(offset))];
    const [count, rows] = await Promise.all([
      query.query<{ total: number }>(`SELECT count(*)::int total FROM romaneios WHERE ${where}`, filterParams),
      query.query<Row>(`SELECT * FROM romaneios WHERE ${where} ORDER BY numero DESC,id DESC LIMIT $3 OFFSET $4`, params),
    ]);
    const mapped: Romaneio[] = [];
    for (const row of rows.rows) {
      mapped.push(mapRomaneio(row, await this.loadRomaneioEntregas(query, scope, String(row.id))));
    }
    return { rows: mapped, total: Number(count.rows[0]?.total ?? 0) };
  }

  async updateRomaneioStatus(scope: ExpedicaoScope, id: string, status: RomaneioStatus, actorId: string, executor?: DbQueryExecutor): Promise<Romaneio | null> {
    return this.run(executor, async (query) => {
      const current = await this.getRomaneio(scope, id, query);
      if (!current) return null;
      await query.query(
        'UPDATE romaneios SET status=$4,ativo=$5,updated_by=$6 WHERE id=$1 AND group_id=$2 AND empresa_id=$3',
        [id, scope.groupId, scope.empresaId, status, status !== 'CANCELADO', actorId],
      );
      return this.getRomaneio(scope, id, query);
    });
  }
}
