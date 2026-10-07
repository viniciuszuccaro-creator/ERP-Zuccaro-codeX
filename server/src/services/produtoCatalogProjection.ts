/**
 * Projeção allowlisted de catálogo (Onda 15) — reconstruível a partir do Produto.
 * Sem custo/margem/fiscal operacional, sem URL assinada, sem PII/tenant/ator.
 */
import type { Produto } from '../repositories/produtoTypes.js';

export const CATALOG_PROJECTION_SCHEMA_VERSION = 1 as const;

/** Chaves permitidas no payload publicado ao canal (snake→camel estável). */
export const CATALOG_PROJECTION_ALLOWLIST = [
  'produtoId',
  'codigo',
  'codigoBarras',
  'descricao',
  'nome',
  'descricaoComercial',
  'tituloSeo',
  'descricaoSeo',
  'material',
  'liga',
  'normaTecnica',
  'embalagemTipo',
  'multiploVenda',
  'quantidadeMinimaVenda',
  'permiteFracionamento',
  'unidadeMedidaId',
  'unidadeMedida',
  'unidadePrincipal',
  'workflowStatus',
  'schemaVersion',
] as const;

export type CatalogProjectionKey = (typeof CATALOG_PROJECTION_ALLOWLIST)[number];

export type ProdutoCatalogProjection = {
  produtoId: string;
  codigo: string | null;
  codigoBarras: string | null;
  descricao: string;
  nome: string | null;
  descricaoComercial: string | null;
  tituloSeo: string | null;
  descricaoSeo: string | null;
  material: string | null;
  liga: string | null;
  normaTecnica: string | null;
  embalagemTipo: string | null;
  multiploVenda: number;
  quantidadeMinimaVenda: number;
  permiteFracionamento: boolean;
  unidadeMedidaId: string | null;
  unidadeMedida: string | null;
  unidadePrincipal: string | null;
  workflowStatus: Produto['workflow_status'];
  schemaVersion: typeof CATALOG_PROJECTION_SCHEMA_VERSION;
};

/** Campos que nunca podem ir ao canal — fail-closed se presentes. */
export const CATALOG_PROJECTION_FORBIDDEN = [
  'custo', 'custo_medio', 'custoMedio', 'custo_aquisicao', 'ultimo_custo',
  'margem', 'margem_minima', 'margemMinima', 'margem_minima_percentual',
  'preco', 'preco_venda', 'estoque', 'saldo',
  'groupId', 'group_id', 'empresaId', 'empresa_id',
  'actorId', 'actor_id', 'requestId', 'signedUrl', 'signed_url',
  'foto_produto_url', 'fotoProdutoUrl', 'storage_key', 'storageKey',
  'ncm', 'cest', 'origem_mercadoria', 'origemMercadoria',
  'token', 'password', 'secret', 'apiKey', 'api_key',
] as const;

const ALLOWLIST_SET = new Set<string>(CATALOG_PROJECTION_ALLOWLIST);
const FORBIDDEN_SET = new Set<string>(CATALOG_PROJECTION_FORBIDDEN.map((k) => k.toLowerCase()));

export function buildProdutoCatalogProjection(produto: Produto): ProdutoCatalogProjection {
  return {
    produtoId: produto.id,
    codigo: produto.codigo,
    codigoBarras: produto.codigo_barras,
    descricao: produto.descricao,
    nome: produto.nome,
    descricaoComercial: produto.descricao_comercial,
    tituloSeo: produto.titulo_seo,
    descricaoSeo: produto.descricao_seo,
    material: produto.material,
    liga: produto.liga,
    normaTecnica: produto.norma_tecnica,
    embalagemTipo: produto.embalagem_tipo,
    multiploVenda: produto.multiplo_venda,
    quantidadeMinimaVenda: produto.quantidade_minima_venda,
    permiteFracionamento: produto.permite_fracionamento,
    unidadeMedidaId: produto.unidade_medida_id,
    unidadeMedida: produto.unidade_medida,
    unidadePrincipal: produto.unidade_principal,
    workflowStatus: produto.workflow_status,
    schemaVersion: CATALOG_PROJECTION_SCHEMA_VERSION,
  };
}

/**
 * Valida payload de outbox antes da entrega fake/real.
 * Remove chaves fora da allowlist; rejeita se houver chave proibida.
 */
export function assertSafeCatalogProjection(
  payload: Record<string, unknown>,
): ProdutoCatalogProjection {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_SET.has(key.toLowerCase()) || /^(custo|margem|preco|estoque|saldo)/i.test(key)) {
      throw new Error(`CATALOG_PROJECTION_FORBIDDEN_FIELD:${key}`);
    }
  }
  const safe: Record<string, unknown> = {};
  for (const key of CATALOG_PROJECTION_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      safe[key] = payload[key];
    }
  }
  for (const key of Object.keys(payload)) {
    if (!ALLOWLIST_SET.has(key) && !FORBIDDEN_SET.has(key.toLowerCase())) {
      // Chaves desconhecidas nao entram; nao falham (forward-compat do emissor antigo).
      continue;
    }
  }
  if (typeof safe.produtoId !== 'string' || !safe.produtoId) {
    throw new Error('CATALOG_PROJECTION_MISSING_PRODUTO_ID');
  }
  if (safe.schemaVersion !== CATALOG_PROJECTION_SCHEMA_VERSION && safe.schemaVersion !== 1) {
    // Aceita apenas schemaVersion 1 neste checkpoint.
    if (safe.schemaVersion != null && Number(safe.schemaVersion) !== 1) {
      throw new Error('CATALOG_PROJECTION_UNSUPPORTED_SCHEMA');
    }
  }
  return {
    produtoId: String(safe.produtoId),
    codigo: (safe.codigo as string | null | undefined) ?? null,
    codigoBarras: (safe.codigoBarras as string | null | undefined) ?? null,
    descricao: String(safe.descricao ?? ''),
    nome: (safe.nome as string | null | undefined) ?? null,
    descricaoComercial: (safe.descricaoComercial as string | null | undefined) ?? null,
    tituloSeo: (safe.tituloSeo as string | null | undefined) ?? null,
    descricaoSeo: (safe.descricaoSeo as string | null | undefined) ?? null,
    material: (safe.material as string | null | undefined) ?? null,
    liga: (safe.liga as string | null | undefined) ?? null,
    normaTecnica: (safe.normaTecnica as string | null | undefined) ?? null,
    embalagemTipo: (safe.embalagemTipo as string | null | undefined) ?? null,
    multiploVenda: Number(safe.multiploVenda ?? 1),
    quantidadeMinimaVenda: Number(safe.quantidadeMinimaVenda ?? 0),
    permiteFracionamento: Boolean(safe.permiteFracionamento ?? false),
    unidadeMedidaId: (safe.unidadeMedidaId as string | null | undefined) ?? null,
    unidadeMedida: (safe.unidadeMedida as string | null | undefined) ?? null,
    unidadePrincipal: (safe.unidadePrincipal as string | null | undefined) ?? null,
    workflowStatus: (safe.workflowStatus as Produto['workflow_status']) ?? 'RASCUNHO',
    schemaVersion: CATALOG_PROJECTION_SCHEMA_VERSION,
  };
}
