import { z } from 'zod';

const jsonObject = z.record(z.unknown()).optional().default({});
const stringArray = z.array(z.string().trim().max(40)).optional().default([]);

const baseCreate = {
  empresa_id: z.string().uuid().optional().nullable(),
  ativo: z.boolean().optional().default(true),
};

/** Campos MASTER DATA do Produto (RUNTIME-03). Sem estoque/custo/preço/fiscal operacional. */
export const produtoCreateSchema = z.object({
  ...baseCreate,
  codigo: z.string().trim().max(80).optional().nullable(),
  codigo_barras: z.string().trim().max(64).optional().nullable(),
  descricao: z.string().trim().min(1).max(500),
  nome: z.string().trim().max(500).optional().nullable(),
  tipo_item: z.string().trim().max(80).optional().default('Revenda'),
  tipo_aco: z.string().trim().max(40).optional().nullable(),
  eh_bitola: z.boolean().optional().default(false),
  peso_teorico_kg_m: z.number().finite().optional().default(0),
  bitola_diametro_mm: z.number().finite().optional().default(0),
  comprimento_barra_padrao_m: z.number().finite().optional().default(12),
  unidade_medida_id: z.string().uuid().optional().nullable(),
  unidade_medida: z.string().trim().max(20).optional().nullable(),
  unidade_principal: z.string().trim().max(20).optional().nullable(),
  unidades_secundarias: stringArray,
  fatores_conversao: jsonObject,
  grupo_produto_id: z.string().uuid().optional().nullable(),
  grupo_legado: z.string().trim().max(120).optional().nullable(),
  marca_id: z.string().uuid().optional().nullable(),
  setor_atividade_id: z.string().uuid().optional().nullable(),
  peso_liquido_kg: z.number().finite().optional().default(0),
  peso_bruto_kg: z.number().finite().optional().default(0),
  altura_cm: z.number().finite().optional().default(0),
  largura_cm: z.number().finite().optional().default(0),
  comprimento_cm: z.number().finite().optional().default(0),
  volume_m3: z.number().finite().optional().default(0),
  ncm: z.string().trim().max(20).optional().nullable(),
  cest: z.string().trim().max(20).optional().nullable(),
  origem_mercadoria: z.string().trim().max(80).optional().nullable(),
  status: z.string().trim().max(40).optional().default('Ativo'),
  foto_produto_url: z.string().trim().max(1000).optional().nullable(),
}).strict();

export const produtoUpdateSchema = produtoCreateSchema.partial().strict();

export type ProdutoCreate = z.infer<typeof produtoCreateSchema>;
export type ProdutoUpdate = z.infer<typeof produtoUpdateSchema>;

export type Produto = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  codigo: string | null;
  codigo_barras: string | null;
  descricao: string;
  nome: string | null;
  tipo_item: string;
  tipo_aco: string | null;
  eh_bitola: boolean;
  peso_teorico_kg_m: number;
  bitola_diametro_mm: number;
  comprimento_barra_padrao_m: number;
  unidade_medida_id: string | null;
  unidade_medida: string | null;
  unidade_principal: string | null;
  unidades_secundarias: string[];
  fatores_conversao: Record<string, unknown>;
  grupo_produto_id: string | null;
  grupo_legado: string | null;
  marca_id: string | null;
  setor_atividade_id: string | null;
  peso_liquido_kg: number;
  peso_bruto_kg: number;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
  volume_m3: number;
  ncm: string | null;
  cest: string | null;
  origem_mercadoria: string | null;
  status: string;
  foto_produto_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

/** Campos proibidos no payload Produto (transactional / operacional). */
export const PRODUTO_FORBIDDEN_OPERATIONAL_FIELDS = Object.freeze([
  'estoque_atual',
  'estoque_minimo',
  'estoque_maximo',
  'estoque_reservado',
  'saldo',
  'saldo_disponivel',
  'custo_aquisicao',
  'custo_medio',
  'ultimo_custo',
  'preco_venda',
  'preco',
  'margem_minima_percentual',
  'tributacao',
  'icms_cst',
  'pis_cst',
  'cofins_cst',
  'ipi_cst',
  'cfop_padrao_compra',
  'cfop_padrao_venda',
  'movimentacao',
  'reserva',
  'inventario',
]);
