import type { DbClient, DbQueryExecutor } from '../db/client.js';
import { reserveEntityCodigo } from './reserveEntityCodigo.js';
import { fornecedorRowSchema, type FornecedorImport, type Fornecedor } from './fornecedorTypes.js';

/** Existing master fields, not a second entity store or opaque payload table. */
export class PostgresFornecedorRepository {
  constructor(readonly db: DbClient) {}

  async byIdentity(groupId: string, source: string, legacy: string, q: DbQueryExecutor) {
    const r = await q.query('SELECT * FROM fornecedores WHERE group_id=$1 AND source_system=$2 AND codigo_legado=$3 FOR UPDATE',
      [groupId, source, legacy]);
    return r.rows[0] ? this.decode(r.rows[0]) : null;
  }
  async byId(groupId: string, id: string, q: DbQueryExecutor) {
    const r = await q.query('SELECT * FROM fornecedores WHERE group_id=$1 AND id=$2 FOR UPDATE', [groupId, id]);
    return r.rows[0] ? this.decode(r.rows[0]) : null;
  }
  async conflict(groupId: string, data: FornecedorImport, q: DbQueryExecutor) {
    return (await q.query('SELECT id FROM fornecedores WHERE group_id=$1 AND (cpf_cnpj=$2 OR codigo=$3) LIMIT 1',
      [groupId, data.cpf_cnpj, data.codigo])).rows.length > 0;
  }
  async create(groupId: string, actor: string, data: FornecedorImport, q: DbQueryExecutor): Promise<Fornecedor> {
    const codigo = await reserveEntityCodigo({ db: q, groupId, entityName: 'fornecedor',
      table: 'fornecedores', incomingCodigo: data.codigo });
    const fields = Object.keys(data);
    const values = Object.values({ ...data, codigo });
    const sql = `INSERT INTO fornecedores (${fields.join(',')},group_id,created_by,updated_by,ativo,origem)
      VALUES (${values.map((_, i) => '$' + (i + 1)).join(',')},$${values.length + 1},$${values.length + 2},$${values.length + 2},$${values.length + 3},'MIGRACAO') RETURNING *`;
    const r = await q.query(sql, [...values, groupId, actor, data.status === 'Ativo']);
    if (r.rowCount !== 1) throw new Error('FORNECEDOR_INSERT_FAILED');
    return this.decode(r.rows[0]);
  }
  async deactivate(groupId: string, actor: string, id: string, revision: number, q: DbQueryExecutor) {
    const r = await q.query(`UPDATE fornecedores SET ativo=false,status='Inativo',updated_by=$1,
      updated_at=now(),revision=revision+1 WHERE group_id=$2 AND id=$3 AND revision=$4 RETURNING *`,
    [actor, groupId, id, revision]);
    if (r.rowCount !== 1) throw new Error('FORNECEDOR_REVISION_CONFLICT');
    return this.decode(r.rows[0]);
  }
  private decode(value: unknown): Fornecedor {
    // Parse the business projection separately: its strict schema rejects unknown input.
    const row = fornecedorRowSchema.safeParse(value);
    if (!row.success) throw new Error('FORNECEDOR_DATABASE_ROW_INVALID');
    return row.data;
  }
}
