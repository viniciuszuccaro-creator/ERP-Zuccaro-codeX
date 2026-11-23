import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { DbQueryExecutor } from '../db/client.js';

// Existing Cliente fields missing from SQL, not a second legacy payload store.
const text = (max: number) => z.string().min(1).max(max)
  .refine(v => v === v.trim() && !/[\u0000-\u001f\u007f<>]/.test(v), 'invalid_master_text');
export const clienteMasterExtraFields = {
  rg: text(30).nullable().optional(),
  numero_caixa_postal: text(40).nullable().optional(),
  cep_caixa_postal: z.string().regex(/^\d{8}$/).refine(v => v !== '00000000').nullable().optional(),
  caixa_postal_cobranca: text(40).nullable().optional(),
  inscricao_produtor_rural: text(40).nullable().optional(),
};
export const clienteMasterExtrasSchema = z.object(clienteMasterExtraFields).strict();
export const clienteMasterExtraKeys = Object.keys(clienteMasterExtraFields) as (keyof typeof clienteMasterExtraFields)[];
export type ClienteMasterExtras = z.infer<typeof clienteMasterExtrasSchema>;

/** Missing columns stay absent. NULL is not fabricated for an older schema. */
export function projectClienteMasterExtras(row: Record<string, unknown>): ClienteMasterExtras {
  return clienteMasterExtrasSchema.parse(Object.fromEntries(clienteMasterExtraKeys
    .filter(key => Object.hasOwn(row, key) && row[key] !== undefined).map(key => [key, row[key]])));
}

/** Column identifiers come only from the static allowlist; values are always parameters. */
export function clienteMasterExtraWrite(data: ClienteMasterExtras, offset: number) {
  const entries = Object.entries(projectClienteMasterExtras(data));
  return { columns: entries.map(([key]) => key), values: entries.map(([,value]) => value),
    placeholders: entries.map((_,i) => '$' + (offset+i+1)),
    assignments: entries.map(([key],i) => key + '=$' + (offset+i+1)) };
}

export async function assertClienteMasterExtraStorage(db: DbQueryExecutor, columns: string[]) {
  if (!columns.length) return;
  const result = await db.query<{ name: string; compatible: boolean }>(`SELECT a.attname AS name,
    a.atttypid='text'::regtype AND NOT a.attnotnull AND a.atthasdef=false AS compatible
    FROM pg_attribute a WHERE a.attrelid='clientes'::regclass AND a.attnum>0 AND NOT a.attisdropped
    AND a.attname=ANY($1::text[])`, [columns]);
  if (columns.some(key => !result.rows.some(row => row.name === key && row.compatible === true))) {
    throw new AppError(503, 'CLIENTE_MASTER_STORAGE_REQUIRED', 'Reviewed nullable master columns required');
  }
}
