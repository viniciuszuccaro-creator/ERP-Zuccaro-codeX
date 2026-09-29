/**
 * Política UI ClienteLocal + Obra HTTP (Onda 3) — endereço/obra no Pedido.
 * Reutiliza rotas nested R06A/R06B sob `/api/v1/clientes/:id/locais|obras`.
 * Sem migration; sem list-for-scope flat (seleção exige cliente_id do vínculo).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail-closed: listagem HTTP de ClienteLocal exige Cadastros.cliente_local
 * OU visualizar Pedido Comercial.
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadClienteLocaisHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'cliente_local', 'visualizar')
    || hasPermission('Cadastros', 'cliente-local', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Fail-closed: listagem HTTP de Obra exige Cadastros.obra OU Pedido visualizar.
 * @param {(module: string, section?: string|string[], action?: string) => boolean} hasPermission
 */
export function canLoadObrasHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'obra', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Extrai cliente_id do vínculo ClienteEmpresa já carregado.
 * @param {object | null | undefined} link
 * @returns {string}
 */
export function resolveClienteIdFromEmpresaLink(link) {
  if (!link || typeof link !== 'object') return '';
  const id = link.cliente_id || link.clienteId;
  return typeof id === 'string' && UUID_RE.test(id) ? id : '';
}

/**
 * Normaliza envelope list HTTP de locais ativos.
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeClienteLocaisListPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray(payload.data) ? payload.data : []);
  return rows.filter((row) => row && row.ativo !== false);
}

/**
 * Normaliza envelope list HTTP de obras ativas (operacionais no Pedido).
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeObrasListPayload(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray(payload.data) ? payload.data : []);
  return rows.filter((row) => row && row.ativo !== false);
}

/**
 * Garante Local no mesmo grupo quando o servidor ecoa group_id/cliente_id.
 * @param {object | null | undefined} row
 * @param {{ groupId?: string, clienteId?: string }} scope
 */
export function assertClienteLocalNoContexto(row, scope) {
  if (row == null) return null;
  if (typeof row !== 'object') {
    throw new Error('ClienteLocal inválido.');
  }
  if (!scope?.groupId) {
    throw new Error('Contexto de grupo obrigatório.');
  }
  if (row.group_id && row.group_id !== scope.groupId) {
    throw new Error('ClienteLocal fora do grupo ativo.');
  }
  if (scope.clienteId && row.cliente_id && row.cliente_id !== scope.clienteId) {
    throw new Error('ClienteLocal fora do cliente selecionado.');
  }
  if (row.id && !UUID_RE.test(String(row.id))) {
    throw new Error('Identificador de ClienteLocal inválido.');
  }
  return row;
}

/**
 * Garante Obra no mesmo grupo/cliente quando o servidor ecoa ids.
 * @param {object | null | undefined} row
 * @param {{ groupId?: string, clienteId?: string }} scope
 */
export function assertObraNoContexto(row, scope) {
  if (row == null) return null;
  if (typeof row !== 'object') {
    throw new Error('Obra inválida.');
  }
  if (!scope?.groupId) {
    throw new Error('Contexto de grupo obrigatório.');
  }
  if (row.group_id && row.group_id !== scope.groupId) {
    throw new Error('Obra fora do grupo ativo.');
  }
  if (scope.clienteId && row.cliente_id && row.cliente_id !== scope.clienteId) {
    throw new Error('Obra fora do cliente selecionado.');
  }
  if (row.id && !UUID_RE.test(String(row.id))) {
    throw new Error('Identificador de Obra inválido.');
  }
  return row;
}

/**
 * @param {object | null | undefined} local
 * @param {string} [fallback]
 */
export function buildClienteLocalDisplayLabel(local, fallback = '') {
  if (!local || typeof local !== 'object') return fallback || '';
  return local.nome || local.apelido || local.cidade || local.id || fallback || '';
}

/**
 * @param {object | null | undefined} obra
 * @param {string} [fallback]
 */
export function buildObraDisplayLabel(obra, fallback = '') {
  if (!obra || typeof obra !== 'object') return fallback || '';
  if (obra.codigo && obra.nome) return `${obra.codigo} — ${obra.nome}`;
  return obra.nome || obra.codigo || obra.id || fallback || '';
}

function trimText(value) {
  return String(value ?? '').trim();
}

/**
 * Resumo de endereço a partir do ClienteLocal (list/get HTTP).
 * Não inventa campos — só monta linhas a partir do payload do servidor.
 * @param {object | null | undefined} local
 * @returns {{
 *   kind: 'local',
 *   id: string|null,
 *   title: string,
 *   lines: string[],
 *   line: string,
 *   incomplete: boolean,
 *   source: string,
 * } | null}
 */
export function buildClienteLocalAddressSummary(local) {
  if (!local || typeof local !== 'object') return null;
  const title = buildClienteLocalDisplayLabel(local) || 'Local';
  const logradouro = trimText(local.logradouro);
  const numero = trimText(local.numero);
  const complemento = trimText(local.complemento);
  const bairro = trimText(local.bairro);
  const cidade = trimText(local.cidade);
  const uf = trimText(local.uf);
  const cep = trimText(local.cep);
  const street = [logradouro, numero].filter(Boolean).join(', ');
  const streetLine = complemento
    ? `${street}${street ? ' — ' : ''}${complemento}`
    : street;
  const cityLine = [bairro, [cidade, uf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  const cepLine = cep ? `CEP ${cep}` : '';
  const lines = [streetLine, cityLine, cepLine].filter(Boolean);
  const incomplete = Boolean(local.endereco_incompleto)
    || !logradouro
    || !cidade
    || !uf;
  return {
    kind: 'local',
    id: local.id ? String(local.id) : null,
    title,
    lines,
    line: lines.join(' · ') || title,
    incomplete,
    source: 'cliente_local',
  };
}

/**
 * Resumo de endereço da Obra: prefere Local principal enriquecido via getLocal;
 * senão usa cidade/UF ecoados em local_principal (sem inventar logradouro).
 * @param {object | null | undefined} obra
 * @param {object | null | undefined} [principalLocal]
 */
export function buildObraAddressSummary(obra, principalLocal = null) {
  if (!obra || typeof obra !== 'object') return null;
  const title = buildObraDisplayLabel(obra) || 'Obra';
  if (principalLocal && typeof principalLocal === 'object') {
    const localSummary = buildClienteLocalAddressSummary(principalLocal);
    if (localSummary) {
      return {
        ...localSummary,
        kind: 'obra',
        id: obra.id ? String(obra.id) : null,
        title,
        obraCodigo: obra.codigo ? String(obra.codigo) : null,
        localPrincipalId: principalLocal.id
          ? String(principalLocal.id)
          : (obra.local_principal?.id ? String(obra.local_principal.id) : null),
        source: 'obra+local',
      };
    }
  }
  const lp = obra.local_principal;
  if (lp && typeof lp === 'object') {
    const nome = trimText(lp.nome);
    const cidade = trimText(lp.cidade);
    const uf = trimText(lp.uf);
    const cityLine = [cidade, uf].filter(Boolean).join('/');
    const lines = [nome, cityLine].filter(Boolean);
    return {
      kind: 'obra',
      id: obra.id ? String(obra.id) : null,
      title,
      lines,
      line: lines.join(' · ') || title,
      incomplete: !cidade || !uf,
      localPrincipalId: lp.id ? String(lp.id) : null,
      source: 'obra_local_principal',
      obraCodigo: obra.codigo ? String(obra.codigo) : null,
    };
  }
  return {
    kind: 'obra',
    id: obra.id ? String(obra.id) : null,
    title,
    lines: [],
    line: title,
    incomplete: true,
    localPrincipalId: null,
    source: 'obra_sem_local',
    obraCodigo: obra.codigo ? String(obra.codigo) : null,
  };
}

/**
 * Estado UI do resumo de endereço pós-seleção Local/Obra.
 * Fail-closed: erro de HTTP get nunca colapsa em empty/ok; save bloqueado.
 * @param {{
 *   tipoOperacao?: string,
 *   clienteLocalId?: string,
 *   obraId?: string,
 *   localRow?: object|null,
 *   obraRow?: object|null,
 *   obraPrincipalLocal?: object|null,
 *   localError?: unknown,
 *   obraError?: unknown,
 *   isLoading?: boolean,
 *   scope?: { groupId?: string, clienteId?: string },
 * }} [input]
 * @returns {{
 *   mode: 'none'|'loading'|'error'|'incomplete'|'ready',
 *   summaries: object[],
 *   hint: string|null,
 *   blockSave: boolean,
 *   error?: unknown,
 * }}
 */
export function resolveDeliveryAddressUiState(input = {}) {
  const localId = trimText(input.clienteLocalId);
  const obraId = trimText(input.obraId);
  const hasSelection = Boolean(localId || obraId);
  const tipo = trimText(input.tipoOperacao).toUpperCase();

  if (!hasSelection) {
    const entrega = tipo === 'ENTREGA';
    return {
      mode: 'none',
      summaries: [],
      hint: entrega
        ? 'Entrega exige Local e/ou Obra com endereço confirmado antes de salvar (fail-closed).'
        : null,
      // Onda 5: Entrega sem endereço não salva; Retirada não exige Local/Obra.
      blockSave: entrega,
    };
  }

  if (input.isLoading) {
    return {
      mode: 'loading',
      summaries: [],
      hint: 'Carregando endereço de entrega do servidor...',
      blockSave: true,
    };
  }

  if (input.localError || input.obraError) {
    const parts = [];
    if (input.localError) parts.push('Local');
    if (input.obraError) parts.push('Obra');
    return {
      mode: 'error',
      summaries: [],
      hint: `Falha ao carregar endereço de ${parts.join('/')} — não use resumo inventado (fail-closed).`,
      blockSave: true,
      error: input.localError || input.obraError,
    };
  }

  const scope = input.scope || {};
  /** @type {object[]} */
  const summaries = [];

  if (localId) {
    if (!input.localRow) {
      return {
        mode: 'error',
        summaries: [],
        hint: 'Local selecionado sem endereço do servidor (fail-closed).',
        blockSave: true,
      };
    }
    try {
      const local = assertClienteLocalNoContexto(input.localRow, scope);
      const summary = buildClienteLocalAddressSummary(local);
      if (!summary) {
        return {
          mode: 'error',
          summaries: [],
          hint: 'Local selecionado sem endereço do servidor (fail-closed).',
          blockSave: true,
        };
      }
      summaries.push(summary);
    } catch (error) {
      return {
        mode: 'error',
        summaries: [],
        hint: error?.message || 'Local fora do contexto (fail-closed).',
        blockSave: true,
        error,
      };
    }
  }

  if (obraId) {
    if (!input.obraRow) {
      return {
        mode: 'error',
        summaries: [],
        hint: 'Obra selecionada sem dados do servidor (fail-closed).',
        blockSave: true,
      };
    }
    try {
      const obra = assertObraNoContexto(input.obraRow, scope);
      const summary = buildObraAddressSummary(obra, input.obraPrincipalLocal || null);
      if (!summary) {
        return {
          mode: 'error',
          summaries: [],
          hint: 'Obra selecionada sem endereço do servidor (fail-closed).',
          blockSave: true,
        };
      }
      // Principal local exigido no get: se obra tem local_principal.id e enrich falhou → já caiu em obraError.
      summaries.push(summary);
    } catch (error) {
      return {
        mode: 'error',
        summaries: [],
        hint: error?.message || 'Obra fora do contexto (fail-closed).',
        blockSave: true,
        error,
      };
    }
  }

  if (summaries.length === 0) {
    return {
      mode: 'error',
      summaries: [],
      hint: 'Endereço de entrega indisponível (fail-closed).',
      blockSave: true,
    };
  }

  const incomplete = summaries.some((row) => row.incomplete);
  const entrega = tipo === 'ENTREGA';
  return {
    mode: incomplete ? 'incomplete' : 'ready',
    summaries,
    hint: incomplete
      ? (entrega
        ? 'Endereço incompleto no cadastro — revise Local/Obra antes de salvar a Entrega (fail-closed).'
        : 'Endereço incompleto no cadastro — revise Local/Obra se for usar na entrega.')
      : null,
    // Entrega exige endereço completo; Retirada pode manter Local/Obra opcional mesmo incompleto.
    blockSave: Boolean(incomplete && entrega),
  };
}
