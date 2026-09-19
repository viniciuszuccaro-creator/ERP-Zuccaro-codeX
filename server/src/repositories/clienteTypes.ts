import { z } from 'zod';
import { isValidCnpj, isValidCpf, normalizeDocumento } from '../db/documentoValidators.js';

export const CLIENTE_TIPOS = ['Pessoa Física', 'Pessoa Jurídica'] as const;
export const CLIENTE_ORIGENS = [
  'ERP', 'MIGRACAO', 'SITE_CPA', 'B2B', 'PORTAL', 'CHATBOT', 'WHATSAPP',
  'MARKETPLACE', 'APP', 'API',
] as const;
export const CLIENTE_EMPRESA_SITUACOES = ['PROSPECT', 'ATIVO', 'INATIVO'] as const;

/** Chaves RBAC canônicas; operações existentes são aplicadas por ClienteService. */
export const CLIENTE_RBAC_KEYS = Object.freeze([
  'cadastros.cliente.visualizar',
  'cadastros.cliente.criar',
  'cadastros.cliente.editar',
  'cadastros.cliente.inativar',
  'cadastros.cliente.restaurar',
  'cadastros.cliente.importar',
  'cadastros.cliente.exportar',
] as const);

export const CLIENTE_EMPRESA_RBAC_KEYS = Object.freeze([
  'cadastros.cliente-empresa.visualizar',
  'cadastros.cliente-empresa.criar',
  'cadastros.cliente-empresa.editar',
  'cadastros.cliente-empresa.inativar',
  'cadastros.cliente-empresa.restaurar',
  'cadastros.cliente-empresa.bloquear',
] as const);

const baseCreate = {
  empresa_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().optional().default(true),
};

export const clienteCreateSchema = z.object({
  ...baseCreate,
  tipo: z.enum(CLIENTE_TIPOS),
  documento: z.string().trim().max(32).optional().nullable(),
  cpf_cnpj: z.string().trim().max(32).optional().nullable(),
  nome: z.string().trim().max(300).optional().nullable(),
  razao_social: z.string().trim().max(300).optional().nullable(),
  nome_fantasia: z.string().trim().max(300).optional().nullable(),
  nome_social: z.string().trim().max(300).optional().nullable(),
  inscricao_estadual: z.string().trim().max(40).optional().nullable(),
  inscricao_municipal: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(180).optional().nullable().or(z.literal('')).transform((v) => (v === '' ? null : v)),
  telefone: z.string().trim().max(40).optional().nullable(),
  celular: z.string().trim().max(40).optional().nullable(),
  status: z.string().trim().max(40).optional().default('Ativo'),
  origem: z.enum(CLIENTE_ORIGENS).optional().default('ERP'),
  codigo_legado: z.string().trim().max(80).optional().nullable(),
  legacy_id: z.string().trim().max(120).optional().nullable(),
  source_system: z.string().trim().max(80).optional().nullable(),
  migration_batch: z.string().trim().max(80).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
}).strict().superRefine((data, ctx) => {
  const raw = data.documento ?? data.cpf_cnpj ?? '';
  const doc = normalizeDocumento(raw);
  if (!doc) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'documento obrigatorio', path: ['documento'] });
    return;
  }
  if (data.tipo === 'Pessoa Física') {
    if (!isValidCpf(doc)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CPF invalido', path: ['documento'] });
    }
    if (!data.nome || !String(data.nome).trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'nome obrigatorio para PF', path: ['nome'] });
    }
  } else {
    if (!isValidCnpj(doc)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CNPJ invalido', path: ['documento'] });
    }
    if (!data.razao_social || !String(data.razao_social).trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'razao_social obrigatoria para PJ', path: ['razao_social'] });
    }
  }
});

export const clienteUpdateSchema = z.object({
  empresa_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().optional(),
  tipo: z.enum(CLIENTE_TIPOS).optional(),
  documento: z.string().trim().max(32).optional().nullable(),
  cpf_cnpj: z.string().trim().max(32).optional().nullable(),
  nome: z.string().trim().max(300).optional().nullable(),
  razao_social: z.string().trim().max(300).optional().nullable(),
  nome_fantasia: z.string().trim().max(300).optional().nullable(),
  nome_social: z.string().trim().max(300).optional().nullable(),
  inscricao_estadual: z.string().trim().max(40).optional().nullable(),
  inscricao_municipal: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(180).optional().nullable().or(z.literal('')).transform((v) => (v === '' ? null : v)),
  telefone: z.string().trim().max(40).optional().nullable(),
  celular: z.string().trim().max(40).optional().nullable(),
  status: z.string().trim().max(40).optional(),
  origem: z.enum(CLIENTE_ORIGENS).optional(),
  codigo_legado: z.string().trim().max(80).optional().nullable(),
  legacy_id: z.string().trim().max(120).optional().nullable(),
  source_system: z.string().trim().max(80).optional().nullable(),
  migration_batch: z.string().trim().max(80).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
}).strict();

export type ClienteCreate = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdate = z.infer<typeof clienteUpdateSchema>;

export type Cliente = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  codigo: string;
  tipo: string;
  documento: string | null;
  documento_normalizado: string | null;
  nome: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  nome_social: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  status: string;
  origem: string;
  codigo_legado: string | null;
  legacy_id: string | null;
  source_system: string | null;
  migration_batch: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const clienteEmpresaEditableFields = {
  situacao_comercial: z.enum(CLIENTE_EMPRESA_SITUACOES).optional(),
  habilitado_operacao: z.boolean().optional(),
  observacao_comercial: z.string().trim().max(2000).optional().nullable(),
  tabela_preco_id: z.string().uuid().nullable().optional(),
  origem: z.enum(CLIENTE_ORIGENS).optional(),
  legacy_id: z.string().trim().max(120).optional().nullable(),
  legacy_code: z.string().trim().max(80).optional().nullable(),
  source_system: z.string().trim().max(80).optional().nullable(),
  migration_batch: z.string().trim().max(80).optional().nullable(),
  imported_at: z.string().datetime().optional().nullable(),
};

export const clienteEmpresaCreateSchema = z.object({
  ...clienteEmpresaEditableFields,
  situacao_comercial: z.enum(CLIENTE_EMPRESA_SITUACOES).optional().default('ATIVO'),
  habilitado_operacao: z.boolean().optional().default(true),
  origem: z.enum(CLIENTE_ORIGENS).optional().default('ERP'),
}).strict();

export const clienteEmpresaUpdateSchema = z.object(clienteEmpresaEditableFields).strict();

export const clienteEmpresaBlockSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
}).strict();

export type ClienteEmpresaCreate = z.infer<typeof clienteEmpresaCreateSchema>;
export type ClienteEmpresaUpdate = z.infer<typeof clienteEmpresaUpdateSchema>;

export type ClienteEmpresa = {
  id: string;
  group_id: string;
  cliente_id: string;
  empresa_id: string;
  ativo: boolean;
  situacao_comercial: typeof CLIENTE_EMPRESA_SITUACOES[number];
  habilitado_operacao: boolean;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  bloqueado_em: string | null;
  bloqueado_por: string | null;
  observacao_comercial: string | null;
  tabela_preco_id: string | null;
  origem: typeof CLIENTE_ORIGENS[number];
  legacy_id: string | null;
  legacy_code: string | null;
  source_system: string | null;
  migration_batch: string | null;
  imported_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  elegivel_operacao: boolean;
};

/** Campos proibidos no Cliente MASTER (preço só em ClienteEmpresa). */
export const CLIENTE_FORBIDDEN_FIELDS = Object.freeze([
  'limite_credito',
  'credito_disponivel',
  'tabela_preco_id',
  'vendedor_id',
  'saldo_devedor',
  'titulo_vencido',
]);
