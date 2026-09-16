import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export type Marca = {
  id: string;
  group_id: string;
  empresa_id: string | null;
  nome_marca: string;
  descricao: string | null;
  cnpj: string | null;
  pais_origem: string | null;
  site: string | null;
  logo_url: string | null;
  categoria: string | null;
  fornecedor_id: string | null;
  certificacoes: unknown[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export const marcaCreateSchema = z.object({
  nome_marca: z.string().trim().min(1).max(200),
  descricao: z.string().trim().max(2000).optional().nullable(),
  cnpj: z.string().trim().max(18).optional().nullable(),
  pais_origem: z.string().trim().max(120).optional().nullable(),
  site: z.string().trim().max(500).optional().nullable(),
  logo_url: z.string().trim().max(1000).optional().nullable(),
  categoria: z.string().trim().max(120).optional().nullable(),
  fornecedor_id: z.string().uuid().optional().nullable(),
  certificacoes: z.array(z.unknown()).optional().default([]),
  ativo: z.boolean().optional().default(true),
  empresa_id: z.string().uuid().optional().nullable(),
});

export const marcaUpdateSchema = marcaCreateSchema.partial();

export type MarcaCreateInput = z.infer<typeof marcaCreateSchema>;
export type MarcaUpdateInput = z.infer<typeof marcaUpdateSchema>;

export type MarcaListFilter = {
  groupId: string;
  empresaId?: string | null;
  ativo?: boolean;
  search?: string;
  limit?: number;
};

export interface MarcaRepository {
  list(filter: MarcaListFilter): Promise<Marca[]>;
  getById(scope: { groupId: string; empresaId?: string | null }, id: string): Promise<Marca | null>;
  create(scope: { groupId: string; empresaId?: string | null }, data: MarcaCreateInput): Promise<Marca>;
  update(scope: { groupId: string; empresaId?: string | null }, id: string, data: MarcaUpdateInput): Promise<Marca | null>;
  softDelete(scope: { groupId: string; empresaId?: string | null }, id: string): Promise<Marca | null>;
}
