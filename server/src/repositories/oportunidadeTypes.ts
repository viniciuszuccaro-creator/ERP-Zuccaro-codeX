import { z } from 'zod';
import type { DbQueryExecutor } from '../db/client.js';

const text = (max: number) => z.string().trim().max(max);
const money = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/)
  .transform(v => `${v.split('.')[0]}.${((v.split('.')[1] ?? '') + '000000').slice(0, 6)}`);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>v.slice(0,4)!=='0000'
  && Number.isFinite(new Date(v+'T00:00:00Z').getTime()) && new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,'Invalid date');
const fields = {
  titulo: text(240).min(1),
  descricao:text(2000).nullable().optional(),responsavel:text(240).nullable().optional(),
  cliente_empresa_id: z.string().uuid().nullable().optional(),
  cliente_nome: text(240).nullable().optional(),
  cliente_email: z.string().trim().email().max(254).or(z.literal('')).nullable().optional().transform(v=>v===''?null:v),
  cliente_telefone: text(40).nullable().optional(),
  etapa: text(60).min(1).optional(),
  valor_estimado: money.optional(),
  orcamento_cliente:money.optional(),
  probabilidade: z.number().min(0).max(100).multipleOf(0.01).optional(),
  temperatura: text(40).min(1).optional(),
  origem: text(80).min(1).optional(),
  observacoes: text(2000).nullable().optional(),
  necessidades: text(2000).nullable().optional(),
  data_abertura:day.optional(),data_previsao:day.nullable().optional(),
  proxima_acao:text(240).nullable().optional(),data_proxima_acao:day.nullable().optional(),
  // Interest metadata never authorizes use on a sale or stock movement.
  produtos_interesse:z.array(z.union([text(240),z.object({produto_id:z.string().uuid().optional(),
    codigo:text(80).optional(),descricao:text(240).optional()}).strict()])).max(100).optional(),
};
export const oportunidadeCreateSchema = z.object({ ...fields,
  idempotency_key: text(120).min(8),
}).strict();
export const oportunidadeUpdateSchema = z.object({ ...fields }).partial().extend({
  expected_version: z.number().int().positive(),
  status: z.enum(['Aberto','Em Andamento','Nova','Ganho','Perdido','Cancelado']).optional(),
}).strict().refine(v => Object.entries(v).some(([k,value]) => k !== 'expected_version' && value !== undefined), 'Patch required');
export const oportunidadeLinkSchema = z.object({ orcamento_id: z.string().uuid(),
  expected_version: z.number().int().positive() }).strict();
export type OportunidadeCreate = z.infer<typeof oportunidadeCreateSchema>;
export type OportunidadeUpdate = z.infer<typeof oportunidadeUpdateSchema>;
export type OportunidadeScope = { groupId: string; empresaId: string };
export type OportunidadeFields = {
  cliente_empresa_id: string | null; cliente_id: string | null;
  cliente_nome: string | null; cliente_email: string | null; cliente_telefone: string | null;
  titulo: string; descricao:string|null;responsavel:string|null;etapa: string; status: string; valor_estimado: string; orcamento_cliente:string;probabilidade: number;
  temperatura: string; origem: string; observacoes: string | null; necessidades: string | null;
  data_abertura: string; data_previsao:string|null;proxima_acao:string|null;data_proxima_acao:string|null;
  produtos_interesse:unknown[];data_fechamento: string | null; historico_mudancas_etapa: unknown[];
  orcamento_id: string | null; legacy_orcamento_id: string | null; pedido_id: string | null; convertido_em: 'orcamento' | 'pedido' | null;
  convertido_em_id: string | null;
};
export type Oportunidade = OportunidadeFields & {
  id: string; group_id: string; empresa_id: string; codigo: string; codigo_oportunidade: string;
  legacy_store_id: string | null; idempotency_key: string; payload_fingerprint: string;
  ativo: boolean; version: number; created_by: string; updated_by: string;
  created_at: string; updated_at: string;
};
export const OPORTUNIDADE_FIELDS = ['cliente_empresa_id','cliente_id','cliente_nome','cliente_email','cliente_telefone',
  'titulo','descricao','responsavel','etapa','status','valor_estimado','orcamento_cliente','probabilidade','temperatura','origem',
  'observacoes','necessidades','data_abertura','data_previsao','proxima_acao','data_proxima_acao','produtos_interesse',
  'data_fechamento','historico_mudancas_etapa','orcamento_id','legacy_orcamento_id','pedido_id','convertido_em','convertido_em_id'] as const satisfies readonly (keyof OportunidadeFields)[];
export type OportunidadeFilters = { limit: number; offset: number; search?: string;
  ativo?: boolean; status?: string; clienteEmpresaId?: string };
export interface OportunidadeRepository {
  withTransaction<T>(scope: OportunidadeScope, fn: (tx?: DbQueryExecutor) => Promise<T>): Promise<T>;
  lockIdempotency(scope: OportunidadeScope, key: string, tx?: DbQueryExecutor): Promise<void>;
  byKey(scope: OportunidadeScope, key: string, tx?: DbQueryExecutor): Promise<Oportunidade | null>;
  byLegacy(scope: OportunidadeScope, id: string, tx?: DbQueryExecutor): Promise<Oportunidade | null>;
  get(scope: OportunidadeScope, id: string, tx?: DbQueryExecutor, lock?: boolean): Promise<Oportunidade | null>;
  list(scope: OportunidadeScope, filters: OportunidadeFilters, tx?: DbQueryExecutor): Promise<{ rows: Oportunidade[]; total: number }>;
  create(scope: OportunidadeScope, fields: OportunidadeFields, key: string, hash: string,
    actor: string, tx?: DbQueryExecutor): Promise<Oportunidade>;
  update(scope: OportunidadeScope, id: string, expectedVersion: number, fields: OportunidadeFields,
    actor: string, tx?: DbQueryExecutor): Promise<Oportunidade | null>;
  setActive(scope: OportunidadeScope, id: string, expectedVersion: number, active: boolean,
    actor: string, tx?: DbQueryExecutor): Promise<Oportunidade | null>;
}
