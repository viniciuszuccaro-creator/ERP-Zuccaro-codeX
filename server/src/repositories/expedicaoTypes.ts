import type { DbQueryExecutor } from '../db/client.js';
import { z } from 'zod';

export const ENTREGA_STATUS = [
  'AGUARDANDO_SEPARACAO',
  'EM_SEPARACAO',
  'PRONTO_EXPEDIR',
  'EM_ROMANEIO',
  'SAIU_ENTREGA',
  'ENTREGUE_PARCIAL',
  'ENTREGUE',
  'FRUSTRADA',
  'DEVOLVIDA',
  'CANCELADA',
] as const;

export const ROMANEIO_STATUS = ['RASCUNHO', 'APROVADO', 'EM_ROTA', 'CONCLUIDO', 'CANCELADO'] as const;
export const SEPARACAO_STATUS = ['em_andamento', 'concluido', 'com_divergencia', 'cancelado'] as const;
export const TIPO_FRETE = ['ENTREGA', 'RETIRADA'] as const;

export type EntregaStatus = typeof ENTREGA_STATUS[number];
export type RomaneioStatus = typeof ROMANEIO_STATUS[number];
export type SeparacaoStatus = typeof SEPARACAO_STATUS[number];

/** Labels SPA existentes — facade HTTP mapeia code ↔ label. */
export const ENTREGA_STATUS_LABEL: Record<EntregaStatus, string> = {
  AGUARDANDO_SEPARACAO: 'Aguardando Separacao',
  EM_SEPARACAO: 'Em Separacao',
  PRONTO_EXPEDIR: 'Pronto para Expedir',
  EM_ROMANEIO: 'Em Romaneio',
  SAIU_ENTREGA: 'Saiu para Entrega',
  ENTREGUE_PARCIAL: 'Entrega Parcial',
  ENTREGUE: 'Entregue',
  FRUSTRADA: 'Entrega Frustrada',
  DEVOLVIDA: 'Devolvido',
  CANCELADA: 'Cancelado',
};

export function entregaStatusToLabel(status: EntregaStatus): string {
  return ENTREGA_STATUS_LABEL[status] ?? status;
}

export function parseEntregaStatusLabel(value: unknown): EntregaStatus | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if ((ENTREGA_STATUS as readonly string[]).includes(raw)) return raw as EntregaStatus;
  const norm = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('cancel')) return 'CANCELADA';
  if (norm.includes('devolv')) return 'DEVOLVIDA';
  if (norm.includes('frustr')) return 'FRUSTRADA';
  if (norm.includes('parcial')) return 'ENTREGUE_PARCIAL';
  if (norm.includes('entregue')) return 'ENTREGUE';
  if (norm.includes('saiu') || (norm.includes('transito') && !norm.includes('romane'))) return 'SAIU_ENTREGA';
  if (norm.includes('romane')) return 'EM_ROMANEIO';
  if (norm.includes('pronto') && norm.includes('exped')) return 'PRONTO_EXPEDIR';
  if (norm.includes('separ')) return 'EM_SEPARACAO';
  if (norm.includes('aguard')) return 'AGUARDANDO_SEPARACAO';
  return null;
}

const qty = z.union([z.string(), z.number()]).transform((v) => {
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error('Quantidade invalida');
  return n.toFixed(6);
});

export const entregaItemSchema = z.object({
  produto_id: z.string().uuid().nullable().optional(),
  descricao: z.string().trim().min(1).max(500),
  unidade_sigla: z.string().trim().min(1).max(20).default('UN'),
  quantidade_pedida: qty,
  quantidade_separada: qty.optional(),
  quantidade_entregue: qty.optional(),
  quantidade_devolvida: qty.optional(),
}).strict();

export const entregaCreateSchema = z.object({
  pedido_id: z.string().uuid().nullable().optional(),
  pedido_numero: z.string().trim().max(40).nullable().optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  cliente_nome: z.string().trim().max(200).nullable().optional(),
  cliente_empresa_id: z.string().uuid().nullable().optional(),
  cliente_local_id: z.string().uuid().nullable().optional(),
  tipo_frete: z.enum(TIPO_FRETE).optional().default('ENTREGA'),
  data_entrega_solicitada: z.string().datetime().nullable().optional(),
  data_previsao: z.string().datetime().nullable().optional(),
  cidade: z.string().trim().max(120).nullable().optional(),
  endereco: z.record(z.unknown()).optional(),
  volumes: qty.optional(),
  observacoes: z.string().trim().max(2000).optional(),
  idempotency_key: z.string().trim().min(4).max(120).optional(),
  itens: z.array(entregaItemSchema).min(1).max(1000),
}).strict();

export const separacaoConcluirSchema = z.object({
  confirmed: z.literal(true),
  checklist: z.object({
    conferiu_quantidade: z.literal(true),
    conferiu_qualidade: z.literal(true),
    conferiu_embalagem: z.literal(true),
    conferiu_etiquetas: z.literal(true),
    conferiu_documentos: z.literal(true),
  }).strict(),
  itens: z.array(z.object({
    produto_id: z.string().uuid().nullable().optional(),
    descricao: z.string().trim().min(1).max(500).optional(),
    unidade_sigla: z.string().trim().min(1).max(20).optional(),
    quantidade_pedida: qty,
    quantidade_separada: qty,
  }).strict()).min(1).max(1000),
  idempotency_key: z.string().trim().min(4).max(120).optional(),
}).strict();

export const romaneioCreateSchema = z.object({
  confirmed: z.literal(true),
  motorista_id: z.string().uuid().nullable().optional(),
  motorista_nome: z.string().trim().min(1).max(200),
  veiculo: z.string().trim().min(1).max(120),
  placa: z.string().trim().min(1).max(20),
  tipo_veiculo: z.string().trim().max(60).optional().default('Caminhao'),
  instrucoes_motorista: z.string().trim().max(2000).optional(),
  checklist_saida: z.object({
    documentos_ok: z.literal(true),
    veiculo_ok: z.literal(true),
    carga_conferida: z.literal(true),
    combustivel_ok: z.literal(true),
  }).strict(),
  entregas_ids: z.array(z.string().uuid()).min(1).max(500),
  despachar: z.boolean().optional().default(true),
  idempotency_key: z.string().trim().min(4).max(120).optional(),
}).strict();

export const registroFinalSchema = z.object({
  confirmed: z.literal(true),
  modo: z.enum(['total', 'parcial', 'ocorrencia']),
  comprovante: z.object({
    nome_recebedor: z.string().trim().min(1).max(200).optional(),
    documento_recebedor: z.string().trim().max(40).optional(),
    foto_comprovante: z.string().trim().max(2000).optional(),
    assinatura_digital: z.string().trim().max(2000).optional(),
  }).strict().optional(),
  quantidade_entregue: qty.optional(),
  motivo: z.string().trim().max(500).optional(),
  idempotency_key: z.string().trim().min(4).max(120).optional(),
}).strict();

export const devolucaoSchema = z.object({
  confirmed: z.literal(true),
  motivo: z.string().trim().min(1).max(500),
  acao: z.string().trim().min(1).max(120),
  quantidade_devolvida: qty.optional(),
  valor_devolvido: qty.optional(),
  itens: z.array(z.object({
    item_id: z.string().uuid().optional(),
    quantidade_devolvida: qty,
  }).strict()).optional(),
  idempotency_key: z.string().trim().min(4).max(120).optional(),
}).strict().refine(
  (d) => (d.quantidade_devolvida != null && Number(d.quantidade_devolvida) > 0)
    || (d.valor_devolvido != null && Number(d.valor_devolvido) > 0)
    || (Array.isArray(d.itens) && d.itens.some((i) => Number(i.quantidade_devolvida) > 0)),
  { message: 'Devolucao exige quantidade ou valor' },
);

export type EntregaCreate = z.infer<typeof entregaCreateSchema>;
export type SeparacaoConcluir = z.infer<typeof separacaoConcluirSchema>;
export type RomaneioCreate = z.infer<typeof romaneioCreateSchema>;
export type RegistroFinal = z.infer<typeof registroFinalSchema>;
export type DevolucaoInput = z.infer<typeof devolucaoSchema>;

export type EntregaItem = {
  id: string;
  produto_id: string | null;
  descricao: string;
  unidade_sigla: string;
  quantidade_pedida: string;
  quantidade_separada: string;
  quantidade_entregue: string;
  quantidade_devolvida: string;
};

export type EntregaHistorico = {
  id: string;
  group_id: string;
  empresa_id: string;
  entrega_id: string;
  status_anterior: EntregaStatus | null;
  status_novo: EntregaStatus;
  actor_id: string;
  motivo: string | null;
  idempotency_key: string | null;
  created_at: string;
};

export type Entrega = {
  id: string;
  group_id: string;
  empresa_id: string;
  numero: string;
  status: EntregaStatus;
  status_label: string;
  pedido_id: string | null;
  pedido_numero: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_empresa_id: string | null;
  cliente_local_id: string | null;
  tipo_frete: typeof TIPO_FRETE[number];
  data_entrega_solicitada: string | null;
  data_previsao: string | null;
  data_saida: string | null;
  data_entrega: string | null;
  romaneio_id: string | null;
  motorista_id: string | null;
  motorista_nome: string | null;
  veiculo: string | null;
  placa: string | null;
  sequencia_rota: number | null;
  cidade: string | null;
  endereco: Record<string, unknown>;
  comprovante_entrega: Record<string, unknown>;
  entrega_parcial: Record<string, unknown>;
  entrega_frustrada: Record<string, unknown>;
  logistica_reversa: Record<string, unknown>;
  quantidade_total: string;
  volumes: string;
  observacoes: string | null;
  idempotency_key: string | null;
  qr_code: string | null;
  numero_entrega: string;
  ativo: boolean;
  itens: EntregaItem[];
  created_at: string;
  updated_at: string;
};

export type Romaneio = {
  id: string;
  group_id: string;
  empresa_id: string;
  numero: string;
  status: RomaneioStatus;
  data_romaneio: string;
  data_saida: string | null;
  motorista_id: string | null;
  motorista_nome: string;
  veiculo: string;
  placa: string;
  tipo_veiculo: string;
  entregas_ids: string[];
  entregas_key: string;
  quantidade_entregas: number;
  instrucoes_motorista: string | null;
  checklist_saida: Record<string, unknown>;
  idempotency_key: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Separacao = {
  id: string;
  group_id: string;
  empresa_id: string;
  entrega_id: string;
  pedido_id: string | null;
  tipo: string;
  status: SeparacaoStatus;
  tem_divergencia: boolean;
  divergencias_resumo: string | null;
  checklist: Record<string, unknown>;
  itens: unknown[];
  idempotency_key: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ExpedicaoScope = { groupId: string; empresaId: string };
export type EntregaListFilters = {
  search?: string;
  status?: EntregaStatus;
  pedidoId?: string;
  cidade?: string;
  clienteId?: string;
};
export type EntregaPage = { rows: Entrega[]; total: number };
export type RomaneioPage = { rows: Romaneio[]; total: number };

export function sortedEntregasKey(ids: string[]): string {
  return [...ids].map(String).filter(Boolean).sort().join(',');
}

export function sumQty(values: string[]): string {
  let total = 0;
  for (const value of values) total += Number(value) || 0;
  return total.toFixed(6);
}

export interface ExpedicaoRepository {
  withTransaction<T>(fn: (executor?: DbQueryExecutor) => Promise<T>): Promise<T>;
  createEntrega(scope: ExpedicaoScope, data: EntregaCreate, actorId: string, executor?: DbQueryExecutor): Promise<Entrega>;
  getEntrega(scope: ExpedicaoScope, id: string, executor?: DbQueryExecutor): Promise<Entrega | null>;
  getEntregaByPedido(scope: ExpedicaoScope, pedidoId: string, executor?: DbQueryExecutor): Promise<Entrega | null>;
  getEntregaByIdempotency(scope: ExpedicaoScope, key: string, executor?: DbQueryExecutor): Promise<Entrega | null>;
  listEntregas(scope: ExpedicaoScope, limit?: number, offset?: number, executor?: DbQueryExecutor, filters?: EntregaListFilters): Promise<EntregaPage>;
  updateEntregaRow(scope: ExpedicaoScope, id: string, patch: Partial<Entrega> & { itens?: EntregaItem[] }, actorId: string, executor?: DbQueryExecutor): Promise<Entrega | null>;
  changeEntregaStatus(scope: ExpedicaoScope, id: string, status: EntregaStatus, actorId: string, motivo?: string, idempotencyKey?: string, executor?: DbQueryExecutor): Promise<Entrega | null>;
  historyEntrega(scope: ExpedicaoScope, id: string, executor?: DbQueryExecutor): Promise<EntregaHistorico[]>;
  createSeparacao(scope: ExpedicaoScope, row: Omit<Separacao, 'id' | 'created_at' | 'updated_at'>, actorId: string, executor?: DbQueryExecutor): Promise<Separacao>;
  getSeparacaoByEntrega(scope: ExpedicaoScope, entregaId: string, tipo?: string, executor?: DbQueryExecutor): Promise<Separacao | null>;
  createRomaneio(scope: ExpedicaoScope, data: RomaneioCreate & { entregas_key: string }, actorId: string, executor?: DbQueryExecutor): Promise<Romaneio>;
  getRomaneio(scope: ExpedicaoScope, id: string, executor?: DbQueryExecutor): Promise<Romaneio | null>;
  getRomaneioByEntregasKey(scope: ExpedicaoScope, key: string, executor?: DbQueryExecutor): Promise<Romaneio | null>;
  getRomaneioByIdempotency(scope: ExpedicaoScope, key: string, executor?: DbQueryExecutor): Promise<Romaneio | null>;
  listRomaneios(scope: ExpedicaoScope, limit?: number, offset?: number, executor?: DbQueryExecutor): Promise<RomaneioPage>;
  updateRomaneioStatus(scope: ExpedicaoScope, id: string, status: RomaneioStatus, actorId: string, executor?: DbQueryExecutor): Promise<Romaneio | null>;
}

/**
 * Portas reservadas — side-effects Pedido/estoque coordenados com Codex Comercial.
 * Default: reserved (nao muta Pedido/estoque ate tip-port autorizado).
 */
export type ExpedicaoPedidoSideEffectPort = {
  onSeparacaoConcluida(input: {
    groupId: string; empresaId: string; pedidoId: string | null; entregaId: string; actorId?: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied'>;
  onDespacho(input: {
    groupId: string; empresaId: string; pedidoIds: string[]; romaneioId: string; actorId?: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied'>;
  onCancelamento?(input: {
    groupId: string; empresaId: string; pedidoId: string | null; entregaId: string; actorId?: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied'>;
};

export type ExpedicaoEstoquePort = {
  onDespacho(input: {
    groupId: string; empresaId: string; entregaIds: string[]; actorId?: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied' | 'failed'>;
  onDevolucao(input: {
    groupId: string; empresaId: string; entregaId: string; quantidade: string; actorId?: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied' | 'failed'>;
  onCancelamento?(input: {
    groupId: string; empresaId: string; entregaId: string; actorId?: string;
  }, executor?: DbQueryExecutor): Promise<'reserved' | 'applied' | 'failed'>;
};

export const reservedPedidoPort: ExpedicaoPedidoSideEffectPort = {
  async onSeparacaoConcluida() { return 'reserved'; },
  async onDespacho() { return 'reserved'; },
};

export const reservedEstoquePort: ExpedicaoEstoquePort = {
  async onDespacho() { return 'reserved'; },
  async onDevolucao() { return 'reserved'; },
};
