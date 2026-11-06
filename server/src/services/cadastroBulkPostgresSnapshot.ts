import { z } from 'zod';
import { AppError } from '../api/errors.js';
import type { DbQueryExecutor } from '../db/client.js';
import type { CadastroBulkRow } from './cadastroBulkPolicy.js';

const timestamp = z.string().datetime({ offset: true });

/** Matches set_updated_at(), including the database cast and full microsecond JSON representation. */
export async function expectedPostgresBulkRestore(before: CadastroBulkRow, q: DbQueryExecutor): Promise<CadastroBulkRow> {
  if (!timestamp.safeParse(before.updated_at).success) {
    throw new AppError(409, 'BULK_TIMESTAMP_INVALID', 'Original database timestamp required');
  }
  const result = await q.query("SELECT to_jsonb(timezone('utc',now())::timestamptz) AS updated_at");
  const updatedAt = timestamp.safeParse(result.rows[0]?.updated_at);
  if (!updatedAt.success) throw new AppError(409, 'BULK_TIMESTAMP_INVALID', 'Database timestamp unavailable');
  return { ...before, updated_at: updatedAt.data };
}
