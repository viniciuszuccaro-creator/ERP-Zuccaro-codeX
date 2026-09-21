import { Router, type Request } from 'express';
import type { AppConfig } from '../config/env.js';
import { publicConfigView } from '../config/env.js';
import type { DbClient } from '../db/client.js';
import { getAuthFoundation } from '../auth/foundation.js';
import { requireTenantScope } from '../middleware/requestContext.js';
import type { ClienteService } from '../services/clienteService.js';
import type { ClienteLocalService } from '../services/clienteLocalService.js';
import type { ObraService } from '../services/obraService.js';
import type { TabelaPrecoService } from '../services/tabelaPrecoService.js';
import type { CondicaoPagamentoService } from '../services/condicaoPagamentoService.js';
import type { OrcamentoService } from '../services/orcamentoService.js';
import type { PedidoService } from '../services/pedidoService.js';
import type { MarcaService } from '../services/marcaService.js';
import type { ProdutoService } from '../services/produtoService.js';
import type { TenantCrudService } from '../services/tenantCrudService.js';

type CrudLike = {
  list: (ctx: ReturnType<typeof ctxFromReq>, options?: { ativo?: boolean; search?: string; limit?: number }) => Promise<unknown>;
  get: (ctx: ReturnType<typeof ctxFromReq>, id: string) => Promise<unknown>;
  create: (ctx: ReturnType<typeof ctxFromReq>, payload: unknown) => Promise<unknown>;
  update: (ctx: ReturnType<typeof ctxFromReq>, id: string, payload: unknown) => Promise<unknown>;
  softDelete: (ctx: ReturnType<typeof ctxFromReq>, id: string) => Promise<unknown>;
};

export type ApiDeps = {
  config: AppConfig;
  db: DbClient;
  marcaService: MarcaService;
  unidadeService: TenantCrudService<any, any, any>;
  grupoProdutoService: TenantCrudService<any, any, any>;
  setorService: TenantCrudService<any, any, any>;
  produtoService: ProdutoService;
  clienteService: ClienteService;
  clienteLocalService: ClienteLocalService;
  obraService: ObraService;
  tabelaPrecoService: TabelaPrecoService;
  condicaoPagamentoService: CondicaoPagamentoService;
  orcamentoService: OrcamentoService;
  pedidoService: PedidoService;
};

function ctxFromReq(req: Request) {
  return {
    requestId: req.requestId,
    groupId: req.groupId as string,
    empresaId: req.empresaId,
    actorId: req.actorId,
    actorEmail: req.actorEmail,
    scopeType: req.scopeType,
    ipAddress: req.ip,
  };
}

function mountCrud(router: Router, basePath: string, service: CrudLike) {
  router.get(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const ativoParam = req.query.ativo;
      const ativo = ativoParam == null
        ? undefined
        : ['1', 'true', 'yes'].includes(String(ativoParam).toLowerCase());
      const search = req.query.search ? String(req.query.search) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const rows = await service.list(ctxFromReq(req), { ativo, search, limit });
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:id`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.create(ctxFromReq(req), req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch(`${basePath}/:id`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.update(ctxFromReq(req), req.params.id, req.body);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:id`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDelete(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });
}

function mountProdutoRoutes(router: Router, service: ProdutoService) {
  router.get('/api/v1/produtos', requireTenantScope, async (req, res, next) => {
    try {
      const ativoParam = req.query.ativo;
      const ativo = ativoParam == null
        ? undefined
        : ['1', 'true', 'yes'].includes(String(ativoParam).toLowerCase());
      const page = await service.list(ctxFromReq(req), {
        ativo,
        search: req.query.search ? String(req.query.search) : undefined,
        codigo: req.query.codigo ? String(req.query.codigo) : undefined,
        codigoBarras: req.query.codigo_barras ? String(req.query.codigo_barras) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/v1/produtos/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/produtos', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.create(ctxFromReq(req), req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/api/v1/produtos/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.update(ctxFromReq(req), req.params.id, req.body);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/v1/produtos/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDelete(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });
}

function parseAtivoQuery(ativoParam: unknown): boolean | undefined {
  if (ativoParam == null) return undefined;
  return ['1', 'true', 'yes'].includes(String(ativoParam).toLowerCase());
}

function mountClienteRoutes(router: Router, service: ClienteService) {
  const relationshipPath = '/api/v1/clientes/:clienteId/empresas';

  router.get(relationshipPath, requireTenantScope, async (req, res, next) => {
    try {
      const orderByRaw = req.query.order_by ? String(req.query.order_by) : undefined;
      const orderBy = ['empresa', 'situacao', 'created_at'].includes(orderByRaw ?? '')
        ? orderByRaw as 'empresa' | 'situacao' | 'created_at'
        : undefined;
      const orderDirRaw = req.query.order_dir ? String(req.query.order_dir).toLowerCase() : undefined;
      const orderDir = orderDirRaw === 'asc' || orderDirRaw === 'desc' ? orderDirRaw : undefined;
      const page = await service.listEmpresaLinks(ctxFromReq(req), req.params.clienteId, {
        ativo: parseAtivoQuery(req.query.ativo),
        bloqueado: req.query.bloqueado == null
          ? undefined
          : parseAtivoQuery(req.query.bloqueado),
        situacaoComercial: req.query.situacao ? String(req.query.situacao) : undefined,
        empresaId: req.query.empresa_id ? String(req.query.empresa_id) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        orderBy,
        orderDir,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.get(`${relationshipPath}/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.getEmpresaLink(
        ctxFromReq(req), req.params.clienteId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${relationshipPath}/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const result = await service.createEmpresaLink(
        ctxFromReq(req), req.params.clienteId, req.params.empresaId, req.body,
      );
      res.status(result.created ? 201 : 200).json({ data: result.row });
    } catch (error) {
      next(error);
    }
  });

  router.patch(`${relationshipPath}/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.updateEmpresaLink(
        ctxFromReq(req), req.params.clienteId, req.params.empresaId, req.body,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${relationshipPath}/:empresaId/block`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.blockEmpresaLink(
        ctxFromReq(req), req.params.clienteId, req.params.empresaId, req.body,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${relationshipPath}/:empresaId/unblock`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.unblockEmpresaLink(
        ctxFromReq(req), req.params.clienteId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${relationshipPath}/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDeleteEmpresaLink(
        ctxFromReq(req), req.params.clienteId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${relationshipPath}/:empresaId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restoreEmpresaLink(
        ctxFromReq(req), req.params.clienteId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/v1/clientes', requireTenantScope, async (req, res, next) => {
    try {
      const orderByRaw = req.query.order_by ? String(req.query.order_by) : undefined;
      const orderBy = orderByRaw === 'nome' || orderByRaw === 'codigo' ? orderByRaw : undefined;
      const orderDirRaw = req.query.order_dir ? String(req.query.order_dir).toLowerCase() : undefined;
      const orderDir = orderDirRaw === 'desc' || orderDirRaw === 'asc' ? orderDirRaw : undefined;
      const page = await service.list(ctxFromReq(req), {
        ativo: parseAtivoQuery(req.query.ativo),
        search: req.query.search ? String(req.query.search) : undefined,
        codigo: req.query.codigo ? String(req.query.codigo) : undefined,
        documento: req.query.documento ? String(req.query.documento) : undefined,
        orderBy,
        orderDir,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/v1/clientes/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/clientes', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.create(ctxFromReq(req), req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/api/v1/clientes/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.update(ctxFromReq(req), req.params.id, req.body);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/api/v1/clientes/:id', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDelete(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post('/api/v1/clientes/:id/restore', requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restore(ctxFromReq(req), req.params.id);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });
}

function mountClienteLocalRoutes(router: Router, service: ClienteLocalService) {
  const basePath = '/api/v1/clientes/:clienteId/locais';

  router.get(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const orderByRaw = req.query.order_by ? String(req.query.order_by) : undefined;
      const orderBy = ['nome', 'cidade', 'created_at'].includes(orderByRaw ?? '')
        ? orderByRaw as 'nome' | 'cidade' | 'created_at'
        : undefined;
      const orderDirRaw = req.query.order_dir ? String(req.query.order_dir).toLowerCase() : undefined;
      const orderDir = orderDirRaw === 'asc' || orderDirRaw === 'desc' ? orderDirRaw : undefined;
      const page = await service.list(ctxFromReq(req), req.params.clienteId, {
        ativo: parseAtivoQuery(req.query.ativo),
        finalidade: req.query.finalidade ? String(req.query.finalidade) : undefined,
        principal: req.query.principal == null
          ? undefined
          : parseAtivoQuery(req.query.principal),
        cidade: req.query.cidade ? String(req.query.cidade) : undefined,
        uf: req.query.uf ? String(req.query.uf) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        orderBy,
        orderDir,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.post(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.create(ctxFromReq(req), req.params.clienteId, req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:localId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(
        ctxFromReq(req), req.params.clienteId, req.params.localId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch(`${basePath}/:localId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.update(
        ctxFromReq(req), req.params.clienteId, req.params.localId, req.body,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.put(`${basePath}/:localId/finalidades`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.setFinalidades(
        ctxFromReq(req), req.params.clienteId, req.params.localId, req.body,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:localId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDelete(
        ctxFromReq(req), req.params.clienteId, req.params.localId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:localId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restore(
        ctxFromReq(req), req.params.clienteId, req.params.localId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });
}

function mountObraRoutes(router: Router, service: ObraService) {
  const basePath = '/api/v1/clientes/:clienteId/obras';

  router.get(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const orderByRaw = req.query.order_by ? String(req.query.order_by) : undefined;
      const orderBy = ['nome', 'codigo', 'created_at'].includes(orderByRaw ?? '')
        ? orderByRaw as 'nome' | 'codigo' | 'created_at'
        : undefined;
      const orderDirRaw = req.query.order_dir ? String(req.query.order_dir).toLowerCase() : undefined;
      const orderDir = orderDirRaw === 'asc' || orderDirRaw === 'desc' ? orderDirRaw : undefined;
      const page = await service.list(ctxFromReq(req), req.params.clienteId, {
        ativo: parseAtivoQuery(req.query.ativo),
        status: req.query.status ? String(req.query.status) : undefined,
        operacional: req.query.operacional == null
          ? undefined
          : parseAtivoQuery(req.query.operacional),
        search: req.query.search ? String(req.query.search) : undefined,
        cidade: req.query.cidade ? String(req.query.cidade) : undefined,
        uf: req.query.uf ? String(req.query.uf) : undefined,
        orderBy,
        orderDir,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.post(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.create(ctxFromReq(req), req.params.clienteId, req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:obraId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.clienteId, req.params.obraId);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch(`${basePath}/:obraId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.update(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.body,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:obraId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDelete(
        ctxFromReq(req), req.params.clienteId, req.params.obraId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:obraId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restore(
        ctxFromReq(req), req.params.clienteId, req.params.obraId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:obraId/empresas`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.clienteId, req.params.obraId);
      res.json({ data: row.empresas });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:obraId/locais`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.clienteId, req.params.obraId);
      res.json({ data: row.locais });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:obraId/empresas/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.linkEmpresa(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.params.empresaId,
      );
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:obraId/empresas/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.unlinkEmpresa(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:obraId/empresas/:empresaId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restoreEmpresa(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:obraId/locais`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.linkLocal(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.body,
      );
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:obraId/locais/:localId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.unlinkLocal(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.params.localId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:obraId/locais/:localId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restoreLocal(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.params.localId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:obraId/locais/:localId/principal`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.setPrincipal(
        ctxFromReq(req), req.params.clienteId, req.params.obraId, req.params.localId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });
}

function mountTabelaPrecoRoutes(router: Router, service: TabelaPrecoService) {
  const basePath = '/api/v1/tabelas-preco';

  router.get(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const orderByRaw = req.query.order_by ? String(req.query.order_by) : undefined;
      const orderBy = ['nome', 'codigo', 'created_at'].includes(orderByRaw ?? '')
        ? orderByRaw as 'nome' | 'codigo' | 'created_at'
        : undefined;
      const orderDirRaw = req.query.order_dir ? String(req.query.order_dir).toLowerCase() : undefined;
      const orderDir = orderDirRaw === 'asc' || orderDirRaw === 'desc' ? orderDirRaw : undefined;
      const page = await service.list(ctxFromReq(req), {
        ativo: parseAtivoQuery(req.query.ativo),
        vigente: parseAtivoQuery(req.query.vigente),
        ehPadrao: parseAtivoQuery(req.query.eh_padrao),
        search: req.query.search ? String(req.query.search) : undefined,
        orderBy,
        orderDir,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.post(basePath, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.create(ctxFromReq(req), req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:tabelaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.tabelaId);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch(`${basePath}/:tabelaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.update(ctxFromReq(req), req.params.tabelaId, req.body);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:tabelaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDelete(ctxFromReq(req), req.params.tabelaId);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:tabelaId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restore(ctxFromReq(req), req.params.tabelaId);
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:tabelaId/empresas`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.get(ctxFromReq(req), req.params.tabelaId);
      res.json({ data: row.empresas });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:tabelaId/empresas/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.linkEmpresa(
        ctxFromReq(req), req.params.tabelaId, req.params.empresaId,
      );
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:tabelaId/empresas/:empresaId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.unlinkEmpresa(
        ctxFromReq(req), req.params.tabelaId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:tabelaId/empresas/:empresaId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restoreEmpresa(
        ctxFromReq(req), req.params.tabelaId, req.params.empresaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:tabelaId/empresas/:empresaId/padrao`, requireTenantScope, async (req, res, next) => {
    try {
      const ctx = ctxFromReq(req);
      if (ctx.empresaId && ctx.empresaId !== req.params.empresaId) {
        res.status(403).json({ error: { code: 'PERMISSION_DENIED', message: 'Permission denied' } });
        return;
      }
      const row = await service.setPadrao(
        { ...ctx, empresaId: req.params.empresaId },
        req.params.tabelaId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.get(`${basePath}/:tabelaId/itens`, requireTenantScope, async (req, res, next) => {
    try {
      const page = await service.listItens(ctxFromReq(req), req.params.tabelaId, {
        ativo: parseAtivoQuery(req.query.ativo),
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:tabelaId/itens`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.createItem(ctxFromReq(req), req.params.tabelaId, req.body);
      res.status(201).json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.patch(`${basePath}/:tabelaId/itens/:itemId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.updateItem(
        ctxFromReq(req), req.params.tabelaId, req.params.itemId, req.body,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.delete(`${basePath}/:tabelaId/itens/:itemId`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.softDeleteItem(
        ctxFromReq(req), req.params.tabelaId, req.params.itemId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${basePath}/:tabelaId/itens/:itemId/restore`, requireTenantScope, async (req, res, next) => {
    try {
      const row = await service.restoreItem(
        ctxFromReq(req), req.params.tabelaId, req.params.itemId,
      );
      res.json({ data: row });
    } catch (error) {
      next(error);
    }
  });
}

function mountCondicaoPagamentoRoutes(router: Router, service: CondicaoPagamentoService) {
  const base = '/api/v1/condicoes-pagamento';
  router.get(base, requireTenantScope, async (req,res,next)=>{try { res.json(await service.list(ctxFromReq(req),{ativo:parseAtivoQuery(req.query.ativo),ehPadrao:parseAtivoQuery(req.query.eh_padrao),search:req.query.search?String(req.query.search):undefined,limit:req.query.limit?Number(req.query.limit):undefined,offset:req.query.offset?Number(req.query.offset):undefined})); } catch(e){next(e);} });
  router.post(base, requireTenantScope, async (req,res,next)=>{try{res.status(201).json({data:await service.create(ctxFromReq(req),req.body)});}catch(e){next(e);}});
  router.get(`${base}/:id`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.get(ctxFromReq(req),req.params.id)});}catch(e){next(e);}});
  router.patch(`${base}/:id`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.update(ctxFromReq(req),req.params.id,req.body)});}catch(e){next(e);}});
  router.delete(`${base}/:id`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.softDelete(ctxFromReq(req),req.params.id)});}catch(e){next(e);}});
  router.post(`${base}/:id/restore`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.restore(ctxFromReq(req),req.params.id)});}catch(e){next(e);}});
  router.put(`${base}/:id/parcelas`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.replaceParcelas(ctxFromReq(req),req.params.id,req.body)});}catch(e){next(e);}});
  router.post(`${base}/:id/empresas/:empresaId`, requireTenantScope, async(req,res,next)=>{try{res.status(201).json({data:await service.linkEmpresa(ctxFromReq(req),req.params.id,req.params.empresaId)});}catch(e){next(e);}});
  router.delete(`${base}/:id/empresas/:empresaId`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.unlinkEmpresa(ctxFromReq(req),req.params.id,req.params.empresaId)});}catch(e){next(e);}});
  router.post(`${base}/:id/empresas/:empresaId/restore`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.restoreEmpresa(ctxFromReq(req),req.params.id,req.params.empresaId)});}catch(e){next(e);}});
  router.post(`${base}/:id/padrao`, requireTenantScope, async(req,res,next)=>{try{res.json({data:await service.setPadrao(ctxFromReq(req),req.params.id)});}catch(e){next(e);}});
}

function mountOrcamentoRoutes(router: Router, service: OrcamentoService) {
  const base = '/api/v1/orcamentos';
  router.get(base, requireTenantScope, async (req, res, next) => {
    try {
      res.json(await service.list(ctxFromReq(req), {
        limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
        offset: req.query.offset === undefined ? undefined : Number(req.query.offset),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        clienteEmpresaId: typeof req.query.clienteEmpresaId === 'string' ? req.query.clienteEmpresaId : undefined,
        validadeDe: typeof req.query.validadeDe === 'string' ? req.query.validadeDe : undefined,
        validadeAte: typeof req.query.validadeAte === 'string' ? req.query.validadeAte : undefined,
      }));
    } catch (error) { next(error); }
  });
  router.post(base, requireTenantScope, async (req, res, next) => {
    try { res.status(201).json({ data: await service.create(ctxFromReq(req), req.body) }); }
    catch (error) { next(error); }
  });
  router.get(`${base}/:id`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.get(ctxFromReq(req), req.params.id) }); }
    catch (error) { next(error); }
  });
  router.patch(`${base}/:id`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.update(ctxFromReq(req), req.params.id, req.body) }); }
    catch (error) { next(error); }
  });
  router.post(`${base}/:id/cancelar`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.cancel(ctxFromReq(req), req.params.id) }); }
    catch (error) { next(error); }
  });
}

function mountPedidoRoutes(router: Router, service: PedidoService) {
  const base = '/api/v1/pedidos';
  router.get(base, requireTenantScope, async (req, res, next) => {
    try {
      res.json(await service.list(ctxFromReq(req), {
        limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
        offset: req.query.offset === undefined ? undefined : Number(req.query.offset),
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        clienteEmpresaId: typeof req.query.clienteEmpresaId === 'string' ? req.query.clienteEmpresaId : undefined,
        tipoOperacao: typeof req.query.tipoOperacao === 'string' ? req.query.tipoOperacao : undefined,
      }));
    } catch (error) { next(error); }
  });
  router.post(base, requireTenantScope, async (req, res, next) => {
    try { res.status(201).json({ data: await service.create(ctxFromReq(req), req.body) }); }
    catch (error) { next(error); }
  });
  router.get(`${base}/:id`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.get(ctxFromReq(req), req.params.id) }); }
    catch (error) { next(error); }
  });
  router.patch(`${base}/:id`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.update(ctxFromReq(req), req.params.id, req.body) }); }
    catch (error) { next(error); }
  });
  router.get(`${base}/:id/historico`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.history(ctxFromReq(req), req.params.id) }); }
    catch (error) { next(error); }
  });
  router.post(`${base}/:id/status`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.transition(ctxFromReq(req), req.params.id, req.body?.status, req.body?.motivo) }); }
    catch (error) { next(error); }
  });
  router.post(`${base}/:id/cancelar`, requireTenantScope, async (req, res, next) => {
    try { res.json({ data: await service.cancel(ctxFromReq(req), req.params.id, req.body?.motivo) }); }
    catch (error) { next(error); }
  });
  router.post('/api/v1/orcamentos/:id/converter-pedido', requireTenantScope, async (req, res, next) => {
    try { res.status(201).json({ data: await service.convert(ctxFromReq(req), req.params.id, req.body) }); }
    catch (error) { next(error); }
  });
}
export function createApiRouter(deps: ApiDeps) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      environment: deps.config.erpEnv,
      database: deps.config.databaseUrl ? 'configured' : 'not_configured',
      timestamp: new Date().toISOString(),
      version: deps.config.appVersion,
    });
  });

  router.get('/ready', async (_req, res) => {
    const ok = await deps.db.checkConnection();
    if (!ok) {
      res.status(503).json({
        status: 'not_ready',
        database: 'unreachable',
        timestamp: new Date().toISOString(),
        version: deps.config.appVersion,
      });
      return;
    }
    res.json({
      status: 'ready',
      database: 'ok',
      timestamp: new Date().toISOString(),
      version: deps.config.appVersion,
    });
  });

  router.get('/api/v1/meta', (_req, res) => {
    res.json({
      runtime: 'ERP-RUNTIME-08B',
      auth: getAuthFoundation(),
      config: publicConfigView(deps.config),
      httpPilotEntities: ['Marca', 'UnidadeMedida', 'GrupoProduto', 'SetorAtividade', 'Orcamento', 'Pedido'],
      preparedEntities: ['Produto', 'Cliente', 'ClienteEmpresa', 'ClienteLocal', 'Obra', 'TabelaPreco', 'CondicaoPagamento', 'Orcamento', 'Pedido'],
      httpEntities: ['Marca', 'UnidadeMedida', 'GrupoProduto', 'SetorAtividade', 'Produto', 'Cliente', 'ClienteEmpresa', 'ClienteLocal', 'Orcamento', 'Pedido'],
      rlsModel: 'ENABLE+FORCE fail-closed; BFF uses privileged DB role; JWT policies planned with Auth',
      note: 'TabelaPreco and CondicaoPagamento prepared in backend; Orcamento uses the canonical frontend HTTP client; Pedido backend HTTP is active with frontend integration pending',
      produto: {
        masterData: true,
        pagination: true,
        tenantFkIntegrity: true,
        frontendHttp: false,
      },
      cliente: {
        masterData: true,
        pagination: true,
        sequentialCodigo: true,
        documentoUniqueness: true,
        softDeleteRestore: true,
        frontendHttp: false,
      },
      clienteEmpresa: {
        commercialEligibility: true,
        pagination: true,
        tenantIntegrity: true,
        softDeleteRestore: true,
        tabelaPrecoLink: true,
        frontendHttp: false,
      },
      clienteLocal: {
        canonicalAddress: true,
        multiPurpose: true,
        pagination: true,
        transactionalAudit: true,
        frontendHttp: false,
      },
      obra: {
        canonicalBusinessContext: true,
        companyAuthorization: true,
        typedLocals: true,
        sequentialCodigo: true,
        pagination: true,
        transactionalAudit: true,
        frontendHttp: false,
        optionalOnPedido: true,
      },
      tabelaPreco: {
        masterData: true,
        companyAuthorization: true,
        productUnitPricing: true,
        sequentialCodigo: true,
        pagination: true,
        transactionalAudit: true,
        frontendHttp: false,
      },
      condicaoPagamento: { masterData: true, companyAuthorization: true, parcelasAtomicas: true, frontendHttp: false },
      orcamento: {
        backendHttp: true,
        frontendHttp: true,
        pagination: true,
        tenantIntegrity: true,
        sequentialNumero: true,
        transactionalAudit: true,
        rbacFailClosed: true,
        cancelByState: true,
      },
      pedido: {
        backendHttp: true,
        frontendHttp: false,
        pagination: true,
        tenantIntegrity: true,
        sequentialNumero: true,
        transactionalAudit: true,
        rbacFailClosed: true,
        idempotentConversion: true,
        statusHistory: true,
      },
    });
  });

  mountCrud(router, '/api/v1/marcas', deps.marcaService);
  mountCrud(router, '/api/v1/unidades-medida', deps.unidadeService);
  mountCrud(router, '/api/v1/grupos-produto', deps.grupoProdutoService);
  mountCrud(router, '/api/v1/setores-atividade', deps.setorService);
  mountProdutoRoutes(router, deps.produtoService);
  mountClienteRoutes(router, deps.clienteService);
  mountClienteLocalRoutes(router, deps.clienteLocalService);
  mountObraRoutes(router, deps.obraService);
  mountTabelaPrecoRoutes(router, deps.tabelaPrecoService);
  mountCondicaoPagamentoRoutes(router, deps.condicaoPagamentoService);
  mountOrcamentoRoutes(router, deps.orcamentoService);
  mountPedidoRoutes(router, deps.pedidoService);

  return router;
}
