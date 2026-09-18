import { z } from 'zod';

export const OBRA_STATUS = ['ATIVA', 'PAUSADA', 'CONCLUIDA', 'CANCELADA'] as const;
export const OBRA_USOS = ['FISICO', 'ENTREGA', 'ADMINISTRATIVO', 'FISCAL', 'OUTRO'] as const;

export const OBRA_RBAC_KEYS = Object.freeze([
  'cadastros.obra.visualizar',
  'cadastros.obra.criar',
  'cadastros.obra.editar',
  'cadastros.obra.inativar',
  'cadastros.obra.restaurar',
  'cadastros.obra.vincular-empresa',
  'cadastros.obra.vincular-local',
  'cadastros.obra.principal',
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

export const obraLocalInputSchema = z.object({
  cliente_local_id: uuid,
  uso_na_obra: z.enum(OBRA_USOS),
  principal: z.boolean().optional().default(false),
}).strict();

export const obraCreateSchema = z.object({
  nome: text(160),
  observacao: nullableText(500),
  confirm_possible_duplicate: z.boolean().optional().default(false),
  locais: z.array(obraLocalInputSchema).min(1).max(20),
  origem: z.string().trim().max(40).optional(),
  legacy_id: nullableText(120),
  legacy_code: nullableText(80),
  source_system: nullableText(80),
  migration_batch: nullableText(80),
  imported_at: z.string().datetime().nullable().optional(),
}).strict().superRefine((data, ctx) => {
  const principals = data.locais.filter((row) => row.principal);
  if (principals.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'exactly one principal local is required',
      path: ['locais'],
    });
  }
  const keys = new Set<string>();
  data.locais.forEach((row, index) => {
    const key = `${row.cliente_local_id}:${row.uso_na_obra}`;
    if (keys.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'duplicate local+uso',
        path: ['locais', index],
      });
    }
    keys.add(key);
  });
});

export const obraUpdateSchema = z.object({
  nome: text(160).optional(),
  status: z.enum(OBRA_STATUS).optional(),
  observacao: nullableText(500),
}).strict();

export type ObraCreate = z.infer<typeof obraCreateSchema>;
export type ObraUpdate = z.infer<typeof obraUpdateSchema>;
export type ObraLocalInput = z.infer<typeof obraLocalInputSchema>;

export type ObraEmpresa = {
  id: string;
  group_id: string;
  obra_id: string;
  empresa_id: string;
  ativo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ObraLocal = {
  id: string;
  group_id: string;
  obra_id: string;
  cliente_local_id: string;
  uso_na_obra: (typeof OBRA_USOS)[number];
  principal: boolean;
  ativo: boolean;
  cidade?: string | null;
  uf?: string | null;
  nome_local?: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Obra = {
  id: string;
  group_id: string;
  cliente_id: string;
  codigo: string;
  nome: string;
  status: (typeof OBRA_STATUS)[number];
  observacao: string | null;
  ativo: boolean;
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
  empresas: ObraEmpresa[];
  locais: ObraLocal[];
};

export function normalizeObraNome(nome: string): string {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function publicObra(obra: Obra) {
  const principal = obra.locais.find((row) => row.principal && row.ativo);
  return {
    id: obra.id,
    codigo: obra.codigo,
    nome: obra.nome,
    status: obra.status,
    observacao: obra.observacao,
    ativo: obra.ativo,
    cliente_id: obra.cliente_id,
    group_id: obra.group_id,
    origem: obra.origem,
    created_at: obra.created_at,
    updated_at: obra.updated_at,
    local_principal: principal
      ? {
        id: principal.cliente_local_id,
        nome: principal.nome_local ?? null,
        cidade: principal.cidade ?? null,
        uf: principal.uf ?? null,
        uso_na_obra: principal.uso_na_obra,
      }
      : null,
    empresas: obra.empresas.filter((row) => row.ativo).map((row) => ({
      empresa_id: row.empresa_id,
      ativo: row.ativo,
    })),
    locais: obra.locais.filter((row) => row.ativo).map((row) => ({
      id: row.id,
      cliente_local_id: row.cliente_local_id,
      uso_na_obra: row.uso_na_obra,
      principal: row.principal,
      nome: row.nome_local ?? null,
      cidade: row.cidade ?? null,
      uf: row.uf ?? null,
    })),
  };
}

export function obraAuditSnapshot(obra: Obra) {
  return {
    id: obra.id,
    group_id: obra.group_id,
    cliente_id: obra.cliente_id,
    codigo: obra.codigo,
    nome: obra.nome,
    status: obra.status,
    ativo: obra.ativo,
    empresas: obra.empresas.map((row) => ({
      empresa_id: row.empresa_id,
      ativo: row.ativo,
    })),
    locais: obra.locais.map((row) => ({
      cliente_local_id: row.cliente_local_id,
      uso_na_obra: row.uso_na_obra,
      principal: row.principal,
      ativo: row.ativo,
    })),
  };
}
