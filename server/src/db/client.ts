import type { Pool, QueryResult, QueryResultRow } from 'pg';
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppConfig } from '../config/env.js';

const { Pool: PgPool } = pg;

export type DbQueryExecutor = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
};

export type DbClient = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
  withTransaction: <T>(fn: (client: DbQueryExecutor) => Promise<T>) => Promise<T>;
  checkConnection: () => Promise<boolean>;
  end: () => Promise<void>;
  pool: Pool | null;
  withTenantContext?: <T>(scope: Readonly<{ groupId: string; empresaId?: string | null }>, fn: () => T, alive?: () => boolean) => T;
};

type TenantState = { scope: Readonly<{ groupId: string; empresaId: string | null }>; alive: () => boolean };
type TransactionState = { executor: DbQueryExecutor; tenant?: TenantState; active: boolean; failed: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Extends the single pool client; bootstrap queries remain unscoped by default. */
export function createPoolDbClient(pool: Pool): DbClient {
  const tenants = new AsyncLocalStorage<TenantState>();
  const transactions = new AsyncLocalStorage<TransactionState>();
  const ensureAlive = (tenant?: TenantState) => {
    if (tenant && !tenant.alive()) throw new Error('TENANT_CONTEXT_EXPIRED');
  };
  const ensureTransaction = (tx: TransactionState) => {
    ensureAlive(tx.tenant);
    if (!tx.active) throw new Error('TRANSACTION_EXECUTOR_EXPIRED');
    if (tx.failed) throw new Error('TRANSACTION_ROLLBACK_REQUIRED');
  };
  const api: DbClient = {
    pool,
    withTenantContext(scope, fn, alive = () => true) {
      if (!UUID.test(scope.groupId) || (scope.empresaId && !UUID.test(scope.empresaId))) throw new Error('TENANT_CONTEXT_INVALID');
      const frozen = Object.freeze({ groupId: scope.groupId, empresaId: scope.empresaId || null });
      const current = transactions.getStore();
      if (current) {
        ensureTransaction(current);
        if (!current.tenant || current.tenant.scope.groupId !== frozen.groupId || current.tenant.scope.empresaId !== frozen.empresaId) {
          current.failed = true;
          throw new Error('TRANSACTION_TENANT_MISMATCH');
        }
        return fn();
      }
      return tenants.run({ scope: frozen, alive }, fn);
    },
    async query(text, params) {
      const tx = transactions.getStore();
      if (tx) { ensureTransaction(tx); return tx.executor.query(text, params); }
      const tenant = tenants.getStore();
      ensureAlive(tenant);
      if (!tenant) return pool.query(text, params);
      return api.withTransaction(q => q.query(text, params));
    },
    async withTransaction(fn) {
      const nested = transactions.getStore();
      if (nested) {
        ensureTransaction(nested);
        try { return await fn(nested.executor); }
        catch (error) { nested.failed = true; throw error; }
      }
      const tenant = tenants.getStore();
      ensureAlive(tenant);
      const client = await pool.connect();
      let discard = false;
      let started = false;
      const tx: TransactionState = { active: true, failed: false, tenant, executor: { query: async (text, params) => {
        ensureTransaction(tx);
        try { return await client.query(text, params); }
        catch (error) { if (tenant) tx.failed = true; throw error; }
      } } };
      try {
        ensureAlive(tenant);
        await client.query('BEGIN'); started = true;
        if (tenant) await client.query("SELECT set_config('app.group_id',$1,true),set_config('app.empresa_id',$2,true)", [tenant.scope.groupId, tenant.scope.empresaId || '']);
        const result = tenant ? await transactions.run(tx, () => fn(tx.executor)) : await fn(tx.executor);
        ensureTransaction(tx);
        await client.query('COMMIT'); started = false;
        return result;
      } catch (error) {
        if (started) {
          try { await client.query('ROLLBACK'); }
          catch { discard = true; }
        } else { discard = true; }
        throw error;
      } finally {
        tx.active = false;
        client.release(discard);
      }
    },
    async checkConnection() { const result = await pool.query('SELECT 1 AS ok'); return result.rows[0]?.ok === 1; },
    async end() { await pool.end(); },
  };
  return api;
}

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

  return createPoolDbClient(pool);
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
