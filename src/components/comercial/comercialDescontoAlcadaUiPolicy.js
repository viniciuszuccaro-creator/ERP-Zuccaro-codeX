/**
 * Alçada de desconto — espelho UI fail-closed do backend (#46).
 * Painéis Orçamento/Pedido: exibir bloqueio e desabilitar Salvar antes do HTTP.
 * Sem migration; sem módulo paralelo.
 */

const MICROS = 1_000_000n;

/** Alçada livre em basis points do subtotal (0 = qualquer desconto exige aprovar). */
export const DESCONTO_ALCADA_LIVRE_BPS_DEFAULT = 0;

function toMicros(value) {
  const raw = String(value ?? '0').trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error('Valor monetário inválido para alçada de desconto.');
  }
  const neg = raw.startsWith('-');
  const [intPart, fracPart = ''] = (neg ? raw.slice(1) : raw).split('.');
  const frac = `${fracPart}000000`.slice(0, 6);
  const micros = BigInt(intPart || '0') * MICROS + BigInt(frac || '0');
  return neg ? -micros : micros;
}

/**
 * @param {Array<{ quantidade?: unknown, preco_unitario?: unknown, desconto?: unknown }>} items
 */
export function computeDescontoBpsFromItems(items) {
  let subtotal = 0n;
  let desconto = 0n;
  for (const item of items || []) {
    const line = (toMicros(item.quantidade) * toMicros(item.preco_unitario)) / MICROS;
    const d = toMicros(item.desconto ?? '0');
    if (d < 0n || d > line) {
      throw new Error('Desconto do item supera o subtotal da linha.');
    }
    subtotal += line;
    desconto += d;
  }
  if (subtotal <= 0n) {
    return { subtotalMicros: subtotal, descontoMicros: desconto, descontoBps: 0 };
  }
  return {
    subtotalMicros: subtotal,
    descontoMicros: desconto,
    descontoBps: Number((desconto * 10000n) / subtotal),
  };
}

/**
 * Comparação inteira: evita truncar bps < 1 (paridade com backend).
 */
export function descontoExcedeAlcadaLivreUi(items, livreBps = DESCONTO_ALCADA_LIVRE_BPS_DEFAULT) {
  const { subtotalMicros, descontoMicros } = computeDescontoBpsFromItems(items);
  if (descontoMicros <= 0n) return false;
  if (subtotalMicros <= 0n) return true;
  const lim = Number.isFinite(livreBps) ? Math.max(0, Math.trunc(livreBps)) : 0;
  return descontoMicros * 10000n > subtotalMicros * BigInt(lim);
}

/**
 * RBAC fail-closed: só `aprovar` explícito na seção (orcamento|pedido).
 */
export function canAprovarDescontoAlcada(hasPermission, entity) {
  if (typeof hasPermission !== 'function') return false;
  const section = entity === 'pedido' ? 'pedido' : 'orcamento';
  return hasPermission('Comercial', section, 'aprovar') === true;
}

/**
 * Avalia se o formulário pode salvar com o desconto atual (fail-closed na UI).
 * Create: criador = actor → nunca autoaprova.
 * Update: sem criador conhecido + com aprovar → permite tentativa (backend segrega);
 *         com criador === actor → bloqueia.
 *
 * @param {{
 *   items?: Array<object>,
 *   hasPermission?: Function,
 *   entity?: 'orcamento'|'pedido',
 *   mode?: 'create'|'update',
 *   actorId?: string|null,
 *   criadorActorId?: string|null,
 *   livreBps?: number,
 *   liberadoPorAvista?: boolean,
 * }} options
 */
export function evaluateDescontoAlcadaUi(options = {}) {
  const entity = options.entity === 'pedido' ? 'pedido' : 'orcamento';
  const mode = options.mode === 'update' ? 'update' : 'create';
  const label = entity === 'pedido' ? 'Pedido' : 'Orçamento';
  const actor = String(options.actorId ?? '').trim();
  const criadorRaw = options.criadorActorId == null ? null : String(options.criadorActorId).trim();
  const criador = criadorRaw || (mode === 'create' ? actor : '');
  const canAprovar = canAprovarDescontoAlcada(options.hasPermission, entity);

  let descontoBps = 0;
  let excedeu = false;
  try {
    const computed = computeDescontoBpsFromItems(options.items || []);
    descontoBps = computed.descontoBps;
    if (options.liberadoPorAvista === true) {
      return {
        excedeu: false,
        aprovacaoExigida: false,
        canSave: true,
        blockCode: null,
        descontoBps,
        hint: null,
        canAprovar,
      };
    }
    excedeu = descontoExcedeAlcadaLivreUi(options.items || [], options.livreBps);
  } catch (error) {
    return {
      excedeu: true,
      aprovacaoExigida: true,
      canSave: false,
      blockCode: 'ORCAMENTO_DESCONTO_INVALIDO',
      descontoBps: 0,
      hint: error?.message || 'Desconto inválido — revise os itens antes de salvar.',
      canAprovar,
    };
  }

  if (!excedeu) {
    return {
      excedeu: false,
      aprovacaoExigida: false,
      canSave: true,
      blockCode: null,
      descontoBps,
      hint: null,
      canAprovar,
    };
  }

  if (!canAprovar) {
    return {
      excedeu: true,
      aprovacaoExigida: true,
      canSave: false,
      blockCode: 'DESCONTO_ALCADA_DENIED',
      descontoBps,
      hint: `${label}: desconto acima da alçada livre exige permissão Comercial.${entity}.aprovar. Reduza o desconto ou solicite aprovação.`,
      canAprovar,
    };
  }

  // Create: criador = actor → nunca autoaprova.
  if (mode === 'create') {
    return {
      excedeu: true,
      aprovacaoExigida: true,
      canSave: false,
      blockCode: 'DESCONTO_ALCADA_DENIED',
      descontoBps,
      hint: `${label}: desconto acima da alçada livre exige outro aprovador (sem autoaprovação). Peça a um colega com aprovar ou reduza o desconto.`,
      canAprovar,
    };
  }

  // Update com criador conhecido e igual ao ator → bloqueia (segregação).
  if (criador && actor && criador === actor) {
    return {
      excedeu: true,
      aprovacaoExigida: true,
      canSave: false,
      blockCode: 'DESCONTO_ALCADA_DENIED',
      descontoBps,
      hint: `${label}: desconto acima da alçada livre exige outro aprovador (sem autoaprovação). Peça a um colega com aprovar ou reduza o desconto.`,
      canAprovar,
    };
  }

  // Update: com aprovar e criador desconhecido/outro — UI permite; backend é a fonte da segregação.
  return {
    excedeu: true,
    aprovacaoExigida: true,
    canSave: true,
    blockCode: null,
    descontoBps,
    hint: `${label}: desconto exige aprovação de outro ator — o servidor valida a segregação ao salvar.`,
    canAprovar,
  };
}

/**
 * Mensagem HTTP específica para DESCONTO_ALCADA_DENIED (não genérico 403).
 */
export function formatDescontoAlcadaHttpError(error, entityLabel = 'Documento') {
  const code = error?.body?.error?.code || error?.code;
  if (code !== 'DESCONTO_ALCADA_DENIED' && Number(error?.status) !== 403) return null;
  if (code === 'DESCONTO_ALCADA_DENIED') {
    const serverMsg = String(error?.body?.error?.message || '').trim();
    if (/outro aprovador/i.test(serverMsg)) {
      return `${entityLabel}: desconto acima da alçada exige outro aprovador.`;
    }
    return `${entityLabel}: desconto acima da alçada livre exige permissão de aprovar.`;
  }
  return null;
}

/**
 * Trava síncrona anti duplo-clique no save (ref.current).
 * @param {{ current: boolean }} inFlightRef
 * @returns {boolean} true se adquiriu o lock
 */
export function beginSaveOnce(inFlightRef) {
  if (!inFlightRef || inFlightRef.current) return false;
  inFlightRef.current = true;
  return true;
}

/** @param {{ current: boolean }} inFlightRef */
export function endSaveOnce(inFlightRef) {
  if (inFlightRef) inFlightRef.current = false;
}
