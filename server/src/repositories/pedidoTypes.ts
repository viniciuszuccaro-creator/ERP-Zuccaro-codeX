import type { DbQueryExecutor } from '../db/client.js';
import { z } from 'zod';
import { calculateOrcamento, orcamentoItemSchema } from './orcamentoTypes.js';
import type { CondicaoPagamentoParcelaSnapshot } from '../services/comercialCondicaoSnapshot.js';

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

/** Tipos comerciais do item (sem MISTO — MISTO só no cabeçalho). */
export const PEDIDO_TIPOS_COMERCIAIS_ITEM = [
  'REVENDA',
  'ARMADO',
  'CORTE_DOBRA',
  'FABRICADO',
  'KIT',
  'SERVICO',
] as const;

/** Tipos comerciais do Pedido (agregado; MISTO quando itens divergem). */
export const PEDIDO_TIPOS_COMERCIAIS = [...PEDIDO_TIPOS_COMERCIAIS_ITEM, 'MISTO'] as const;

export const pedidoItemSchema = orcamentoItemSchema.extend({
  requer_producao: z.boolean().optional().default(false),
  /** Hint opcional: somente ARMADO/CORTE_DOBRA com requer_producao; demais derivados do Produto. */
  tipo_comercial: z.enum(PEDIDO_TIPOS_COMERCIAIS_ITEM).optional(),
}).strict();

/** Payload do cliente — snapshots de condição/promoção/tabela são autoridade do servidor. */
export const pedidoPromocaoSchema = z.object({
  bps: z.number().int().positive().max(10000),
  cupom: z.string().trim().max(64).optional(),
}).strict();

/** Observações livres: remove controles/markup perigoso (paridade Orçamento). */
const cleanObservacoes = (value: string) => value
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/[<>]/g, '')
  .replace(/javascript:\s*/gi, '')
  .replace(/\s+/g, ' ')
  .trim();
const observacoesField = z.string().trim().max(1000).transform((value) => {
  const cleaned = cleanObservacoes(value);
  return cleaned || undefined;
}).optional();

export const pedidoCreateSchema = z.object({
  cliente_empresa_id: z.string().uuid(),
  cliente_local_id: z.string().uuid().nullable().optional(),
  obra_id: z.string().uuid().nullable().optional(),
  tabela_preco_id: z.string().uuid().nullable().optional(),
  condicao_pagamento_id: z.string().uuid(),
  orcamento_id: z.string().uuid().nullable().optional(),
  tipo_operacao: z.enum(PEDIDO_TIPOS_OPERACAO),
  data_entrega_solicitada: z.string().datetime(),
  observacoes: observacoesField,
  promocao: pedidoPromocaoSchema.optional(),
  origem: z.enum(PEDIDO_ORIGENS).optional(),
  canal: z.string().trim().min(1).max(80).nullable().optional(),
  external_id: z.string().trim().min(1).max(160).nullable().optional(),
  idempotency_key: z.string().trim().min(1).max(160).nullable().optional(),
  itens: z.array(pedidoItemSchema).min(1).max(1000),
}).strict();

export type PedidoCreate = z.infer<typeof pedidoCreateSchema>;
export type PedidoStatus = typeof PEDIDO_STATUS[number];
export type PedidoOrigem = typeof PEDIDO_ORIGENS[number];
export type PedidoTipoComercialItem = typeof PEDIDO_TIPOS_COMERCIAIS_ITEM[number];
export type PedidoTipoComercial = typeof PEDIDO_TIPOS_COMERCIAIS[number];
export type PedidoItem = Omit<z.infer<typeof pedidoItemSchema>, 'tipo_comercial'> & {
  subtotal: string;
  total: string;
  tipo_comercial_snapshot: PedidoTipoComercialItem;
};
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
  tabela_preco_codigo_snapshot: string | null;
  tabela_preco_nome_snapshot: string | null;
  condicao_pagamento_id: string;
  condicao_pagamento_codigo_snapshot: string | null;
  condicao_pagamento_nome_snapshot: string | null;
  condicao_pagamento_parcelas_snapshot: CondicaoPagamentoParcelaSnapshot[] | null;
  promocao_aplicada: boolean;
  promocao_bps: number | null;
  promocao_cupom: string | null;
  orcamento_id: string | null;
  vendedor_id: string;
  tipo_operacao: typeof PEDIDO_TIPOS_OPERACAO[number];
  data_entrega_solicitada: string;
  observacoes: string | null;
  origem: PedidoOrigem;
  canal: string | null;
  external_id: string | null;
  idempotency_key: string | null;
  tipo_comercial: PedidoTipoComercial;
  subtotal: string;
  desconto: string;
  total: string;
  ativo: boolean;
  itens: PedidoItem[];
  created_at: string;
  updated_at: string;
};

/** Create já resolvido pelo service (snapshots de tipo comercial server-side). */
export type PedidoCreateResolved = PedidoCreate & {
  tipo_comercial: PedidoTipoComercial;
  itens: Array<z.infer<typeof pedidoItemSchema> & { tipo_comercial_snapshot: PedidoTipoComercialItem }>;
};
export type PedidoWrite = Omit<PedidoCreateResolved, 'promocao'> & {
  condicao_pagamento_codigo_snapshot: string;
  condicao_pagamento_nome_snapshot: string;
  condicao_pagamento_parcelas_snapshot: CondicaoPagamentoParcelaSnapshot[];
  tabela_preco_codigo_snapshot: string | null;
  tabela_preco_nome_snapshot: string | null;
  promocao_aplicada: boolean;
  promocao_bps: number | null;
  promocao_cupom: string | null;
};

export type PedidoScope = { groupId: string; empresaId: string };
export type PedidoListFilters = {
  search?: string;
  status?: PedidoStatus;
  clienteEmpresaId?: string;
  tipoOperacao?: typeof PEDIDO_TIPOS_OPERACAO[number];
  origem?: PedidoOrigem;
  tipoComercial?: PedidoTipoComercial;
};
export type PedidoPage = { rows: Pedido[]; total: number };
export type PedidoTopProduct = { produto_id: string; unidade_id: string; quantidade_total: string; pedidos_count: number };

export function calculatePedido(
  items: Array<z.infer<typeof pedidoItemSchema> & { tipo_comercial_snapshot?: PedidoTipoComercialItem }>,
): Pick<Pedido, 'itens' | 'subtotal' | 'desconto' | 'total'> {
  const calculated = calculateOrcamento(items.map(({ tipo_comercial: _hint, ...item }) => item));
  return {
    ...calculated,
    itens: calculated.itens.map((item, index) => {
      const source = items[index]!;
      const { tipo_comercial: _hint, ...rest } = source;
      return {
        ...item,
        requer_producao: rest.requer_producao ?? false,
        tipo_comercial_snapshot: source.tipo_comercial_snapshot ?? 'REVENDA',
      };
    }),
  };
}

export interface PedidoRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  create(scope: PedidoScope, data: PedidoWrite, actorId: string, executor?: DbQueryExecutor): Promise<Pedido>;
  get(scope: PedidoScope, id: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  getByOrcamento(scope: PedidoScope, orcamentoId: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  getByIdempotencyKey(scope: PedidoScope, origem: PedidoOrigem, idempotencyKey: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  getByExternalId(scope: PedidoScope, origem: PedidoOrigem, externalId: string, executor?: DbQueryExecutor): Promise<Pedido | null>;
  list(scope: PedidoScope, limit?: number, offset?: number, executor?: DbQueryExecutor, filters?: PedidoListFilters): Promise<PedidoPage>;
  topProducts(scope: PedidoScope, clienteEmpresaId: string, limit: number, executor?: DbQueryExecutor): Promise<PedidoTopProduct[]>;
  update(scope: PedidoScope, id: string, data: PedidoWrite, actorId: string, executor?: DbQueryExecutor, preserveItems?: boolean): Promise<Pedido | null>;
  changeStatus(scope: PedidoScope, id: string, status: PedidoStatus, actorId: string, motivo?: string, executor?: DbQueryExecutor, expectedStatus?: PedidoStatus): Promise<Pedido | null>;
  history(scope: PedidoScope, id: string, executor?: DbQueryExecutor): Promise<PedidoHistorico[]>;
}
