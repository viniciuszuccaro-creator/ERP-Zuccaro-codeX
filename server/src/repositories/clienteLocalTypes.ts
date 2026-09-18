import { z } from 'zod';
import { CLIENTE_ORIGENS } from './clienteTypes.js';

export const CLIENTE_LOCAL_FINALIDADES = [
  'CADASTRAL',
  'FISCAL',
  'COBRANCA',
  'ENTREGA',
  'CORRESPONDENCIA',
  'OUTRO',
] as const;

export const GEOCODE_STATUS = [
  'NAO_GEOCODIFICADO',
  'PENDENTE',
  'FALHA',
  'GEOCODIFICADO',
] as const;

export const GEOCODE_PRECISOES = ['EXATA', 'APROXIMADA', 'DESCONHECIDA'] as const;
export const COORDINATE_SOURCES = [
  'MANUAL',
  'GPS',
  'IMPORTACAO',
  'GEOCODER',
  'APP_MOTORISTA',
  'API',
] as const;

export const CLIENTE_LOCAL_RBAC_KEYS = Object.freeze([
  'cadastros.local-cliente.visualizar',
  'cadastros.local-cliente.criar',
  'cadastros.local-cliente.editar',
  'cadastros.local-cliente.inativar',
  'cadastros.local-cliente.restaurar',
  'cadastros.local-cliente.principal',
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

export const clienteLocalFinalidadeSchema = z.object({
  finalidade: z.enum(CLIENTE_LOCAL_FINALIDADES),
  principal: z.boolean().optional().default(false),
}).strict();

export const clienteLocalFinalidadesSchema = z.array(clienteLocalFinalidadeSchema)
  .min(1)
  .max(CLIENTE_LOCAL_FINALIDADES.length)
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (seen.has(row.finalidade)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'finalidade duplicada',
          path: [index, 'finalidade'],
        });
      }
      seen.add(row.finalidade);
    });
  });

const localFields = {
  nome: text(160),
  cep: z.string().transform((value) => value.replace(/\D/g, '')).pipe(z.string().length(8)),
  logradouro: text(220),
  numero: text(40),
  complemento: nullableText(160),
  bairro: text(160),
  cidade: text(160),
  uf: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  pais: z.string().trim().min(2).max(80).transform((value) => cleanText(value).toUpperCase()),
  referencia: nullableText(500),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  coordinate_source: z.enum(COORDINATE_SOURCES).nullable().optional(),
  geocode_status: z.enum(GEOCODE_STATUS).optional(),
  geocode_source: nullableText(80),
  geocode_precision: z.enum(GEOCODE_PRECISOES).nullable().optional(),
  geocoded_at: z.string().datetime().nullable().optional(),
  origem: z.enum(CLIENTE_ORIGENS).optional(),
  legacy_id: nullableText(120),
  legacy_code: nullableText(80),
  source_system: nullableText(80),
  migration_batch: nullableText(80),
  imported_at: z.string().datetime().nullable().optional(),
};

function validateGeo(
  data: {
    latitude?: number | null;
    longitude?: number | null;
    coordinate_source?: string | null;
    geocode_status?: string;
    geocode_source?: string | null;
    geocoded_at?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  const hasLatitude = data.latitude != null;
  const hasLongitude = data.longitude != null;
  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'latitude e longitude devem ser informadas juntas',
      path: ['latitude'],
    });
  }
  if (!hasLatitude && !hasLongitude && data.coordinate_source) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'origem da coordenada exige latitude e longitude',
      path: ['coordinate_source'],
    });
  }
  if (data.geocode_status === 'GEOCODIFICADO' && (!hasLatitude || !hasLongitude)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'status geocodificado exige coordenadas',
      path: ['geocode_status'],
    });
  }
  if (
    data.geocode_status === 'GEOCODIFICADO'
    && (!data.geocode_source || !data.geocoded_at)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'geocoding confirmado exige source e timestamp',
      path: ['geocode_source'],
    });
  }
  if (
    data.geocode_status
    && data.geocode_status !== 'GEOCODIFICADO'
    && data.geocoded_at
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'timestamp de geocoding exige status GEOCODIFICADO',
      path: ['geocoded_at'],
    });
  }
}

export const clienteLocalCreateSchema = z.object({
  ...localFields,
  pais: localFields.pais.default('BRASIL'),
  origem: localFields.origem.default('ERP'),
  finalidades: clienteLocalFinalidadesSchema,
}).strict().superRefine(validateGeo);

export const clienteLocalUpdateSchema = z.object({
  nome: localFields.nome.optional(),
  cep: localFields.cep.optional(),
  logradouro: localFields.logradouro.optional(),
  numero: localFields.numero.optional(),
  complemento: localFields.complemento,
  bairro: localFields.bairro.optional(),
  cidade: localFields.cidade.optional(),
  uf: localFields.uf.optional(),
  pais: localFields.pais.optional(),
  referencia: localFields.referencia,
  latitude: localFields.latitude,
  longitude: localFields.longitude,
  coordinate_source: localFields.coordinate_source,
  geocode_status: localFields.geocode_status,
  geocode_source: localFields.geocode_source,
  geocode_precision: localFields.geocode_precision,
  geocoded_at: localFields.geocoded_at,
  origem: localFields.origem,
  legacy_id: localFields.legacy_id,
  legacy_code: localFields.legacy_code,
  source_system: localFields.source_system,
  migration_batch: localFields.migration_batch,
  imported_at: localFields.imported_at,
}).strict().superRefine(validateGeo);

export type ClienteLocalCreate = z.infer<typeof clienteLocalCreateSchema>;
export type ClienteLocalUpdate = z.infer<typeof clienteLocalUpdateSchema>;
export type ClienteLocalFinalidadeInput = z.infer<typeof clienteLocalFinalidadeSchema>;

export type ClienteLocalFinalidade = {
  id: string;
  group_id: string;
  cliente_id: string;
  cliente_local_id: string;
  finalidade: typeof CLIENTE_LOCAL_FINALIDADES[number];
  principal: boolean;
  ativo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ClienteLocal = {
  id: string;
  group_id: string;
  cliente_id: string;
  nome: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
  referencia: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinate_source: typeof COORDINATE_SOURCES[number] | null;
  geocode_status: typeof GEOCODE_STATUS[number];
  geocode_source: string | null;
  geocode_precision: typeof GEOCODE_PRECISOES[number] | null;
  geocoded_at: string | null;
  endereco_incompleto: boolean;
  endereco_fingerprint: string;
  ativo: boolean;
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
  finalidades: ClienteLocalFinalidade[];
};

const fingerprintPart = (value: unknown) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export function buildClienteLocalFingerprint(
  groupId: string,
  clienteId: string,
  data: Pick<
    ClienteLocalCreate,
    'cep' | 'logradouro' | 'numero' | 'complemento' | 'cidade' | 'uf'
  >,
) {
  return [
    groupId.toLowerCase(),
    clienteId.toLowerCase(),
    ...[
    data.cep,
    data.logradouro,
    data.numero,
    data.complemento,
    data.cidade,
    data.uf,
    ].map(fingerprintPart),
  ].join('|');
}
