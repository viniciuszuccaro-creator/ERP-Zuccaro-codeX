import { AppError } from '../api/errors.js';
import type { RequestContext } from '../audit/types.js';
import { maskDocumento } from '../db/documentoValidators.js';
import type { Cliente, ClienteEmpresa } from '../repositories/clienteTypes.js';
import type { Orcamento } from '../repositories/orcamentoTypes.js';
import type { Pedido } from '../repositories/pedidoTypes.js';
import type { ClienteService } from './clienteService.js';
import type { OrcamentoService } from './orcamentoService.js';
import type { PedidoService } from './pedidoService.js';

export type ClienteCentral360PageOptions = {
  orcamentosLimit?: number;
  orcamentosOffset?: number;
  pedidosLimit?: number;
  pedidosOffset?: number;
  empresasLimit?: number;
  empresasOffset?: number;
};

export type ClienteCentral360BlockStatus = 'ok' | 'forbidden' | 'unavailable' | 'skipped';

export type ClienteCentral360Block<T> = {
  status: ClienteCentral360BlockStatus;
  code?: string;
  data: T[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  } | null;
};

export type ClienteCentral360Identity = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  codigo: string;
  tipo: string;
  documento: string | null;
  nome: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  nome_social: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  status: string;
  origem: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ClienteCentral360EmpresaProjection = {
  id: string;
  cliente_id: string;
  empresa_id: string;
  ativo: boolean;
  situacao_comercial: ClienteEmpresa['situacao_comercial'];
  habilitado_operacao: boolean;
  bloqueado: boolean;
  elegivel_operacao: boolean;
  tabela_preco_id: string | null;
  condicao_pagamento_id: string | null;
  origem: ClienteEmpresa['origem'];
  created_at: string;
  updated_at: string;
};

export type ClienteCentral360OrcamentoProjection = {
  id: string;
  numero: string;
  status: Orcamento['status'];
  cliente_empresa_id: string;
  validade_em: string;
  subtotal: string;
  desconto: string;
  total: string;
  quantidade_itens: number;
  created_at: string;
  updated_at: string;
};

export type ClienteCentral360PedidoProjection = {
  id: string;
  numero: string;
  status: Pedido['status'];
  cliente_empresa_id: string;
  orcamento_id: string | null;
  tipo_operacao: Pedido['tipo_operacao'];
  data_entrega_solicitada: string;
  subtotal: string;
  desconto: string;
  total: string;
  quantidade_itens: number;
  created_at: string;
  updated_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pageBounds(limit: number | undefined, offset: number | undefined) {
  const safeLimit = Math.min(200, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit!) : 20));
  const safeOffset = Math.max(0, Number.isFinite(offset) ? Math.trunc(offset!) : 0);
  return { limit: safeLimit, offset: safeOffset };
}

function emptyMeta(limit: number, offset: number) {
  return { limit, offset, total: 0, hasMore: false };
}

function projectIdentity(row: Cliente): ClienteCentral360Identity {
  return {
    id: row.id,
    group_id: row.group_id,
    empresa_id: row.empresa_id,
    codigo: row.codigo,
    tipo: row.tipo,
    documento: row.documento ? maskDocumento(row.documento) : null,
    nome: row.nome,
    razao_social: row.razao_social,
    nome_fantasia: row.nome_fantasia,
    nome_social: row.nome_social,
    email: row.email,
    telefone: row.telefone,
    celular: row.celular,
    status: row.status,
    origem: row.origem,
    ativo: row.ativo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function projectEmpresa(row: ClienteEmpresa): ClienteCentral360EmpresaProjection {
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    empresa_id: row.empresa_id,
    ativo: row.ativo,
    situacao_comercial: row.situacao_comercial,
    habilitado_operacao: row.habilitado_operacao,
    bloqueado: row.bloqueado,
    elegivel_operacao: row.elegivel_operacao,
    tabela_preco_id: row.tabela_preco_id,
    condicao_pagamento_id: row.condicao_pagamento_id,
    origem: row.origem,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function projectOrcamento(row: Orcamento): ClienteCentral360OrcamentoProjection {
  return {
    id: row.id,
    numero: row.numero,
    status: row.status,
    cliente_empresa_id: row.cliente_empresa_id,
    validade_em: row.validade_em,
    subtotal: row.subtotal,
    desconto: row.desconto,
    total: row.total,
    quantidade_itens: row.itens.length,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function projectPedido(row: Pedido): ClienteCentral360PedidoProjection {
  return {
    id: row.id,
    numero: row.numero,
    status: row.status,
    cliente_empresa_id: row.cliente_empresa_id,
    orcamento_id: row.orcamento_id,
    tipo_operacao: row.tipo_operacao,
    data_entrega_solicitada: row.data_entrega_solicitada,
    subtotal: row.subtotal,
    desconto: row.desconto,
    total: row.total,
    quantidade_itens: row.itens.length,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Read-model da Central Cliente 360: composição permissionada sobre mestres e
 * operações canônicas existentes. Não cria tabela espelho nem copia saldos.
 */
export class ClienteCentral360Service {
  constructor(
    private readonly clientes: ClienteService,
    private readonly orcamentos: OrcamentoService,
    private readonly pedidos: PedidoService,
  ) {}

  async get(ctx: RequestContext, clienteId: string, options: ClienteCentral360PageOptions = {}) {
    if (!ctx.groupId) throw new AppError(400, 'GROUP_ID_REQUIRED', 'groupId is required');
    if (!ctx.empresaId) throw new AppError(400, 'EMPRESA_ID_REQUIRED', 'empresaId is required');
    if (!clienteId || !UUID_RE.test(clienteId)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid clienteId');
    }

    const identity = projectIdentity(await this.clientes.get(ctx, clienteId));
    const empresaBounds = pageBounds(options.empresasLimit, options.empresasOffset);
    const orcBounds = pageBounds(options.orcamentosLimit, options.orcamentosOffset);
    const pedBounds = pageBounds(options.pedidosLimit, options.pedidosOffset);

    const empresas = await this.loadEmpresas(ctx, clienteId, empresaBounds);
    const linkResolution = await this.resolveEmpresaLink(ctx, clienteId);
    const empresaLink = linkResolution.link;
    const clienteEmpresaId = empresaLink?.id ?? null;

    let orcamentos: ClienteCentral360Block<ClienteCentral360OrcamentoProjection>;
    let pedidos: ClienteCentral360Block<ClienteCentral360PedidoProjection>;
    if (linkResolution.denied) {
      orcamentos = {
        status: 'forbidden',
        code: 'PERMISSION_DENIED',
        data: [],
        meta: emptyMeta(orcBounds.limit, orcBounds.offset),
      };
      pedidos = {
        status: 'forbidden',
        code: 'PERMISSION_DENIED',
        data: [],
        meta: emptyMeta(pedBounds.limit, pedBounds.offset),
      };
    } else if (!clienteEmpresaId) {
      orcamentos = {
        status: 'skipped',
        code: 'CLIENTE_EMPRESA_LINK_REQUIRED',
        data: [],
        meta: emptyMeta(orcBounds.limit, orcBounds.offset),
      };
      pedidos = {
        status: 'skipped',
        code: 'CLIENTE_EMPRESA_LINK_REQUIRED',
        data: [],
        meta: emptyMeta(pedBounds.limit, pedBounds.offset),
      };
    } else {
      orcamentos = await this.loadOrcamentos(ctx, clienteEmpresaId, orcBounds);
      pedidos = await this.loadPedidos(ctx, clienteEmpresaId, pedBounds);
    }

    return {
      identity,
      empresaLink: empresaLink ? projectEmpresa(empresaLink) : null,
      blocks: {
        empresas,
        orcamentos,
        pedidos,
      },
      meta: {
        requestId: ctx.requestId ?? null,
        groupId: ctx.groupId,
        empresaId: ctx.empresaId,
        clienteId,
        clienteEmpresaId,
      },
    };
  }

  private async resolveEmpresaLink(
    ctx: RequestContext,
    clienteId: string,
  ): Promise<{ link: ClienteEmpresa | null; denied: boolean }> {
    try {
      return {
        link: await this.clientes.getEmpresaLink(ctx, clienteId, ctx.empresaId as string),
        denied: false,
      };
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) {
        return { link: null, denied: true };
      }
      if (error instanceof AppError && error.statusCode === 404) {
        return { link: null, denied: false };
      }
      throw error;
    }
  }

  private async loadEmpresas(
    ctx: RequestContext,
    clienteId: string,
    bounds: { limit: number; offset: number },
  ): Promise<ClienteCentral360Block<ClienteCentral360EmpresaProjection>> {
    return this.loadBlock(async () => {
      const page = await this.clientes.listEmpresaLinks(ctx, clienteId, {
        limit: bounds.limit,
        offset: bounds.offset,
      });
      return {
        data: page.data.map(projectEmpresa),
        meta: page.meta,
      };
    }, bounds);
  }

  private async loadOrcamentos(
    ctx: RequestContext,
    clienteEmpresaId: string,
    bounds: { limit: number; offset: number },
  ): Promise<ClienteCentral360Block<ClienteCentral360OrcamentoProjection>> {
    return this.loadBlock(async () => {
      const page = await this.orcamentos.list(ctx, {
        limit: bounds.limit,
        offset: bounds.offset,
        clienteEmpresaId,
      });
      return {
        data: page.data.map(projectOrcamento),
        meta: page.meta,
      };
    }, bounds);
  }

  private async loadPedidos(
    ctx: RequestContext,
    clienteEmpresaId: string,
    bounds: { limit: number; offset: number },
  ): Promise<ClienteCentral360Block<ClienteCentral360PedidoProjection>> {
    return this.loadBlock(async () => {
      const page = await this.pedidos.list(ctx, {
        limit: bounds.limit,
        offset: bounds.offset,
        clienteEmpresaId,
      });
      return {
        data: page.data.map(projectPedido),
        meta: page.meta,
      };
    }, bounds);
  }

  private async loadBlock<T>(
    loader: () => Promise<{ data: T[]; meta: NonNullable<ClienteCentral360Block<T>['meta']> }>,
    bounds: { limit: number; offset: number },
  ): Promise<ClienteCentral360Block<T>> {
    try {
      const page = await loader();
      return { status: 'ok', data: page.data, meta: page.meta };
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 403) {
        return {
          status: 'forbidden',
          code: error.code,
          data: [],
          meta: emptyMeta(bounds.limit, bounds.offset),
        };
      }
      if (error instanceof AppError) {
        return {
          status: 'unavailable',
          code: error.code,
          data: [],
          meta: emptyMeta(bounds.limit, bounds.offset),
        };
      }
      throw error;
    }
  }
}
