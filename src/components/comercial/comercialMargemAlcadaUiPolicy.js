/**
 * Alçada de margem mínima — espelho UI fail-closed do backend (#47 CostPort).
 * Painéis Orçamento/Pedido: exibir bloqueio e desabilitar Salvar quando há
 * snapshot de custo explícito abaixo da mínima e o ator não tem `aprovar`.
 * Sem CostPort/snapshot → não inventa custo (skip, igual ao backend).
 * Sem migration; sem módulo paralelo.
 */

const MICROS = 1_000_000n;

/** Margem mínima padrão em bps sobre o líquido (0 = não vender abaixo do custo). */
export const MARGEM_MINIMA_BPS_DEFAULT = 0;

function toMicros(value) {
  const raw = String(value ?? '0').trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error('Valor monetário inválido para alçada de margem.');
  }
  const neg = raw.startsWith('-');
  const [intPart, fracPart = ''] = (neg ? raw.slice(1) : raw).split('.');
  const frac = `${fracPart}000000`.slice(0, 6);
  const micros = BigInt(intPart || '0') * MICROS + BigInt(frac || '0');
  return neg ? -micros : micros;
}

function costKey(produtoId, unidadeId) {
  return `${String(produtoId || '').trim()}|${String(unidadeId || '').trim()}`;
}

/**
 * Comparação inteira: (net - cost) * 10000 < net * minimaBps
 * (paridade com backend — evita truncar fração de bp).
 */
export function lineAbaixoDaMargemMinimaUi(netMicros, costMicros, minimaBps) {
  if (costMicros < 0n) {
    throw new Error('Custo unitário inválido para alçada de margem.');
  }
  const lim = Number.isFinite(minimaBps) ? Math.max(0, Math.trunc(minimaBps)) : 0;
  if (netMicros <= 0n) {
    return costMicros > 0n || lim > 0;
  }
  return (netMicros - costMicros) * 10000n < netMicros * BigInt(lim);
}

export function computeMargemBpsUi(netMicros, costMicros) {
  if (netMicros <= 0n) return null;
  return Number(((netMicros - costMicros) * 10000n) / netMicros);
}

/**
 * Snapshot de custo só quando explícito (item.custo_unitario ou lookup).
 * Nunca inventa a partir de preço, custo_medio de produto MASTER DATA, etc.
 *
 * @param {Array<{ produto_id?: unknown, unidade_id?: unknown, custo_unitario?: unknown, margem_minima_bps?: unknown }>} items
 * @param {Record<string, { custo_unitario?: unknown, margem_minima_bps?: unknown }>|Map|null|undefined} [costLookup]
 * @returns {Map<string, { custo_unitario: string, margem_minima_bps?: number }>}
 */
export function resolveMargemCostLookupFromItems(items, costLookup) {
  const out = new Map();
  const lookup = costLookup instanceof Map
    ? costLookup
    : (costLookup && typeof costLookup === 'object' ? new Map(Object.entries(costLookup)) : null);

  for (const item of items || []) {
    const produtoId = String(item?.produto_id ?? '').trim();
    const unidadeId = String(item?.unidade_id ?? '').trim();
    if (!produtoId || !unidadeId) continue;
    const key = costKey(produtoId, unidadeId);

    let row = null;
    if (lookup?.has(key)) {
      const fromLookup = lookup.get(key);
      // Lookup explícito null → skip (porta devolveu ausência; não inventa).
      if (fromLookup == null) continue;
      const custo = String(fromLookup?.custo_unitario ?? '').trim();
      if (!custo || !/^-?\d+(\.\d+)?$/.test(custo)) continue;
      row = {
        custo_unitario: custo,
        margem_minima_bps: fromLookup?.margem_minima_bps,
      };
    } else {
      const custo = String(item?.custo_unitario ?? '').trim();
      if (!custo || !/^-?\d+(\.\d+)?$/.test(custo)) continue;
      row = {
        custo_unitario: custo,
        margem_minima_bps: item?.margem_minima_bps,
      };
    }
    if (row) out.set(key, row);
  }
  return out;
}

/**
 * RBAC fail-closed: só `aprovar` explícito na seção (orcamento|pedido).
 * Paridade com backend CostPort (#47) — mesma chave do desconto.
 */
export function canAprovarMargemAlcada(hasPermission, entity) {
  if (typeof hasPermission !== 'function') return false;
  const section = entity === 'pedido' ? 'pedido' : 'orcamento';
  return hasPermission('Comercial', section, 'aprovar') === true;
}

/**
 * Avalia margem mínima na UI quando há snapshot de custo explícito.
 * Sem snapshot/porta → skip (não inventa, não bloqueia).
 * Abaixo da mínima sem `aprovar` → bloqueia Salvar (MARGEM_ALCADA_DENIED).
 * Com `aprovar` → permite tentativa (backend audita override).
 *
 * @param {{
 *   items?: Array<object>,
 *   costLookup?: Record<string, object>|Map|null,
 *   hasPermission?: Function,
 *   entity?: 'orcamento'|'pedido',
 *   defaultMinimaBps?: number,
 * }} options
 */
export function evaluateMargemAlcadaUi(options = {}) {
  const entity = options.entity === 'pedido' ? 'pedido' : 'orcamento';
  const label = entity === 'pedido' ? 'Pedido' : 'Orçamento';
  const canAprovar = canAprovarMargemAlcada(options.hasPermission, entity);
  const defaultMin = Number.isFinite(options.defaultMinimaBps)
    ? Math.max(0, Math.trunc(options.defaultMinimaBps))
    : MARGEM_MINIMA_BPS_DEFAULT;

  const lookup = resolveMargemCostLookupFromItems(options.items || [], options.costLookup);
  if (lookup.size === 0) {
    return {
      anyAbaixo: false,
      aprovacaoExigida: false,
      canSave: true,
      blockCode: null,
      evaluated: [],
      linesAbaixo: 0,
      hint: null,
      canAprovar,
      costSnapshotPresent: false,
    };
  }

  const evaluated = [];
  let anyAbaixo = false;

  try {
    for (const item of options.items || []) {
      const produtoId = String(item?.produto_id ?? '').trim();
      const unidadeId = String(item?.unidade_id ?? '').trim();
      if (!produtoId || !unidadeId) continue;
      const costRow = lookup.get(costKey(produtoId, unidadeId));
      if (!costRow) continue;

      const qty = toMicros(item.quantidade);
      const price = toMicros(item.preco_unitario);
      const discount = toMicros(item.desconto ?? '0');
      const line = (qty * price) / MICROS;
      if (discount < 0n || discount > line) {
        return {
          anyAbaixo: true,
          aprovacaoExigida: true,
          canSave: false,
          blockCode: 'ORCAMENTO_DESCONTO_INVALIDO',
          evaluated,
          linesAbaixo: 0,
          hint: 'Desconto do item supera o subtotal da linha — revise antes de salvar.',
          canAprovar,
          costSnapshotPresent: true,
        };
      }
      const net = line - discount;
      const unitCost = toMicros(costRow.custo_unitario);
      if (unitCost < 0n) {
        return {
          anyAbaixo: true,
          aprovacaoExigida: true,
          canSave: false,
          blockCode: 'VALIDATION_ERROR',
          evaluated,
          linesAbaixo: 0,
          hint: 'Custo unitário inválido no snapshot de margem — não inventar; corrija a origem do custo.',
          canAprovar,
          costSnapshotPresent: true,
        };
      }
      const costMicros = (qty * unitCost) / MICROS;
      const minimaBps = Number.isFinite(costRow.margem_minima_bps)
        ? Math.max(0, Math.trunc(costRow.margem_minima_bps))
        : defaultMin;
      const abaixo = lineAbaixoDaMargemMinimaUi(net, costMicros, minimaBps);
      if (abaixo) anyAbaixo = true;
      evaluated.push({
        produto_id: produtoId,
        margem_bps: computeMargemBpsUi(net, costMicros),
        minima_bps: minimaBps,
        abaixo_da_minima: abaixo,
      });
    }
  } catch (error) {
    return {
      anyAbaixo: true,
      aprovacaoExigida: true,
      canSave: false,
      blockCode: 'VALIDATION_ERROR',
      evaluated,
      linesAbaixo: 0,
      hint: error?.message || 'Margem inválida — revise os itens antes de salvar.',
      canAprovar,
      costSnapshotPresent: true,
    };
  }

  const linesAbaixo = evaluated.filter((row) => row.abaixo_da_minima).length;

  if (!anyAbaixo) {
    return {
      anyAbaixo: false,
      aprovacaoExigida: false,
      canSave: true,
      blockCode: null,
      evaluated,
      linesAbaixo: 0,
      hint: null,
      canAprovar,
      costSnapshotPresent: true,
    };
  }

  if (!canAprovar) {
    return {
      anyAbaixo: true,
      aprovacaoExigida: true,
      canSave: false,
      blockCode: 'MARGEM_ALCADA_DENIED',
      evaluated,
      linesAbaixo,
      hint: `${label}: margem abaixo da mínima exige permissão Comercial.${entity}.aprovar. Ajuste preço/desconto ou solicite aprovação.`,
      canAprovar,
      costSnapshotPresent: true,
    };
  }

  // Com aprovar: UI permite; backend CostPort valida e audita override.
  return {
    anyAbaixo: true,
    aprovacaoExigida: true,
    canSave: true,
    blockCode: null,
    evaluated,
    linesAbaixo,
    hint: `${label}: margem abaixo da mínima — o servidor valida o CostPort e audita a aprovação ao salvar.`,
    canAprovar,
    costSnapshotPresent: true,
  };
}

/**
 * Mensagem HTTP específica para MARGEM_ALCADA_DENIED (não genérico 403).
 */
export function formatMargemAlcadaHttpError(error, entityLabel = 'Documento') {
  const code = error?.body?.error?.code || error?.code;
  if (code === 'MARGEM_ALCADA_DENIED') {
    return `${entityLabel}: margem abaixo da mínima exige permissão de aprovar.`;
  }
  if (Number(error?.status) === 403 && /margem.*m[ií]nima/i.test(String(error?.body?.error?.message || ''))) {
    return `${entityLabel}: margem abaixo da mínima exige permissão de aprovar.`;
  }
  return null;
}
