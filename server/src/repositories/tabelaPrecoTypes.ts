import { z } from 'zod';

export const TABELA_PRECO_RBAC_KEYS = Object.freeze([
  'cadastros.tabela_preco.visualizar',
  'cadastros.tabela_preco.criar',
  'cadastros.tabela_preco.editar',
  'cadastros.tabela_preco.inativar',
  'cadastros.tabela_preco.restaurar',
  'cadastros.tabela_preco.vincular-empresa',
  'cadastros.tabela_preco.gerenciar-itens',
  'cadastros.tabela_preco.definir-padrao',
] as const);

const cleanText = (value: string) => value
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/[<>]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const text = (max: number) => z.string().trim().min(1).max(max).transform(cleanText);
const nullableText = (max: number) => z.string().trim().max(max)
  .transform((value) => cleanText(value) || null)
  .nullable()
  .optional();

const uuid = z.string().uuid();

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date_yyyy_mm_dd');

const precoSchema = z.union([z.number(), z.string()]).superRefine((value, ctx) => {
  const raw = typeof value === 'number' ? value.toString() : value.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_price' });
    return;
  }
  const parts = raw.split('.');
  if ((parts[1]?.length ?? 0) > 6) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'price_scale_gt_6' });
    return;
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'price_must_be_gte_0' });
  }
}).transform((value) => {
  const raw = typeof value === 'number' ? value.toFixed(6).replace(/\.?0+$/, '') : value.trim();
  // Keep exact decimal string with up to 6 places, without silent round-up beyond input.
  if (typeof value === 'number') {
    const fixed = value.toFixed(6);
    return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') || '0';
  }
  return raw.includes('.') ? raw.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.$/, '') : raw;
});

export const tabelaPrecoCreateSchema = z.object({
  nome: text(160),
  descricao: nullableText(500),
  vigencia_inicio: dateOnly,
  vigencia_fim: dateOnly.nullable().optional(),
  moeda: z.literal('BRL').optional().default('BRL'),
  codigo_tabela_legado: nullableText(64),
  origem: z.string().trim().max(40).optional(),
  legacy_id: nullableText(120),
  legacy_code: nullableText(80),
  source_system: nullableText(80),
  migration_batch: nullableText(80),
  imported_at: z.string().datetime().nullable().optional(),
}).strict().superRefine((data, ctx) => {
  if (data.vigencia_fim && data.vigencia_fim < data.vigencia_inicio) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'vigencia_fim_before_inicio',
      path: ['vigencia_fim'],
    });
  }
});

export const tabelaPrecoUpdateSchema = z.object({
  nome: text(160).optional(),
  descricao: nullableText(500),
  vigencia_inicio: dateOnly.optional(),
  vigencia_fim: dateOnly.nullable().optional(),
  moeda: z.literal('BRL').optional(),
  codigo_tabela_legado: nullableText(64),
}).strict().superRefine((data, ctx) => {
  if (
    data.vigencia_inicio
    && data.vigencia_fim
    && data.vigencia_fim < data.vigencia_inicio
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'vigencia_fim_before_inicio',
      path: ['vigencia_fim'],
    });
  }
});

export const tabelaPrecoItemCreateSchema = z.object({
  produto_id: uuid,
  unidade_medida_id: uuid,
  preco: precoSchema,
}).strict();

export const tabelaPrecoItemUpdateSchema = z.object({
  preco: precoSchema,
}).strict();

export type TabelaPrecoCreate = z.infer<typeof tabelaPrecoCreateSchema>;
export type TabelaPrecoUpdate = z.infer<typeof tabelaPrecoUpdateSchema>;
export type TabelaPrecoItemCreate = z.infer<typeof tabelaPrecoItemCreateSchema>;
export type TabelaPrecoItemUpdate = z.infer<typeof tabelaPrecoItemUpdateSchema>;

export type TabelaPrecoEmpresa = {
  id: string;
  group_id: string;
  tabela_preco_id: string;
  empresa_id: string;
  eh_padrao: boolean;
  ativo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TabelaPrecoItem = {
  id: string;
  group_id: string;
  tabela_preco_id: string;
  produto_id: string;
  unidade_medida_id: string;
  preco: string;
  ativo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TabelaPreco = {
  id: string;
  group_id: string;
  empresa_id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  moeda: 'BRL';
  vigencia_inicio: string;
  vigencia_fim: string | null;
  ativo: boolean;
  codigo_tabela_legado: string | null;
  origem: string;
  legacy_id: string | null;
  legacy_code: string | null;
  source_system: string | null;
  migration_batch: string | null;
  imported_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  empresas: TabelaPrecoEmpresa[];
  itens?: TabelaPrecoItem[];
};

export function isVigenteOn(tabela: Pick<TabelaPreco, 'vigencia_inicio' | 'vigencia_fim'>, businessDate: string): boolean {
  if (businessDate < tabela.vigencia_inicio) return false;
  if (tabela.vigencia_fim && businessDate > tabela.vigencia_fim) return false;
  return true;
}

/** Data civil America/Sao_Paulo (YYYY-MM-DD). */
export function businessDateSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function publicTabelaPreco(tabela: TabelaPreco, options: { empresaId?: string | null } = {}) {
  const empresas = tabela.empresas.filter((row) => (
    row.ativo && (!options.empresaId || row.empresa_id === options.empresaId)
  ));
  return {
    id: tabela.id,
    codigo: tabela.codigo,
    nome: tabela.nome,
    descricao: tabela.descricao,
    moeda: tabela.moeda,
    vigencia_inicio: tabela.vigencia_inicio,
    vigencia_fim: tabela.vigencia_fim,
    ativo: tabela.ativo,
    group_id: tabela.group_id,
    empresa_id: tabela.empresa_id,
    codigo_tabela_legado: tabela.codigo_tabela_legado,
    origem: tabela.origem,
    created_at: tabela.created_at,
    updated_at: tabela.updated_at,
    empresas: empresas.map((row) => ({
      empresa_id: row.empresa_id,
      eh_padrao: row.eh_padrao,
      ativo: row.ativo,
    })),
  };
}

export function publicTabelaPrecoItem(item: TabelaPrecoItem) {
  return {
    id: item.id,
    tabela_preco_id: item.tabela_preco_id,
    produto_id: item.produto_id,
    unidade_medida_id: item.unidade_medida_id,
    preco: item.preco,
    ativo: item.ativo,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export function tabelaPrecoAuditSnapshot(tabela: TabelaPreco) {
  return {
    id: tabela.id,
    group_id: tabela.group_id,
    empresa_id: tabela.empresa_id,
    codigo: tabela.codigo,
    nome: tabela.nome,
    moeda: tabela.moeda,
    vigencia_inicio: tabela.vigencia_inicio,
    vigencia_fim: tabela.vigencia_fim,
    ativo: tabela.ativo,
  };
}

export function tabelaPrecoEmpresaAuditSnapshot(row: Pick<TabelaPrecoEmpresa, 'tabela_preco_id' | 'empresa_id' | 'eh_padrao' | 'ativo'>) {
  return {
    tabela_preco_id: row.tabela_preco_id,
    empresa_id: row.empresa_id,
    eh_padrao: row.eh_padrao,
    ativo: row.ativo,
  };
}

export function tabelaPrecoItemAuditSnapshot(item: TabelaPrecoItem) {
  return {
    id: item.id,
    tabela_preco_id: item.tabela_preco_id,
    produto_id: item.produto_id,
    unidade_medida_id: item.unidade_medida_id,
    preco: item.preco,
    ativo: item.ativo,
  };
}
