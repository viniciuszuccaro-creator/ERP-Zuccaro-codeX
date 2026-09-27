import { PRODUTO_TIPOS_CANONICOS, normalizeProdutoTipoItem } from '../repositories/produtoTypes.js';
import {
  PEDIDO_TIPOS_COMERCIAIS_ITEM,
  type PedidoTipoComercial,
  type PedidoTipoComercialItem,
} from '../repositories/pedidoTypes.js';

/**
 * Mapeia tipo_item do Produto (PIM) → tipo comercial do item do Pedido.
 * Armado / Corte e Dobra só entram via hint explícito + requer_producao (não inventar no PIM).
 */
export function mapProdutoTipoToComercialItem(produtoTipoItem: string | null | undefined): PedidoTipoComercialItem {
  const normalized = normalizeProdutoTipoItem(produtoTipoItem ?? PRODUTO_TIPOS_CANONICOS.REVENDA);
  switch (normalized) {
    case PRODUTO_TIPOS_CANONICOS.SERVICO:
      return 'SERVICO';
    case PRODUTO_TIPOS_CANONICOS.KIT:
      return 'KIT';
    case PRODUTO_TIPOS_CANONICOS.FABRICADO:
    case PRODUTO_TIPOS_CANONICOS.MATERIA_PRIMA:
    case PRODUTO_TIPOS_CANONICOS.COMPONENTE:
    case PRODUTO_TIPOS_CANONICOS.INTERMEDIARIO:
    case PRODUTO_TIPOS_CANONICOS.RETALHO:
    case PRODUTO_TIPOS_CANONICOS.SUCATA:
    case PRODUTO_TIPOS_CANONICOS.CONSUMO_INTERNO:
      return 'FABRICADO';
    case PRODUTO_TIPOS_CANONICOS.REVENDA:
    default:
      return 'REVENDA';
  }
}

const SPECIAL_PRODUCTION = new Set<PedidoTipoComercialItem>(['ARMADO', 'CORTE_DOBRA']);

export type ResolveItemTipoComercialInput = {
  produtoTipoItem: string | null | undefined;
  requerProducao?: boolean;
  /** Hint do cliente: somente ARMADO/CORTE_DOBRA com requer_producao. */
  hint?: string | null;
};

export type ResolveItemTipoComercialResult =
  | { ok: true; tipo: PedidoTipoComercialItem }
  | { ok: false; reason: 'HINT_NOT_ALLOWED' | 'HINT_INVALID' };

/**
 * Resolve o snapshot do item. Cliente não sobrescreve tipo derivado do Produto,
 * exceto ARMADO/CORTE_DOBRA quando requer_producao=true.
 */
export function resolveItemTipoComercial(input: ResolveItemTipoComercialInput): ResolveItemTipoComercialResult {
  const derived = mapProdutoTipoToComercialItem(input.produtoTipoItem);
  const hintRaw = input.hint?.trim();
  if (!hintRaw) return { ok: true, tipo: derived };

  if (!(PEDIDO_TIPOS_COMERCIAIS_ITEM as readonly string[]).includes(hintRaw)) {
    return { ok: false, reason: 'HINT_INVALID' };
  }
  const hint = hintRaw as PedidoTipoComercialItem;
  if (SPECIAL_PRODUCTION.has(hint)) {
    if (!input.requerProducao) return { ok: false, reason: 'HINT_NOT_ALLOWED' };
    return { ok: true, tipo: hint };
  }
  // Hint igual ao derivado é idempotente; hint divergente de tipo de produto é bloqueado.
  if (hint === derived) return { ok: true, tipo: derived };
  return { ok: false, reason: 'HINT_NOT_ALLOWED' };
}

export function aggregatePedidoTipoComercial(itemTipos: PedidoTipoComercialItem[]): PedidoTipoComercial {
  const unique = [...new Set(itemTipos)];
  if (unique.length === 0) return 'REVENDA';
  if (unique.length === 1) return unique[0]!;
  return 'MISTO';
}
