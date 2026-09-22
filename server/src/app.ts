import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { InMemoryAuditRepository, PostgresAuditRepository } from './audit/auditRepository.js';
import type { AppConfig } from './config/env.js';
import type { DbClient } from './db/client.js';
import {
  InMemoryProdutoRelationGuard,
  PostgresProdutoRelationGuard,
} from './db/produtoRelationGuard.js';
import { InMemoryRbacGuard, PostgresRbacGuard } from './db/rbacGuard.js';
import { InMemoryTenantGuard, PostgresTenantGuard } from './db/tenantGuard.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestIdMiddleware, scopeMiddleware } from './middleware/requestContext.js';
import {
  createInMemoryGrupoProdutoRepo,
  createInMemorySetorRepo,
  createInMemoryUnidadeRepo,
} from './repositories/inMemoryCadastroRepositories.js';
import { createInMemoryProdutoRepo } from './repositories/inMemoryProdutoRepository.js';
import { createInMemoryClienteRepo } from './repositories/inMemoryClienteRepository.js';
import { InMemoryClienteLocalRepository } from './repositories/inMemoryClienteLocalRepository.js';
import { InMemoryMarcaRepository } from './repositories/inMemoryMarcaRepository.js';
import {
  PostgresGrupoProdutoRepository,
  PostgresSetorRepository,
  PostgresUnidadeRepository,
} from './repositories/postgresCadastroRepositories.js';
import { PostgresProdutoRepository } from './repositories/postgresProdutoRepository.js';
import { PostgresClienteRepository } from './repositories/postgresClienteRepository.js';
import { PostgresClienteLocalRepository } from './repositories/postgresClienteLocalRepository.js';
import { InMemoryObraRepository } from './repositories/inMemoryObraRepository.js';
import { PostgresObraRepository } from './repositories/postgresObraRepository.js';
import { PostgresMarcaRepository } from './repositories/postgresMarcaRepository.js';
import {
  grupoProdutoCreateSchema,
  grupoProdutoUpdateSchema,
  setorCreateSchema,
  setorUpdateSchema,
  unidadeCreateSchema,
  unidadeUpdateSchema,
} from './repositories/cadastroTypes.js';
import { ClienteService } from './services/clienteService.js';
import { ClienteLocalService } from './services/clienteLocalService.js';
import { ObraService } from './services/obraService.js';
import { TabelaPrecoService } from './services/tabelaPrecoService.js';
import { MarcaService } from './services/marcaService.js';
import { ProdutoService } from './services/produtoService.js';
import { TenantCrudService } from './services/tenantCrudService.js';
import { createApiRouter } from './api/router.js';
import { InMemoryTabelaPrecoRepository } from './repositories/inMemoryTabelaPrecoRepository.js';
import { PostgresTabelaPrecoRepository } from './repositories/postgresTabelaPrecoRepository.js';
import { InMemoryCondicaoPagamentoRepository } from './repositories/inMemoryCondicaoPagamentoRepository.js';
import { PostgresCondicaoPagamentoRepository } from './repositories/postgresCondicaoPagamentoRepository.js';
import { CondicaoPagamentoService } from './services/condicaoPagamentoService.js';
import { InMemoryOrcamentoRepository } from './repositories/inMemoryOrcamentoRepository.js';
import { PostgresOrcamentoRepository } from './repositories/postgresOrcamentoRepository.js';
import { OrcamentoService } from './services/orcamentoService.js';
import { InMemoryPedidoRepository } from './repositories/inMemoryPedidoRepository.js';
import { PostgresPedidoRepository } from './repositories/postgresPedidoRepository.js';
import { PedidoService } from './services/pedidoService.js';

export type CreateAppOptions = {
  config: AppConfig;
  db: DbClient;
  useMemory?: boolean;
  /** Optional preconfigured tenant guard (tests). */
  tenantGuard?: InMemoryTenantGuard | PostgresTenantGuard;
  /** Optional relation guard for Produto FKs (tests). */
  produtoRelationGuard?: InMemoryProdutoRelationGuard | PostgresProdutoRelationGuard;
  /** Optional RBAC guard using the canonical entityGuard permission tree (tests). */
  rbacGuard?: InMemoryRbacGuard | PostgresRbacGuard;
};

export function createApp(options: CreateAppOptions) {
  const { config, db } = options;
  const useMemory = options.useMemory === true || !config.databaseUrl;

  const auditRepo = useMemory ? new InMemoryAuditRepository() : new PostgresAuditRepository(db);
  const tenantGuard = options.tenantGuard
    ?? (useMemory ? new InMemoryTenantGuard() : new PostgresTenantGuard(db));
  const produtoRelationGuard = options.produtoRelationGuard
    ?? (useMemory ? new InMemoryProdutoRelationGuard() : new PostgresProdutoRelationGuard(db));
  const rbacGuard = options.rbacGuard
    ?? (useMemory ? new InMemoryRbacGuard() : new PostgresRbacGuard(db));

  const marcaRepo = useMemory ? new InMemoryMarcaRepository() : new PostgresMarcaRepository(db);
  const unidadeRepo = useMemory ? createInMemoryUnidadeRepo() : new PostgresUnidadeRepository(db);
  const grupoRepo = useMemory ? createInMemoryGrupoProdutoRepo() : new PostgresGrupoProdutoRepository(db);
  const setorRepo = useMemory ? createInMemorySetorRepo() : new PostgresSetorRepository(db);
  const produtoRepo = useMemory ? createInMemoryProdutoRepo() : new PostgresProdutoRepository(db);
  const clienteRepo = useMemory ? createInMemoryClienteRepo() : new PostgresClienteRepository(db);
  const clienteLocalRepo = useMemory
    ? new InMemoryClienteLocalRepository()
    : new PostgresClienteLocalRepository(db);
  const obraRepo = useMemory ? new InMemoryObraRepository() : new PostgresObraRepository(db);
  const tabelaPrecoRepo = useMemory
    ? new InMemoryTabelaPrecoRepository()
    : new PostgresTabelaPrecoRepository(db);
  const condicaoPagamentoRepo = useMemory ? new InMemoryCondicaoPagamentoRepository() : new PostgresCondicaoPagamentoRepository(db);
  const orcamentoRepo = useMemory ? new InMemoryOrcamentoRepository() : new PostgresOrcamentoRepository(db);
  const pedidoRepo = useMemory ? new InMemoryPedidoRepository() : new PostgresPedidoRepository(db);

  const marcaService = new MarcaService(marcaRepo, auditRepo, tenantGuard);
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
  const produtoService = new ProdutoService(
    produtoRepo,
    auditRepo,
    tenantGuard,
    produtoRelationGuard,
    rbacGuard,
  );
  const clienteService = new ClienteService(
    clienteRepo,
    auditRepo,
    tenantGuard,
    rbacGuard,
    tabelaPrecoRepo,
    condicaoPagamentoRepo,
  );
  const tabelaPrecoService = new TabelaPrecoService(
    tabelaPrecoRepo,
    auditRepo,
    tenantGuard,
    rbacGuard,
  );
  const condicaoPagamentoService = new CondicaoPagamentoService(condicaoPagamentoRepo, auditRepo, tenantGuard, rbacGuard);
  const orcamentoService = new OrcamentoService(
    orcamentoRepo, auditRepo, tenantGuard, rbacGuard, clienteRepo, produtoRepo, unidadeRepo, condicaoPagamentoRepo,
  );
  const pedidoService = new PedidoService(
    pedidoRepo, orcamentoRepo, auditRepo, tenantGuard, rbacGuard, clienteRepo, produtoRepo,
    unidadeRepo, condicaoPagamentoRepo, clienteLocalRepo, obraRepo, tabelaPrecoRepo,
  );
  const obraService = new ObraService(
    obraRepo,
    clienteRepo,
    clienteLocalRepo,
    auditRepo,
    tenantGuard,
    rbacGuard,
  );
  const clienteLocalService = new ClienteLocalService(
    clienteLocalRepo,
    clienteRepo,
    auditRepo,
    tenantGuard,
    rbacGuard,
    obraService,
  );

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
    clienteService,
    clienteLocalService,
    obraService,
    tabelaPrecoService,
    condicaoPagamentoService,
    orcamentoService,
    pedidoService,
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
    clienteService,
    clienteLocalService,
    obraService,
    tabelaPrecoService,
    condicaoPagamentoService,
    orcamentoService,
    pedidoService,
    auditRepo,
    tenantGuard,
    produtoRelationGuard,
    rbacGuard,
    useMemory,
  };
}
