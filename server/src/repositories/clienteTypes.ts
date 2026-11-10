import { z } from 'zod';
import { isValidCnpj, isValidCpf, normalizeDocumento } from '../db/documentoValidators.js';

export const CLIENTE_TIPOS = ['Pessoa Física', 'Pessoa Jurídica'] as const;
export const CLIENTE_ORIGENS = [
  'ERP', 'MIGRACAO', 'SITE_CPA', 'B2B', 'PORTAL', 'CHATBOT', 'WHATSAPP',
  'MARKETPLACE', 'APP', 'API',
] as const;

/** Rich channels of the existing master; not a parallel person registry. */
export const CLIENTE_CONTATO_TIPOS = ['Telefone', 'Celular', 'WhatsApp', 'E-mail'] as const;
const contactText = (max: number, min = 0) => z.string().min(min).max(max)
  .refine(value => !/[\u0000-\u001f\u007f<>]/.test(value), 'invalid_contact_text');
export const clienteContatoSchema = z.object({
  id: contactText(120, 1).optional(),
  tipo: z.enum(CLIENTE_CONTATO_TIPOS),
  nome: contactText(180).nullable().optional(),
  cargo: contactText(120).nullable().optional(),
  departamento: contactText(120).nullable().optional(),
  valor: contactText(180).nullable().optional(),
  ramal: contactText(40).nullable().optional(),
  principal: z.boolean().optional(),
  ativo: z.boolean().optional(),
  origem: z.enum(CLIENTE_ORIGENS).optional(),
  observacao: contactText(2000).nullable().optional(),
  contato_b2b_id: contactText(120, 1).nullable().optional(),
  legacy_id: contactText(120, 1).nullable().optional(),
  codigo_legado: contactText(80, 1).nullable().optional(),
  source_system: contactText(80, 1).nullable().optional(),
  migration_batch: z.string().uuid().nullable().optional(),
}).strict().superRefine((contact, ctx) => {
  if (contact.tipo === 'E-mail' && contact.valor && !z.string().email().safeParse(contact.valor).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['valor'], message: 'invalid_contact_email' });
  }
  // Metadata-only contacts remain representable; never manufacture a channel value.
  if (!contact.valor && !contact.nome && !contact.cargo && !contact.observacao
      && !contact.legacy_id && !contact.id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'empty_contact' });
  }
});

export const clienteContatosReplaceSchema = z.object({
  expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
  contatos: z.array(clienteContatoSchema).max(200).optional(),
}).strict().superRefine((command, ctx) => {
  const ids = new Set<string>();
  let principals = 0;
  command.contatos?.forEach((contact, index) => {
    if (contact.id && ids.has(contact.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contatos', index, 'id'], message: 'duplicate_contact_identity' });
    }
    if (contact.id) ids.add(contact.id);
    if (contact.principal) principals++;
  });
  if (principals > 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['contatos'], message: 'conflicting_principal_contacts' });
});
export type ClienteContato = z.infer<typeof clienteContatoSchema>;
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
  /** Código de registro (importação); novos sem código usam reserva concorrente. */
  codigo: z.string().trim().max(80).optional().nullable(),
  codigo_legado: z.string().trim().min(1).max(80).optional().nullable(),
  legacy_id: z.string().trim().max(120).optional().nullable(),
  source_system: z.string().trim().min(1).max(80).optional().nullable(),
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
  contatos: clienteContatosReplaceSchema.innerType().shape.contatos,
  expectedVersion: clienteContatosReplaceSchema.innerType().shape.expectedVersion.optional(),
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
  codigo_legado: z.string().trim().min(1).max(80).optional().nullable(),
  legacy_id: z.string().trim().max(120).optional().nullable(),
  source_system: z.string().trim().min(1).max(80).optional().nullable(),
  migration_batch: z.string().trim().max(80).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
}).strict().superRefine((command, ctx) => {
  if (command.contatos !== undefined) {
    const result = clienteContatosReplaceSchema.safeParse({
      contatos: command.contatos, expectedVersion: command.expectedVersion,
    });
    if (!result.success) result.error.issues.forEach(issue => ctx.addIssue(issue));
  }
});

export type ClienteCreate = z.infer<typeof clienteCreateSchema>;
// NULL is internal restoration evidence, not a public replacement command.
export type ClienteUpdate = Omit<z.infer<typeof clienteUpdateSchema>, 'contatos' | 'expectedVersion'> & {
  contatos?: ClienteContato[] | null;
};

export type Cliente = {
  contatos?: ClienteContato[] | null;
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

/** Read-only operational projection; never accepted by create/update schemas. */
export const clienteOperacaoLinkSchema = z.object({
  id: z.string().uuid(), group_id: z.string().uuid(), cliente_id: z.string().uuid(),
  empresa_id: z.string().uuid(), ativo: z.literal(true), situacao_comercial: z.literal('ATIVO'),
  habilitado_operacao: z.literal(true), bloqueado: z.literal(false), elegivel_operacao: z.literal(true),
});
export const clienteOperacaoLinksSchema = z.array(clienteOperacaoLinkSchema).length(1);
export type ClienteListItem = Cliente & { empresa_operacao?: z.infer<typeof clienteOperacaoLinkSchema> };

const clienteEmpresaEditableFields = {
  situacao_comercial: z.enum(CLIENTE_EMPRESA_SITUACOES).optional(),
  habilitado_operacao: z.boolean().optional(),
  observacao_comercial: z.string().trim().max(2000).optional().nullable(),
  tabela_preco_id: z.string().uuid().nullable().optional(),
  condicao_pagamento_id: z.string().uuid().nullable().optional(),
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
  condicao_pagamento_id: string | null;
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
  'condicao_pagamento_id',
  'vendedor_id',
  'saldo_devedor',
  'titulo_vencido',
]);
