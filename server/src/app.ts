import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { InMemoryAuditRepository, PostgresAuditRepository } from './audit/auditRepository.js';
import type { AppConfig } from './config/env.js';
import type { DbClient } from './db/client.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware, scopeMiddleware } from './middleware/requestContext.js';
import { InMemoryMarcaRepository } from './repositories/inMemoryMarcaRepository.js';
import { PostgresMarcaRepository } from './repositories/postgresMarcaRepository.js';
import { MarcaService } from './services/marcaService.js';
import { createApiRouter } from './api/router.js';

export type CreateAppOptions = {
  config: AppConfig;
  db: DbClient;
  /** Force in-memory repos (unit/integration harness without Postgres). */
  useMemory?: boolean;
};

export function createApp(options: CreateAppOptions) {
  const { config, db } = options;
  const useMemory = options.useMemory === true || !config.databaseUrl;

  const marcaRepo = useMemory ? new InMemoryMarcaRepository() : new PostgresMarcaRepository(db);
  const auditRepo = useMemory ? new InMemoryAuditRepository() : new PostgresAuditRepository(db);
  const marcaService = new MarcaService(marcaRepo, auditRepo);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false,
  }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS_ORIGIN_DENIED'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }));
  app.use(requestIdMiddleware);
  app.use(scopeMiddleware);

  app.use(createApiRouter({ config, db, marcaService }));
  app.use(notFoundHandler);
  app.use(createErrorHandler(config));

  return {
    app,
    marcaService,
    marcaRepo,
    auditRepo,
    useMemory,
  };
}
