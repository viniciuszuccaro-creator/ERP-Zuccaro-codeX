import { AsyncLocalStorage } from 'node:async_hooks';
import type { DbClient, DbQueryExecutor } from '../db/client.js';

/** Shares the inbound receipt transaction with the existing commercial repositories. */
export function transactionScope(db: DbClient): DbClient {
  const scope = new AsyncLocalStorage<DbQueryExecutor>();
  return {
    ...db,
    query: (sql, params) => (scope.getStore() ?? db).query(sql, params),
    withTransaction: (fn) => {
      const executor = scope.getStore();
      return executor ? fn(executor) : db.withTransaction((client) => scope.run(client, () => fn(client)));
    },
  };
}
