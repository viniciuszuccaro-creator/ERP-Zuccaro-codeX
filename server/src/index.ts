import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createRuntimeDbClients } from './db/client.js';

async function main() {
  const config = loadConfig();
  const clients = await createRuntimeDbClients(config);
  const { db, authDb } = clients;
  let app: ReturnType<typeof createApp>['app'];
  try { app = createApp({ config, db, authDb, tenantContextEnabled: config.tenantContextEnabled }).app; }
  catch (error) { await clients.end(); throw error; }

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
      await clients.end();
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
