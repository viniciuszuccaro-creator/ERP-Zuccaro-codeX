import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createDbClient } from './db/client.js';
import express from 'express';
import { transactionScope } from './integrations/transactionScope.js';
import { SaleIngress } from './integrations/saleIngress.js';
import { loadChannelIdentities, saleIngressHttp } from './integrations/saleIngressHttp.js';
import {
  PostgresExpedicaoEstoquePort,
  PostgresExpedicaoPedidoPort,
} from './integrations/expedicaoPersistentPorts.js';

async function main() {
  const config = loadConfig();
  const db = transactionScope(createDbClient(config));
  // Ledger canônico (037): opt-in explícito. Sem saldo reconciliado a porta falha fechado;
  // nunca inventa abertura nem movimenta produto.estoque_atual em paralelo.
  const expedicaoPorts = config.expedicaoPersistentPorts
    ? {
        expedicaoPedidoPort: new PostgresExpedicaoPedidoPort(),
        expedicaoEstoquePort: new PostgresExpedicaoEstoquePort(),
      }
    : {};
  const runtime = createApp({ config, db, ...expedicaoPorts });
  const app = express();
  app.set('trust proxy', runtime.app.get('trust proxy'));
  const identities = loadChannelIdentities(process.env);
  if (identities.length) {
    if (!db.pool || runtime.useMemory) throw new Error('Omnichannel requires PostgreSQL');
    const ingress = new SaleIngress(db, runtime);
    await ingress.assertDatabaseReady();
    app.use('/api/v1/integracoes/vendas', saleIngressHttp(ingress, identities, config));
  }
  app.use(runtime.app);

  const server = app.listen(config.port, () => {
    console.log(JSON.stringify({
      msg: 'erp-api listening',
      port: config.port,
      environment: config.erpEnv,
      version: config.appVersion,
      databaseConfigured: Boolean(config.databaseUrl),
    }));
  });

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ msg: 'shutdown', signal }));
    server.close(async () => {
      await db.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
