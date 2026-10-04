import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { PGlite } from '@electric-sql/pglite';

/** Only the dedicated ephemeral CI database is accepted; never fall back to DATABASE_URL. */
export async function isolatedPostgres(url: string): Promise<PGlite> {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !['localhost', '127.0.0.1'].includes(parsed.hostname)
    || parsed.pathname !== '/erp_omnichannel_test' || parsed.username !== 'erp_test'
    || parsed.search || parsed.hash) throw new Error('Omnichannel test database is not isolated');
  const schema = `omni_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: url, max: 10, options: `-c search_path=${schema},public` });
  const executor = (query: (sql: string, params?: unknown[]) => Promise<unknown>) => ({ query,
    exec: (sql: string) => query(sql),
  });
  // Same fixture SQL/canonical services as PGlite; actual independent pg pool clients per transaction.
  return {
    ...executor((sql, params) => pool.query(sql, params)),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const value = await fn(executor((sql, params) => client.query(sql, params)));
        await client.query('COMMIT'); return value;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: async () => {
      await pool.end();
      // Identifier was generated here, contains only a fixed prefix and hex; no public schema changes.
      try { await admin.query(`DROP SCHEMA ${schema} CASCADE`); } finally { await admin.end(); }
    },
  } as unknown as PGlite;
}
