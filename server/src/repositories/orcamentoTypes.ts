import type { DbQueryExecutor } from '../db/client.js';
import { z } from 'zod';

const money = z.string().regex(/^\d+(\.\d{1,6})?$/).transform((v) => (
  v.includes('.')
    ? `${v.split('.')[0]}.${(v.split('.')[1]! + '000000').slice(0, 6)}`
    : `${v}.000000`
));

export const ORCAMENTO_STATUS = ['EM_ABERTO', 'CANCELADO', 'SUPERSEDIDO'] as const;
export type OrcamentoStatus = typeof ORCAMENTO_STATUS[number];

/** Origens canônicas Onda 4 — canais que criam Orçamento (sem ORCAMENTO). */
export const ORCAMENTO_ORIGENS = [
  'MANUAL',
  'SITE',
  'PORTAL_B2B',
  'APP',
  'CHATBOT',
  'MARKETPLACE',
  'IMPORTACAO',
  'CRM',
] as const;
export type OrcamentoOrigem = typeof ORCAMENTO_ORIGENS[number];

export const orcamentoItemSchema = z.object({
  produto_id: z.string().uuid(),
  unidade_id: z.string().uuid(),
  descricao: z.string().trim().min(1).max(240),
  unidade_sigla: z.string().trim().min(1).max(12),
  quantidade: money,
  preco_unitario: money,
  desconto: money.optional(),
}).strict();

export const orcamentoCreateSchema = z.object({
  cliente_empresa_id: z.string().uuid(),
  condicao_pagamento_id: z.string().uuid(),
  validade_em: z.string().datetime(),
  observacoes: z.string().trim().max(1000).optional(),
  origem: z.enum(ORCAMENTO_ORIGENS).optional(),
  canal: z.string().trim().min(1).max(80).nullable().optional(),
  external_id: z.string().trim().min(1).max(160).nullable().optional(),
  idempotency_key: z.string().trim().min(1).max(160).nullable().optional(),
  campanha: z.string().trim().min(1).max(120).nullable().optional(),
  itens: z.array(orcamentoItemSchema).min(1).max(1000),
}).strict();

export type OrcamentoCreate = z.infer<typeof orcamentoCreateSchema>;
export type OrcamentoItem = z.infer<typeof orcamentoItemSchema> & { subtotal: string; total: string };

export type Orcamento = {
  id: string;
  group_id: string;
  empresa_id: string;
  numero: string;
  versao: number;
  orcamento_raiz_id: string;
  supersedido_por_id: string | null;
  status: OrcamentoStatus;
  cliente_empresa_id: string;
  condicao_pagamento_id: string;
  validade_em: string;
  observacoes: string | null;
  origem: OrcamentoOrigem;
  canal: string | null;
  external_id: string | null;
  idempotency_key: string | null;
  campanha: string | null;
  subtotal: string;
  desconto: string;
  total: string;
  ativo: boolean;
  itens: OrcamentoItem[];
  created_at: string;
  updated_at: string;
};

const micros = (v: string) => {
  const [i, f = ''] = v.split('.');
  return BigInt(i!) * 1000000n + BigInt((f + '000000').slice(0, 6));
};
const fmt = (v: bigint) => `${v / 1000000n}.${(v % 1000000n).toString().padStart(6, '0')}`;

export function calculateOrcamento(
  items: z.infer<typeof orcamentoItemSchema>[],
): Pick<Orcamento, 'itens' | 'subtotal' | 'desconto' | 'total'> {
  let subtotal = 0n;
  let desconto = 0n;
  const rows = items.map((i) => {
    const s = micros(i.quantidade) * micros(i.preco_unitario) / 1000000n;
    const d = micros(i.desconto ?? '0');
    if (d > s) throw new Error('ORCAMENTO_DESCONTO_INVALIDO');
    subtotal += s;
    desconto += d;
    return { ...i, subtotal: fmt(s), total: fmt(s - d) };
  });
  return { itens: rows, subtotal: fmt(subtotal), desconto: fmt(desconto), total: fmt(subtotal - desconto) };
}

export type OrcamentoAnexoStatus = 'QUARENTENA' | 'ATIVO' | 'REJEITADO' | 'INATIVO';

export const orcamentoAnexoCreateSchema = z.object({
  storage_key: z.string().trim().min(1).max(500),
  nome_arquivo: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(120),
  tamanho_bytes: z.number().int().positive().max(52_428_800),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).transform((v) => v.toLowerCase()),
  versao: z.number().int().positive().optional().default(1),
}).strict();

export type OrcamentoAnexoCreate = z.infer<typeof orcamentoAnexoCreateSchema>;
export type OrcamentoAnexo = OrcamentoAnexoCreate & {
  id: string;
  group_id: string;
  empresa_id: string;
  orcamento_id: string;
  status: OrcamentoAnexoStatus;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type OrcamentoScope = { groupId: string; empresaId: string };
export type OrcamentoPage = { rows: Orcamento[]; total: number };
export type OrcamentoListFilters = {
  search?: string;
  status?: OrcamentoStatus;
  clienteEmpresaId?: string;
  validadeDe?: string;
  validadeAte?: string;
  origem?: OrcamentoOrigem;
};

export type OrcamentoRepository = {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  create(scope: OrcamentoScope, data: OrcamentoCreate, executor?: DbQueryExecutor): Promise<Orcamento>;
  get(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor): Promise<Orcamento | null>;
  getByIdempotencyKey(scope: OrcamentoScope, origem: OrcamentoOrigem, idempotencyKey: string, executor?: DbQueryExecutor): Promise<Orcamento | null>;
  getByExternalId(scope: OrcamentoScope, origem: OrcamentoOrigem, externalId: string, executor?: DbQueryExecutor): Promise<Orcamento | null>;
  list(scope: OrcamentoScope, limit?: number, offset?: number, executor?: DbQueryExecutor, filters?: OrcamentoListFilters): Promise<OrcamentoPage>;
  listVersions(scope: OrcamentoScope, raizId: string, executor?: DbQueryExecutor): Promise<Orcamento[]>;
  update(scope: OrcamentoScope, id: string, data: OrcamentoCreate, executor?: DbQueryExecutor): Promise<Orcamento | null>;
  cancel(scope: OrcamentoScope, id: string, executor?: DbQueryExecutor): Promise<Orcamento | null>;
  createVersion(
    scope: OrcamentoScope,
    sourceId: string,
    data: OrcamentoCreate,
    executor?: DbQueryExecutor,
  ): Promise<{ previous: Orcamento; current: Orcamento }>;
  listAnexos(scope: OrcamentoScope, orcamentoId: string, executor?: DbQueryExecutor): Promise<OrcamentoAnexo[]>;
  createAnexo(scope: OrcamentoScope, orcamentoId: string, data: OrcamentoAnexoCreate, actorId: string, executor?: DbQueryExecutor): Promise<OrcamentoAnexo>;
  deactivateAnexo(scope: OrcamentoScope, orcamentoId: string, anexoId: string, actorId: string, executor?: DbQueryExecutor): Promise<OrcamentoAnexo | null>;
};
