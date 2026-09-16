import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import pg from 'pg';
import type { AppConfig } from '../config/env.js';

const { Pool: PgPool } = pg;

export type DbClient = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
  withTransaction: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
  checkConnection: () => Promise<boolean>;
  end: () => Promise<void>;
  pool: Pool | null;
};

export function createDbClient(config: AppConfig): DbClient {
  if (!config.databaseUrl) {
    return createNullDbClient();
  }

  const pool = new PgPool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return {
    pool,
    query: (text, params) => pool.query(text, params),
    async withTransaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async checkConnection() {
      const result = await pool.query('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    },
    async end() {
      await pool.end();
    },
  };
}

function createNullDbClient(): DbClient {
  const notConfigured = () => {
    throw new Error('DATABASE_URL is not configured');
  };

  return {
    pool: null,
    query: async () => notConfigured(),
    withTransaction: async () => notConfigured(),
    checkConnection: async () => false,
    end: async () => undefined,
  };
}
