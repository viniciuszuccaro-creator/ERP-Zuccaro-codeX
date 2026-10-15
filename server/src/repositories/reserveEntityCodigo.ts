import type { DbQueryExecutor } from '../db/client.js';

/**
 * Reserva código sequencial por grupo via reserve_entity_codigo.
 * Antes sincroniza high-water com MAX(codigo numérico) da tabela (importação fora de ordem).
 * Código alfanumérico legado não entra no high-water; não renumerar.
 */
export async function reserveEntityCodigo(options: {
  db: DbQueryExecutor;
  groupId: string;
  entityName: string;
  table: string;
  width?: number;
  incomingCodigo?: string | null;
}): Promise<string> {
  const width = options.width ?? 6;
  const incoming = typeof options.incomingCodigo === 'string' ? options.incomingCodigo.trim() : '';

  await options.db.query(
    `WITH high_water AS (
       SELECT COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::bigint END), 0) + 1 AS next_value
       FROM ${options.table}
       WHERE group_id = $1
     )
     INSERT INTO entity_code_sequences(group_id, entity_name, next_value)
     SELECT $1, $2, high_water.next_value FROM high_water
     ON CONFLICT (group_id, entity_name) DO UPDATE
     SET next_value = GREATEST(entity_code_sequences.next_value, EXCLUDED.next_value),
         updated_at = timezone('utc', now())`,
    [options.groupId, options.entityName],
  );

  if (incoming) {
    // Importação / código explícito: não reserva novo; sobe sequência se numérico maior
    if (/^[0-9]+$/.test(incoming)) {
      const n = Number.parseInt(incoming, 10);
      if (Number.isFinite(n) && n > 0) {
        await options.db.query(
          `INSERT INTO entity_code_sequences(group_id, entity_name, next_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (group_id, entity_name) DO UPDATE
           SET next_value = GREATEST(entity_code_sequences.next_value, EXCLUDED.next_value),
               updated_at = timezone('utc', now())`,
          [options.groupId, options.entityName, n + 1],
        );
      }
    }
    return incoming;
  }

  const result = await options.db.query<{ codigo: string }>(
    'SELECT reserve_entity_codigo($1, $2, $3) AS codigo',
    [options.groupId, options.entityName, width],
  );
  const codigo = result.rows[0]?.codigo;
  if (!codigo) throw new Error(`${options.entityName}_CODIGO_RESERVATION_FAILED`);
  return codigo;
}
