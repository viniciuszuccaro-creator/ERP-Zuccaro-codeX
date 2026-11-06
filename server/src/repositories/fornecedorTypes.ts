import { z } from 'zod';
import { isValidCnpj, isValidCpf, normalizeDocumento } from '../db/documentoValidators.js';

const text = (max: number) => z.string().trim().max(max).default('');
const person = z.enum(['Pessoa Fisica', 'Pessoa Juridica', 'Pessoa Física', 'Pessoa Jurídica'])
  .transform(v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
const address = z.object({ endereco: text(300), bairro: text(120), cidade: text(120),
  estado: text(2), cep: text(12) }).strict();

/** Existing Fornecedor vocabulary. No bank, fiscal or operational financial fields. */
const fields = {
  tipo_pessoa: person, cpf_cnpj: z.string().transform(normalizeDocumento),
  codigo: z.string().trim().min(1).max(80), nome: text(180), razao_social: text(180),
  nome_fantasia: text(180), email: z.string().trim().email().max(180).or(z.literal('')).default(''),
  telefone: text(40), whatsapp: text(40), contato_responsavel: text(180),
  endereco: text(300), bairro: text(120), cidade: text(120), estado: text(2), cep: text(12),
  endereco_cobranca: address.nullable().default(null),
  tipo_fornecedor: text(80), categoria: text(80),
  status_fornecedor: z.enum(['Em Análise', 'Ativo', 'Bloqueado', 'Inativo']),
  status: z.enum(['Ativo', 'Inativo']),
  source_system: z.string().trim().min(1).max(80),
  codigo_legado: z.string().trim().min(1).max(80),
  legacy_id: z.string().trim().min(1).max(120),
  migration_batch: z.string().uuid(),
};
const base = z.object(fields).strict();
function validate(v: z.infer<typeof base>, ctx: z.RefinementCtx) {
  if (!(v.tipo_pessoa === 'Pessoa Fisica' ? isValidCpf(v.cpf_cnpj) : isValidCnpj(v.cpf_cnpj))) {
    ctx.addIssue({ code: 'custom', path: ['cpf_cnpj'], message: 'INVALID_DOCUMENT' });
  }
  if (!(v.tipo_pessoa === 'Pessoa Fisica' ? v.nome : v.razao_social)) {
    ctx.addIssue({ code: 'custom', path: ['nome'], message: 'NAME_REQUIRED' });
  }
}
export const fornecedorImportSchema = base.superRefine(validate);
export type FornecedorImport = z.infer<typeof fornecedorImportSchema>;
export type Fornecedor = FornecedorImport & {
  id: string; group_id: string; empresa_id: null; empresa_dona_id: null;
  ativo: boolean; origem: 'MIGRACAO'; revision: number;
  created_by: string; updated_by: string; created_at: Date; updated_at: Date;
};
export const fornecedorRowSchema = z.object({
  ...fields,
  id: z.string().uuid(), group_id: z.string().uuid(), empresa_id: z.null(), empresa_dona_id: z.null(),
  ativo: z.boolean(), origem: z.literal('MIGRACAO'), revision: z.number().int().positive(),
  created_by: z.string().uuid(), updated_by: z.string().uuid(),
  created_at: z.coerce.date(), updated_at: z.coerce.date(),
}).strict().superRefine(validate);
