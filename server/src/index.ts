import { createApp } from './app.js';
import { loadConfig, publicConfigView } from './config/env.js';
import { createDbClient } from './db/client.js';

async function main() {
  const config = loadConfig();
  const db = createDbClient(config);
  const { app } = createApp({ config, db });

  const server = app.listen(config.port, () => {
    console.log(JSON.stringify({
      msg: 'erp-api listening',
      port: config.port,
      ...publicConfigView(config),
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
