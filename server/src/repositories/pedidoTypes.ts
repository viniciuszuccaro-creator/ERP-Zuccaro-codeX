import type { DbQueryExecutor } from '../db/client.js';
import { z } from 'zod';
import { calculateOrcamento, orcamentoItemSchema } from './orcamentoTypes.js';

export const PEDIDO_STATUS = ['EM_ABERTO', 'EM_PRODUCAO', 'PRONTO_ENTREGA', 'PRONTO_RETIRADA', 'FINALIZADO', 'CANCELADO'] as const;
export const PEDIDO_TIPOS_OPERACAO = ['ENTREGA', 'RETIRADA'] as const;

/** Origens canônicas Onda 5 — alinhadas a ParametroOrigemPedido / policies de canal. */
export const PEDIDO_ORIGENS = [
  'MANUAL',
  'ORCAMENTO',
  'SITE',
  'PORTAL_B2B',
  'APP',
  'CHATBOT',
  'MARKETPLACE',
  'IMPORTACAO',
] as const;

export const pedidoItemSchema = orcamentoItemSchema.extend({
  requer_producao: z.boolean().optional().default(false),
}).strict();

export const pedidoCreateSchema = z.object({
  cliente_empresa_id: z.string().uuid(),
  cliente_local_id: z.string().uuid().nullable().optional(),
  obra_id: z.string().uuid().nullable().optional(),
  tabela_preco_id: z.string().uuid().nullable().optional(),
  condicao_pagamento_id: z.string().uuid(),
  orcamento_id: z.string().uuid().nullable().optional(),
  tipo_operacao: z.enum(PEDIDO_TIPOS_OPERACAO),
  data_entrega_solicitada: z.string().datetime(),
  observacoes: z.string().trim().max(1000).optional(),
  origem: z.enum(PEDIDO_ORIGENS).optional(),
  canal: z.string().trim().min(1).max(80).nullable().optional(),
  external_id: z.string().trim().min(1).max(160).nullable().optional(),
  idempotency_key: z.string().trim().min(1).max(160).nullable().optional(),
  itens: z.array(pedidoItemSchema).min(1).max(1000),
}).strict();

export type PedidoCreate = z.infer<typeof pedidoCreateSchema>;
export type PedidoStatus = typeof PEDIDO_STATUS[number];
export type PedidoOrigem = typeof PEDIDO_ORIGENS[number];
export type PedidoItem = z.infer<typeof pedidoItemSchema> & { subtotal: string; total: string };
export type PedidoHistorico = {
  id: string;
  group_id: string;
  empresa_id: string;
  pedido_id: string;
  status_anterior: PedidoStatus | null;
  status_novo: PedidoStatus;
  actor_id: string;
  motivo: string | null;
  created_at: string;
};
export type Pedido = {
  id: string;
  group_id: string;
  empresa_id: string;
  numero: string;
  status: PedidoStatus;
  cliente_empresa_id: string;
  cliente_local_id: string | null;
  obra_id: string | null;
  tabela_preco_id: string | null;
  condicao_pagamento_id: string;
  orcamento_id: string | null;
  vendedor_id: string;
  tipo_operacao: typeof PEDIDO_TIPOS_OPERACAO[number];
  data_entrega_solicitada: string;
  observacoes: string | null;
  origem: PedidoOrigem;
  canal: string | null;
  external_id: string | null;
  idempotency_key: string | null;
  subtotal: string;
  desconto: string;
  total: string;
  ativo: boolean;
  itens: PedidoItem[];
  created_at: string;
  updated_at: string;
};

export type PedidoScope = { groupId: string; empresaId: string };
export type PedidoListFilters = {
  search?: string;
  status?: PedidoStatus;
  clienteEmpresaId?: string;
  tipoOperacao?: typeof PEDIDO_TIPOS_OPERACAO[number];
  origem?: PedidoOrigem;
};
export type PedidoPage = { rows: Pedido[]; total: number };

export function calculatePedido(items: z.infer<typeof pedidoItemSchema>[]): Pick<Pedido, 'itens' | 'subtotal' | 'desconto' | 'total'> {
  const calculated = calculateOrcamento(items);
  return {
    ...calculated,
    itens: calculated.itens.map((item, index) => ({ ...item, requer_producao: items[index].requer_producao ?? false })),
  };
}

export interface PedidoRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  create(scope: PedidoScope, data: PedidoCreate, actorId: string, executor?: DbQueryExecutor): Promise<Pedido>;
  get(scope: PedidoScope, id: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  getByOrcamento(scope: PedidoScope, orcamentoId: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  getByIdempotencyKey(scope: PedidoScope, origem: PedidoOrigem, idempotencyKey: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  getByExternalId(scope: PedidoScope, origem: PedidoOrigem, externalId: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  list(scope: PedidoScope, limit?: number, offset?: number, executor?: DbQueryExecutor, filters?: PedidoListFilters): Promise<PedidoPage>;
  update(scope: PedidoScope, id: string, data: PedidoCreate, actorId: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  changeStatus(scope: PedidoScope, id: string, status: PedidoStatus, actorId: string, motivo?: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  history(scope: PedidoScope, id: string, executor?: DbQueryExecutor): Promise<PedidoHistorico[]>;
}
