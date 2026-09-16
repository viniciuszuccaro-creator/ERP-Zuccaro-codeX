import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { InMemoryAuditRepository, PostgresAuditRepository } from './audit/auditRepository.js';
import type { AppConfig } from './config/env.js';
import type { DbClient } from './db/client.js';
import { InMemoryTenantGuard, PostgresTenantGuard } from './db/tenantGuard.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware, scopeMiddleware } from './middleware/requestContext.js';
import {
  createInMemoryGrupoProdutoRepo,
  createInMemoryProdutoRepo,
  createInMemorySetorRepo,
  createInMemoryUnidadeRepo,
} from './repositories/inMemoryCadastroRepositories.js';
import { InMemoryMarcaRepository } from './repositories/inMemoryMarcaRepository.js';
import {
  PostgresGrupoProdutoRepository,
  PostgresProdutoRepository,
  PostgresSetorRepository,
  PostgresUnidadeRepository,
} from './repositories/postgresCadastroRepositories.js';
import { PostgresMarcaRepository } from './repositories/postgresMarcaRepository.js';
import {
  grupoProdutoCreateSchema,
  grupoProdutoUpdateSchema,
  produtoCreateSchema,
  produtoUpdateSchema,
  setorCreateSchema,
  setorUpdateSchema,
  unidadeCreateSchema,
  unidadeUpdateSchema,
} from './repositories/cadastroTypes.js';
import { MarcaService } from './services/marcaService.js';
import { TenantCrudService } from './services/tenantCrudService.js';
import { createApiRouter } from './api/router.js';

export type CreateAppOptions = {
  config: AppConfig;
  db: DbClient;
  useMemory?: boolean;
  /** Optional preconfigured tenant guard (tests). */
  tenantGuard?: InMemoryTenantGuard | PostgresTenantGuard;
};

export function createApp(options: CreateAppOptions) {
  const { config, db } = options;
  const useMemory = options.useMemory === true || !config.databaseUrl;

  const auditRepo = useMemory ? new InMemoryAuditRepository() : new PostgresAuditRepository(db);
  const tenantGuard = options.tenantGuard
    ?? (useMemory ? new InMemoryTenantGuard() : new PostgresTenantGuard(db));

  const marcaRepo = useMemory ? new InMemoryMarcaRepository() : new PostgresMarcaRepository(db);
  const unidadeRepo = useMemory ? createInMemoryUnidadeRepo() : new PostgresUnidadeRepository(db);
  const grupoRepo = useMemory ? createInMemoryGrupoProdutoRepo() : new PostgresGrupoProdutoRepository(db);
  const setorRepo = useMemory ? createInMemorySetorRepo() : new PostgresSetorRepository(db);
  const produtoRepo = useMemory ? createInMemoryProdutoRepo() : new PostgresProdutoRepository(db);

  const marcaService = new MarcaService(marcaRepo, auditRepo, tenantGuard);
  // Snapshot de auditoria: default sanitizeAuditSnapshot (completo, sem pick parcial).
  const unidadeService = new TenantCrudService(unidadeRepo, auditRepo, tenantGuard, {
    entityName: 'UnidadeMedida',
    notFoundCode: 'UNIDADE_NOT_FOUND',
    createSchema: unidadeCreateSchema,
    updateSchema: unidadeUpdateSchema,
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });
  const grupoProdutoService = new TenantCrudService(grupoRepo, auditRepo, tenantGuard, {
    entityName: 'GrupoProduto',
    notFoundCode: 'GRUPO_PRODUTO_NOT_FOUND',
    createSchema: grupoProdutoCreateSchema,
    updateSchema: grupoProdutoUpdateSchema,
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });
  const setorService = new TenantCrudService(setorRepo, auditRepo, tenantGuard, {
    entityName: 'SetorAtividade',
    notFoundCode: 'SETOR_NOT_FOUND',
    createSchema: setorCreateSchema,
    updateSchema: setorUpdateSchema,
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });
  const produtoService = new TenantCrudService(produtoRepo, auditRepo, tenantGuard, {
    entityName: 'Produto',
    notFoundCode: 'PRODUTO_NOT_FOUND',
    createSchema: produtoCreateSchema,
    updateSchema: produtoUpdateSchema,
    getEmpresaId: (row) => row.empresa_id,
    resolveEmpresaIdFromCreate: (data, scope) => data.empresa_id ?? scope.empresaId,
    resolveEmpresaIdFromUpdate: (data, current) => (data.empresa_id === undefined ? current.empresa_id : data.empresa_id),
  });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: false }));
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

  app.use(createApiRouter({
    config,
    db,
    marcaService,
    unidadeService,
    grupoProdutoService,
    setorService,
    produtoService,
  }));
  app.use(notFoundHandler);
  app.use(createErrorHandler(config));

  return {
    app,
    marcaService,
    unidadeService,
    grupoProdutoService,
    setorService,
    produtoService,
    auditRepo,
    tenantGuard,
    useMemory,
  };
}
