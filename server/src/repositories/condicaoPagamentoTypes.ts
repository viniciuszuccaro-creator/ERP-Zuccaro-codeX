import { z } from 'zod';

export const CONDICAO_PAGAMENTO_RBAC_KEYS = Object.freeze([
  'cadastros.condicao_pagamento.visualizar', 'cadastros.condicao_pagamento.criar',
  'cadastros.condicao_pagamento.editar', 'cadastros.condicao_pagamento.inativar',
  'cadastros.condicao_pagamento.restaurar', 'cadastros.condicao_pagamento.vincular-empresa',
  'cadastros.condicao_pagamento.gerenciar-parcelas', 'cadastros.condicao_pagamento.definir-padrao',
] as const);

const cleanText = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
const text = (max: number) => z.string().trim().min(1).max(max).transform(cleanText);
const nullableText = (max: number) => z.string().trim().max(max).transform((value) => cleanText(value) || null).nullable().optional();
const percentual = z.union([z.string(), z.number()]).superRefine((value, ctx) => {
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(raw)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'percentual_decimal_scale_6_required' });
  else if (!Number.isFinite(Number(raw)) || Number(raw) <= 0 || Number(raw) > 100) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'percentual_must_be_gt_0_lte_100' });
}).transform((value) => String(value).trim());

export const condicaoPagamentoParcelaSchema = z.object({ ordem: z.number().int().min(1).max(999), dias: z.number().int().min(0).max(36500), percentual }).strict();
export const condicaoPagamentoParcelasSchema = z.array(condicaoPagamentoParcelaSchema).min(1).max(120).superRefine((parcelas, ctx) => {
  const ordens = new Set<number>(); let micros = 0n;
  for (const [index, parcela] of parcelas.entries()) {
    if (ordens.has(parcela.ordem)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'ordem_duplicada', path: [index, 'ordem'] });
    ordens.add(parcela.ordem); const [whole, fraction = ''] = parcela.percentual.split('.');
    micros += BigInt(whole) * 1000000n + BigInt((fraction + '000000').slice(0, 6));
  }
  if (micros !== 100000000n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'percentual_total_must_equal_100' });
});
export const condicaoPagamentoCreateSchema = z.object({ nome: text(160), descricao: nullableText(500), parcelas: condicaoPagamentoParcelasSchema, codigo_condicao_legado: nullableText(64), origem: z.string().trim().max(40).optional(), legacy_id: nullableText(120), legacy_code: nullableText(80), source_system: nullableText(80), migration_batch: nullableText(80), imported_at: z.string().datetime().nullable().optional() }).strict();
export const condicaoPagamentoUpdateSchema = z.object({ nome: text(160).optional(), descricao: nullableText(500), codigo_condicao_legado: nullableText(64) }).strict();
export type CondicaoPagamentoCreate = z.infer<typeof condicaoPagamentoCreateSchema>;
export type CondicaoPagamentoUpdate = z.infer<typeof condicaoPagamentoUpdateSchema>;
export type CondicaoPagamentoParcelaInput = z.infer<typeof condicaoPagamentoParcelaSchema>;
export type CondicaoPagamentoEmpresa = { id: string; group_id: string; condicao_pagamento_id: string; empresa_id: string; eh_padrao: boolean; ativo: boolean; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string };
export type CondicaoPagamentoParcela = { id: string; group_id: string; condicao_pagamento_id: string; ordem: number; dias: number; percentual: string; ativo: boolean; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string };
export type CondicaoPagamento = { id: string; group_id: string; empresa_id: string; codigo: string; nome: string; descricao: string | null; ativo: boolean; codigo_condicao_legado: string | null; origem: string; legacy_id: string | null; legacy_code: string | null; source_system: string | null; migration_batch: string | null; imported_at: string | null; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string; empresas: CondicaoPagamentoEmpresa[]; parcelas: CondicaoPagamentoParcela[] };
export function publicCondicaoPagamento(row: CondicaoPagamento, empresaId?: string | null) { return { id: row.id, group_id: row.group_id, empresa_id: row.empresa_id, codigo: row.codigo, nome: row.nome, descricao: row.descricao, ativo: row.ativo, codigo_condicao_legado: row.codigo_condicao_legado, origem: row.origem, created_at: row.created_at, updated_at: row.updated_at, empresas: row.empresas.filter((link) => link.ativo && (!empresaId || link.empresa_id === empresaId)).map((link) => ({ empresa_id: link.empresa_id, eh_padrao: link.eh_padrao, ativo: link.ativo })), parcelas: row.parcelas.filter((p) => p.ativo).sort((a, b) => a.ordem - b.ordem).map(publicCondicaoPagamentoParcela) }; }
export function publicCondicaoPagamentoParcela(row: CondicaoPagamentoParcela) { return { id: row.id, condicao_pagamento_id: row.condicao_pagamento_id, ordem: row.ordem, dias: row.dias, percentual: row.percentual, ativo: row.ativo, created_at: row.created_at, updated_at: row.updated_at }; }
export function condicaoPagamentoAuditSnapshot(row: CondicaoPagamento) { return { id: row.id, group_id: row.group_id, empresa_id: row.empresa_id, codigo: row.codigo, nome: row.nome, ativo: row.ativo, parcelas: row.parcelas.filter((p) => p.ativo).map((p) => ({ ordem: p.ordem, dias: p.dias, percentual: p.percentual })) }; }
export function condicaoPagamentoEmpresaAuditSnapshot(row: Pick<CondicaoPagamentoEmpresa, 'condicao_pagamento_id' | 'empresa_id' | 'eh_padrao' | 'ativo'>) { return row; }
