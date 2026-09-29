/**
 * Política UI CondicaoPagamento HTTP (Onda 2/3) — lista/resolve nas telas canônicas.
 * Snapshot id+codigo+nome+parcelas é persistido pelo servidor no Orçamento/Pedido (migration 029).
 * Payload de save continua só com `condicao_pagamento_id`; snapshot é autoridade do backend.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fail-closed: listagem HTTP de condições exige visualizar Cadastros.condicao_pagamento
 * OU visualizar Comercial (orçamento/pedido) — o botão/lista some sem permissão.
 */
export function canLoadCondicoesPagamentoHttp(hasPermission) {
  if (typeof hasPermission !== 'function') return false;
  return (
    hasPermission('Cadastros', 'condicao_pagamento', 'visualizar')
    || hasPermission('Comercial', 'orcamento', 'visualizar')
    || hasPermission('Comercial', 'pedido', 'visualizar')
  );
}

/**
 * Normaliza envelope list HTTP (`{ data, meta }` ou array) para linhas ativas.
 * @param {unknown} payload
 * @returns {object[]}
 */
export function normalizeCondicoesListPayload(payload) {
  if (Array.isArray(payload)) return payload.filter((row) => row && row.ativo !== false);
  if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
    return payload.data.filter((row) => row && row.ativo !== false);
  }
  return [];
}

/**
 * Aplica resolução fail-closed no formulário (somente `condicao_pagamento_id` canônico).
 * @param {object} form
 * @param {{ fonte?: string, condicao?: { id?: string, codigo?: string, nome?: string, parcelas?: object[] } | null, snapshot?: { id?: string, codigo?: string, nome?: string, parcelas?: object[] } | null } | null | undefined} resolved
 * @returns {{ form: object, snapshot: object | null, applied: boolean, fonte: string }}
 */
export function applyResolvedCondicaoToForm(form, resolved) {
  const base = form && typeof form === 'object' ? { ...form } : {};
  const fonte = resolved?.fonte || 'nenhuma';
  const snapshot = resolved?.snapshot || (resolved?.condicao?.id
    ? {
      id: resolved.condicao.id,
      codigo: resolved.condicao.codigo || null,
      nome: resolved.condicao.nome || null,
      parcelas: Array.isArray(resolved.condicao.parcelas) ? resolved.condicao.parcelas : [],
    }
    : null);

  if (!snapshot?.id || !UUID_RE.test(snapshot.id) || fonte === 'nenhuma') {
    return { form: base, snapshot: null, applied: false, fonte };
  }

  return {
    form: { ...base, condicao_pagamento_id: snapshot.id },
    snapshot: {
      id: snapshot.id,
      codigo: snapshot.codigo || null,
      nome: snapshot.nome || null,
      fonte,
      parcelas: Array.isArray(snapshot.parcelas) ? snapshot.parcelas : [],
    },
    applied: true,
    fonte,
  };
}

/**
 * Preview local de parcelas resolvidas (pré-save) ou recarregadas do documento.
 * @param {object | null | undefined} snapshot
 */
export function buildCondicaoSnapshotPreview(snapshot) {
  if (!snapshot?.id && !snapshot?.condicao_pagamento_id) return null;
  return {
    id: snapshot.id || snapshot.condicao_pagamento_id || null,
    codigo: snapshot.codigo || snapshot.condicao_pagamento_codigo_snapshot || null,
    nome: snapshot.nome || snapshot.condicao_pagamento_nome_snapshot || null,
    fonte: snapshot.fonte || (snapshot.condicao_pagamento_parcelas_snapshot ? 'persistido' : null),
    persistido: Boolean(snapshot.condicao_pagamento_parcelas_snapshot || snapshot.persistido),
    parcelas: Array.isArray(snapshot.parcelas)
      ? snapshot.parcelas.map((parcela) => ({
        ordem: parcela.ordem,
        dias: parcela.dias,
        percentual: String(parcela.percentual ?? ''),
      }))
      : Array.isArray(snapshot.condicao_pagamento_parcelas_snapshot)
        ? snapshot.condicao_pagamento_parcelas_snapshot.map((parcela) => ({
          ordem: parcela.ordem,
          dias: parcela.dias,
          percentual: String(parcela.percentual ?? ''),
        }))
        : [],
  };
}

/**
 * Monta preview a partir do documento Orçamento/Pedido já gravado (reload).
 * @param {object | null | undefined} row
 */
export function buildPersistedCondicaoSnapshotFromRow(row) {
  if (!row?.condicao_pagamento_id) return null;
  if (!row.condicao_pagamento_nome_snapshot && !Array.isArray(row.condicao_pagamento_parcelas_snapshot)) {
    return null;
  }
  return buildCondicaoSnapshotPreview({
    condicao_pagamento_id: row.condicao_pagamento_id,
    condicao_pagamento_codigo_snapshot: row.condicao_pagamento_codigo_snapshot,
    condicao_pagamento_nome_snapshot: row.condicao_pagamento_nome_snapshot,
    condicao_pagamento_parcelas_snapshot: row.condicao_pagamento_parcelas_snapshot,
    persistido: true,
    fonte: 'persistido',
  });
}

/**
 * Garante que a resolução HTTP pertence ao tenant ativo (quando o servidor ecoar ids).
 * @param {object} resolved
 * @param {{ groupId?: string, empresaId?: string }} scope
 */
export function assertCondicaoResolucaoNoContexto(resolved, scope) {
  if (!resolved || typeof resolved !== 'object') {
    throw new Error('Resolução de condição inválida.');
  }
  if (!scope?.groupId || !scope?.empresaId) {
    throw new Error('Contexto de grupo/empresa obrigatório.');
  }
  const condicao = resolved.condicao;
  if (condicao?.group_id && condicao.group_id !== scope.groupId) {
    throw new Error('Condição resolvida fora do grupo ativo.');
  }
  if (condicao?.empresa_id && condicao.empresa_id !== scope.empresaId) {
    const empresas = Array.isArray(condicao.empresas) ? condicao.empresas : [];
    const ok = empresas.some((link) => link?.empresa_id === scope.empresaId && link?.ativo !== false);
    if (!ok) throw new Error('Condição resolvida fora da empresa ativa.');
  }
  return resolved;
}
