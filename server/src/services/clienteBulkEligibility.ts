import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { ClienteBulkEligibilityGuard } from './clienteBulkAdapter.js';
import type { CadastroBulkRow, Eligibility } from './cadastroBulkPolicy.js';

const relations = ['cliente_empresas', 'cliente_locais', 'cliente_local_finalidades', 'obras', 'oportunidades'];
const coveredRelations = [...relations, 'entregas'];
const scope = z.object({ groupId: z.string().uuid(), empresaId: z.string().uuid().nullish(), actorId: z.string().uuid() });
const rowsSchema = z.array(z.object({ id: z.string().uuid(), group_id: z.string().uuid(),
  empresa_id: z.string().uuid().nullable(), ativo: z.boolean() }).passthrough()).max(500);
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
function unavailable(): never {
  throw new AppError(409, 'CLIENTE_BULK_COVERAGE_UNVERIFIED', 'Cliente relation coverage could not be verified');
}

/** Conservative PostgreSQL-master policy: any reference, including inactive history, prevents bulk inactivation.
 * External/JSON stores are not certified by this guard. HTTP activation still requires their ownership review.
 * No BYPASSRLS is granted: row_security=off makes incomplete visibility an error, never an empty result.
 */
export class PostgresClienteBulkEligibility implements ClienteBulkEligibilityGuard {
  async inspect(ctx: RequestContext, rawRows: readonly CadastroBulkRow[], q: DbQueryExecutor): Promise<Eligibility[]> {
    const identity = scope.parse(ctx), rows = rowsSchema.parse(rawRows);
    if (new Set(rows.map(row => row.id)).size !== rows.length || rows.some(row => row.group_id !== identity.groupId
      || (identity.empresaId != null && row.empresa_id !== identity.empresaId))) return unavailable();
    if (!rows.length) return [];
    const state = await q.query(`SELECT current_schema() AS schema,
      current_setting('transaction_isolation') AS isolation,
      current_setting('app.group_id',true) AS group_id,
      NULLIF(current_setting('app.empresa_id',true),'') AS empresa_id,
      current_setting('row_security') AS row_security`);
    const session = z.object({ schema: z.string().min(1), isolation: z.literal('read committed'),
      group_id: z.literal(identity.groupId), empresa_id: z.literal(identity.empresaId ?? null),
      row_security: z.enum(['on', 'off']) }).safeParse(state.rows[0]);
    if (!session.success) return unavailable();
    const schema = session.data.schema;
    // Transaction-only, NOWAIT: never wait behind a writer holding a child then requesting a selected parent.
    // These locks also freeze FK/schema changes and non-FK opportunity writes until the caller commits.
    for (const table of ['clientes', ...coveredRelations].sort()) {
      await q.query(`LOCK TABLE ${quote(schema)}.${quote(table)} IN SHARE ROW EXCLUSIVE MODE NOWAIT`);
    }
    const catalog = await q.query(`SELECT c.relname AS name, c.relkind AS kind,
      EXISTS(SELECT 1 FROM pg_inherits i WHERE i.inhrelid=c.oid OR i.inhparent=c.oid) AS inherited
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND c.relname=ANY($2::text[])`, [schema, ['clientes', ...coveredRelations]]);
    const tables = z.array(z.object({ name: z.string(), kind: z.literal('r'), inherited: z.literal(false) })).safeParse(catalog.rows);
    if (!tables.success || tables.data.length !== 7
      || new Set(tables.data.map(table => table.name)).size !== 7
      || !['clientes', ...coveredRelations].every(name => tables.data.some(table => table.name === name))) return unavailable();
    const references = await q.query(`SELECT n.nspname AS schema, c.relname AS name, a.attname AS column,
      EXISTS(SELECT 1 FROM pg_constraint f
        WHERE f.contype='f' AND f.conrelid=c.oid AND f.confrelid=to_regclass($1)
          AND f.conkey=ARRAY[a.attnum] AND f.confkey=ARRAY[p.attnum] AND f.convalidated) AS canonical_fk
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute p ON p.attrelid=to_regclass($1) AND p.attname='id'
      WHERE a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p')
        AND (a.attname='cliente_id' OR EXISTS(SELECT 1 FROM pg_constraint f
          WHERE f.contype='f' AND f.conrelid=c.oid AND f.confrelid=to_regclass($1) AND a.attnum=ANY(f.conkey)))`,
    [`${quote(schema)}.clientes`]);
    const refs = z.array(z.object({ schema: z.string(), name: z.string(), column: z.string(), canonical_fk: z.boolean() })).parse(references.rows);
    if (refs.length !== coveredRelations.length || coveredRelations.some(name => !refs.some(ref => ref.schema === schema
      && ref.name === name && ref.column === 'cliente_id' && (['oportunidades', 'entregas'].includes(name) || ref.canonical_fk)))
      || refs.some(ref => ref.schema !== schema || !coveredRelations.includes(ref.name))) return unavailable();
    await q.query("SELECT set_config('row_security','off',true)");
    // Re-read parents under the same visibility proof. Never trust a snapshot read through a partial policy.
    const parents = await q.query(`SELECT id FROM ${quote(schema)}.clientes WHERE group_id=$1 AND id=ANY($2::uuid[])
      AND ($3::uuid IS NULL OR empresa_id=$3::uuid) FOR UPDATE`, [identity.groupId, rows.map(row => row.id), identity.empresaId ?? null]);
    if (parents.rows.length !== rows.length) return unavailable();
    const unresolved = await q.query(`SELECT EXISTS(SELECT 1 FROM ${quote(schema)}.oportunidades o
      WHERE o.group_id=$1 AND o.cliente_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM ${quote(schema)}.clientes c WHERE c.group_id=o.group_id
          AND c.id::text=lower(btrim(o.cliente_id)))) AS unresolved`, [identity.groupId]);
    const ambiguous = z.object({ unresolved: z.boolean() }).parse(unresolved.rows[0]).unresolved;
    // Entrega's cliente_id is a company-link identity, never evidence of a direct master ID.
    // No active/status filter: cancelled/completed deliveries remain historical references.
    const deliveries = await q.query(`SELECT EXISTS(SELECT 1 FROM ${quote(schema)}.entregas e
      WHERE (e.group_id=$1 OR e.cliente_id=ANY($2::uuid[]) OR e.cliente_empresa_id=ANY($2::uuid[])
        OR EXISTS(SELECT 1 FROM ${quote(schema)}.cliente_empresas linked
        WHERE linked.cliente_id=ANY($2::uuid[]) AND (linked.id=e.cliente_id OR linked.id=e.cliente_empresa_id)))
      AND NOT EXISTS(SELECT 1 FROM ${quote(schema)}.cliente_empresas ce
        JOIN ${quote(schema)}.clientes c ON c.id=ce.cliente_id AND c.group_id=ce.group_id
        WHERE ce.id=COALESCE(e.cliente_empresa_id,e.cliente_id)
          AND ce.group_id=e.group_id AND ce.empresa_id=e.empresa_id
          AND (e.cliente_id IS NULL OR e.cliente_id=ce.id)
          AND (e.cliente_empresa_id IS NOT NULL OR NOT EXISTS(
            SELECT 1 FROM ${quote(schema)}.clientes direct WHERE direct.id=e.cliente_id)))) AS unresolved`,
    [identity.groupId, rows.map(row => row.id)]);
    if (z.object({ unresolved: z.boolean() }).parse(deliveries.rows[0]).unresolved) return unavailable();
    const blocked = new Set<string>();
    const deliveryLinks = await q.query(`SELECT DISTINCT ce.cliente_id::text AS id
      FROM ${quote(schema)}.entregas e JOIN ${quote(schema)}.cliente_empresas ce
        ON ce.id=e.cliente_id OR ce.id=e.cliente_empresa_id
      WHERE ce.cliente_id=ANY($1::uuid[])`, [rows.map(row => row.id)]);
    for (const ref of z.array(z.object({ id: z.string().uuid() })).parse(deliveryLinks.rows)) blocked.add(ref.id);
    for (const table of relations) {
      // No tenant/active predicate: a cross-company or malformed cross-group link must also prevent inactivation.
      const result = await q.query(`SELECT DISTINCT lower(btrim(cliente_id::text)) AS id FROM ${quote(schema)}.${quote(table)}
        WHERE lower(btrim(cliente_id::text))=ANY($1::text[])`, [rows.map(row => row.id)]);
      for (const ref of z.array(z.object({ id: z.string().uuid() })).parse(result.rows)) blocked.add(ref.id);
    }
    await q.query("SELECT set_config('row_security',$1,true)", [session.data.row_security]);
    return rows.map(row => ({ id: row.id, allowed: !ambiguous && !blocked.has(row.id),
      reasons: [...(ambiguous ? ['CLIENTE_LEGACY_REFERENCES_UNRESOLVED'] : []),
        ...(blocked.has(row.id) ? ['CLIENTE_HAS_REFERENCES'] : [])] }));
  }
}
