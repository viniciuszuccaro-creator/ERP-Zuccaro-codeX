import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const uuid = z.string().uuid().transform(value=>value.toLowerCase());
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => v.slice(0,4)!=='0000'
  && Number.isFinite(new Date(v+'T00:00:00Z').getTime())
  && new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v, 'Invalid calendar day');
export const interacaoFieldsSchema = z.object({
  tipo: z.enum(['Ligação','E-mail','Reunião','Visita','WhatsApp','Chat','Outros']),
  titulo: text(240).min(1), descricao: text(4000).nullable().default(null),
  data_interacao: day, duracao: z.number().finite().min(0).max(1440).multipleOf(0.01).nullable().default(null),
  cliente_nome: text(240).nullable().default(null), responsavel: text(240).nullable().default(null),
  resultado: z.enum(['Positivo','Neutro','Negativo']).default('Neutro'),
  proxima_acao: text(240).nullable().default(null), data_proxima_acao: day.nullable().default(null),
  observacoes: text(4000).nullable().default(null),
}).strict();
export const interacaoCreateSchema = interacaoFieldsSchema.extend({
  cliente_empresa_id: uuid.nullable().default(null),
  oportunidade_id: uuid.nullable().default(null),
  idempotency_key: text(120).min(8),
}).refine(v => v.cliente_empresa_id || v.oportunidade_id, 'Canonical reference required');
export const interacaoPatchSchema = interacaoFieldsSchema.partial().extend({
  expected_version: z.number().int().positive(),
}).strict().refine(v => Object.entries(v).some(([k,value]) => k!=='expected_version' && value!==undefined), 'Patch required');
export const interacaoVersionSchema = z.object({expected_version:z.number().int().positive()}).strict();
export const interacaoListSchema = z.object({
  limit:z.coerce.number().int().min(1).max(200).default(50),
  offset:z.coerce.number().int().min(0).max(1000000).default(0),
  clienteEmpresaId:uuid.optional(), oportunidadeId:uuid.optional(),
  search:text(80).optional(), ativo:z.boolean().optional(),
}).strict();
export type InteracaoFields = z.infer<typeof interacaoFieldsSchema>;
export type InteracaoScope = {groupId:string;empresaId:string};
export type Interacao = InteracaoFields & {
  id:string;group_id:string;empresa_id:string;codigo:string;cliente_empresa_id:string|null;oportunidade_id:string|null;
  legacy_store_id:string|null;ativo:boolean;version:number;created_by:string;updated_by:string;created_at:string;updated_at:string;
};
export type InteracaoStored = Interacao & {idempotency_key:string;payload_fingerprint:string};
export type InteracaoFilters = z.infer<typeof interacaoListSchema>;
export function publicInteracao(row:InteracaoStored):Interacao {
  const {idempotency_key:_key,payload_fingerprint:_hash,...safe}=row;
  return safe;
}
