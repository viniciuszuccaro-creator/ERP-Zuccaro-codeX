import type { DbClient,DbQueryExecutor } from '../db/client.js';
import { AppError } from '../api/errors.js';

export type ProdutoRelationIds = {
  marcaId?: string | null;
  unidadeMedidaId?: string | null;
  requireActiveUnit?: boolean;
  grupoProdutoId?: string | null;
  setorAtividadeId?: string | null;
};

export interface ProdutoRelationGuard {
  assertRelationsInGroup(groupId: string, relations: ProdutoRelationIds,executor?:DbQueryExecutor): Promise<void>;
}

export class PostgresProdutoRelationGuard implements ProdutoRelationGuard {
  constructor(private readonly db: DbClient) {}

  async assertRelationsInGroup(groupId: string, relations: ProdutoRelationIds,executor?:DbQueryExecutor): Promise<void> {
    await assertOne(executor??this.db, 'marcas', relations.marcaId, groupId, 'marca_id');
    await assertOne(executor??this.db, 'unidades_medida', relations.unidadeMedidaId, groupId, 'unidade_medida_id', relations.requireActiveUnit === true);
    await assertOne(executor??this.db, 'grupos_produto', relations.grupoProdutoId, groupId, 'grupo_produto_id');
    await assertOne(executor??this.db, 'setores_atividade', relations.setorAtividadeId, groupId, 'setor_atividade_id');
  }
}

async function assertOne(
  db: DbQueryExecutor,
  table: string,
  id: string | null | undefined,
  groupId: string,
  field: string,
  requireActive = false,
) {
  if (!id) return;
  const result = await db.query(
    `SELECT 1 AS ok FROM ${table} WHERE id = $1 AND group_id = $2${requireActive ? ' AND ativo=true' : ''} LIMIT 1${requireActive ? ' FOR SHARE' : ''}`,
    [id, groupId],
  );
  if (!result.rows[0]) {
    throw new AppError(
      409,
      'TENANT_FK_MISMATCH',
      `${field} does not belong to the informed group_id`,
      { field, id, groupId },
    );
  }
}

/** In-memory: maps entityId -> groupId per relation table. */
export class InMemoryProdutoRelationGuard implements ProdutoRelationGuard {
  private readonly inactiveUnits = new Set<string>();
  private readonly maps = {
    marca: new Map<string, string>(),
    unidade: new Map<string, string>(),
    grupo: new Map<string, string>(),
    setor: new Map<string, string>(),
  };

  linkMarca(id: string, groupId: string) { this.maps.marca.set(id, groupId); }
  linkUnidade(id: string, groupId: string, ativo = true) { this.maps.unidade.set(id, groupId);if(ativo)this.inactiveUnits.delete(id);else this.inactiveUnits.add(id); }
  linkGrupo(id: string, groupId: string) { this.maps.grupo.set(id, groupId); }
  linkSetor(id: string, groupId: string) { this.maps.setor.set(id, groupId); }

  async assertRelationsInGroup(groupId: string, relations: ProdutoRelationIds,executor?:DbQueryExecutor): Promise<void> {
    check(this.maps.marca, relations.marcaId, groupId, 'marca_id');
    check(this.maps.unidade, relations.unidadeMedidaId, groupId, 'unidade_medida_id');
    if (relations.requireActiveUnit && relations.unidadeMedidaId && this.inactiveUnits.has(relations.unidadeMedidaId)) throw new AppError(409,'TENANT_FK_MISMATCH','Imported unit is inactive');
    check(this.maps.grupo, relations.grupoProdutoId, groupId, 'grupo_produto_id');
    check(this.maps.setor, relations.setorAtividadeId, groupId, 'setor_atividade_id');
  }
}

function check(
  map: Map<string, string>,
  id: string | null | undefined,
  groupId: string,
  field: string,
) {
  if (!id) return;
  if (map.get(id) !== groupId) {
    throw new AppError(
      409,
      'TENANT_FK_MISMATCH',
      `${field} does not belong to the informed group_id`,
      { field, id, groupId },
    );
  }
}
