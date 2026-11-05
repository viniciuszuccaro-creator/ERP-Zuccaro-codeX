/** Escopo vivo vs esperado (ator + sessão) — resposta tardia. */
export function isRateioMultiempresaScopeCurrent(expected, live) {
  return (expected?.actorId || null) === (live?.actorId || null)
    && (expected?.sessionKey || null) === (live?.sessionKey || null);
}

/**
 * Resolve groupId fail-closed: contexto visual prevalece; prop grupoId
 * só entra se bater com o contexto ou se o contexto estiver ausente.
 */
export function resolveRateioMultiempresaGroupId({ groupId, propGrupoId }) {
  const ctx = groupId || null;
  const prop = propGrupoId || null;
  if (ctx && prop && String(ctx) !== String(prop)) {
    return { ok: false, reason: 'GROUP_MISMATCH', groupId: null };
  }
  const resolved = ctx || prop || null;
  if (!resolved) {
    return { ok: false, reason: 'SCOPE_MISSING', groupId: null };
  }
  return { ok: true, reason: null, groupId: resolved };
}

/** Entidade-alvo do título rateado (contrato legado). */
export function resolveRateioTituloEntity(tipoDocumento) {
  return tipoDocumento === 'ContaPagar' ? 'ContaPagar' : 'ContaReceber';
}

export function buildRateioFinanceiroCreatePayload({ groupId, dados }) {
  return {
    group_id: groupId,
    tipo_documento: dados.tipo_documento,
    descricao: dados.descricao,
    valor_total: dados.valor_total,
    criterio_rateio: dados.criterio_rateio,
    data_rateio: new Date().toISOString().split('T')[0],
    distribuicao: dados.distribuicao,
    categoria: dados.categoria,
    responsavel: 'Sistema',
    status_consolidacao: 'pendente',
  };
}

export function buildRateioTituloCreatePayload({ groupId, dados, dist, rateioId }) {
  const isPagar = dados.tipo_documento === 'ContaPagar';
  return {
    group_id: groupId,
    empresa_id: dist.empresa_id,
    origem: 'grupo',
    e_replicado: true,
    documento_grupo_id: rateioId,
    rateio_id: rateioId,
    descricao: `${dados.descricao} (${dist.empresa_nome})`,
    [isPagar ? 'fornecedor' : 'cliente']: dados.descricao,
    valor: parseFloat(String(dist.valor)),
    valor_original_grupo: dados.valor_total,
    percentual_rateio: dist.percentual,
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: dados.data_vencimento,
    categoria: dados.categoria,
    status: 'Pendente',
    observacoes: `Rateio do grupo - ${dist.observacao}`,
  };
}

/** Preserva mapeamento legado por índice em titulosCriados. */
export function buildRateioDistribuicaoRealizada(titulosCriados, distribuicao) {
  const rows = Array.isArray(titulosCriados) ? titulosCriados : [];
  const dists = Array.isArray(distribuicao) ? distribuicao : [];
  return rows.map((t, idx) => ({
    empresa_id: dists[idx]?.empresa_id,
    empresa_nome: dists[idx]?.empresa_nome,
    titulo_id: t.id,
    valor: t.valor,
    percentual: t.percentual_rateio,
    status: t.status,
  }));
}
