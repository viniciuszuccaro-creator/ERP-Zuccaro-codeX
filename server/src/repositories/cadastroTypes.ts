import { z } from 'zod';

const baseCreate = {
  empresa_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().optional().default(true),
};

export const unidadeCreateSchema = z.object({
  ...baseCreate,
  sigla: z.string().trim().min(1).max(20),
  nome_completo: z.string().trim().min(1).max(120),
  tipo_grandeza: z.string().trim().max(60).optional().default('Unidade'),
  unidade_base_conversao: z.string().trim().max(20).optional().nullable(),
  fator_conversao_para_base: z.number().finite().optional().default(1),
  permite_conversao: z.boolean().optional().default(true),
  usa_em_estoque: z.boolean().optional().default(true),
  usa_em_compras: z.boolean().optional().default(true),
  usa_em_vendas: z.boolean().optional().default(true),
});
export const unidadeUpdateSchema = unidadeCreateSchema.partial();
export type UnidadeCreate = z.infer<typeof unidadeCreateSchema>;
export type UnidadeUpdate = z.infer<typeof unidadeUpdateSchema>;
export type UnidadeMedida = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  sigla: string;
  nome_completo: string;
  tipo_grandeza: string;
  unidade_base_conversao: string | null;
  fator_conversao_para_base: number;
  permite_conversao: boolean;
  usa_em_estoque: boolean;
  usa_em_compras: boolean;
  usa_em_vendas: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const grupoProdutoCreateSchema = z.object({
  ...baseCreate,
  nome_grupo: z.string().trim().min(1).max(200),
  codigo: z.string().trim().max(64).optional().nullable(),
  natureza: z.string().trim().max(60).optional().default('Revenda'),
  ncm_padrao: z.string().trim().max(20).optional().nullable(),
  margem_sugerida: z.number().finite().optional().default(0),
  icone: z.string().trim().max(80).optional().nullable(),
  cor: z.string().trim().max(32).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});
export const grupoProdutoUpdateSchema = grupoProdutoCreateSchema.partial();
export type GrupoProdutoCreate = z.infer<typeof grupoProdutoCreateSchema>;
export type GrupoProdutoUpdate = z.infer<typeof grupoProdutoUpdateSchema>;
export type GrupoProduto = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  nome_grupo: string;
  codigo: string | null;
  natureza: string;
  ncm_padrao: string | null;
  margem_sugerida: number;
  icone: string | null;
  cor: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const setorCreateSchema = z.object({
  ...baseCreate,
  nome: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(2000).optional().nullable(),
  tipo_operacao: z.string().trim().max(60).optional().default('Revenda'),
  icone: z.string().trim().max(80).optional().nullable(),
  cor: z.string().trim().max(32).optional().nullable(),
});
export const setorUpdateSchema = setorCreateSchema.partial();
export type SetorCreate = z.infer<typeof setorCreateSchema>;
export type SetorUpdate = z.infer<typeof setorUpdateSchema>;
export type SetorAtividade = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  nome: string;
  descricao: string | null;
  tipo_operacao: string;
  icone: string | null;
  cor: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

// Produto types moved to produtoTypes.ts (ERP-RUNTIME-03)
export {
  produtoCreateSchema,
  produtoUpdateSchema,
  PRODUTO_FORBIDDEN_OPERATIONAL_FIELDS,
  type Produto,
  type ProdutoCreate,
  type ProdutoUpdate,
} from './produtoTypes.js';
